import { useCallback, useEffect, useRef, useState } from "react";
import { streamLogs } from "@/api/logs";
import type { LogParams } from "@/api/logs";
import type { LogEntry } from "@/types/resource";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
// Ring size: once this many lines are held the oldest are dropped, so a long
// running follow on a chatty pod cannot grow without limit.
const MAX_LINES = 10000;
// A resumed stream asks for this much more than the gap, so a client clock
// running behind the cluster's cannot make the server start after the resume
// point. Anything replayed ahead of the position is dropped on arrival anyway.
const RESUME_SLACK_S = 60;

// Lines are collected in a ref and flushed once per animation frame, so a burst
// costs one render and one array copy instead of one of each per line.
function scheduleFlush(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16) as unknown as number;
}

function cancelFlush(handle: number) {
  if (typeof requestAnimationFrame === "function") {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}

// Where the last stream got to: the whole second of the newest entry seen, plus
// the entries within that second, in order. Kubernetes only resumes a log to
// the second, so a resumed stream replays that second and the contents let us
// drop the replayed entries again.
interface StreamPosition {
  seconds: number;
  contents: string[];
  // False when the stream cut in part-way through this second (tailLines or
  // sinceSeconds on the first connection), so a replay of the second may carry
  // entries ahead of contents[0] that were never shown.
  complete: boolean;
}

function entrySeconds(timeStamp: string | undefined): number | null {
  if (!timeStamp) return null;
  const ms = Date.parse(timeStamp);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

interface UseLogsOptions {
  appName: string;
  params: LogParams;
  enabled?: boolean;
  appNamespace?: string;
}

export function useLogs({ appName, params, enabled = true, appNamespace }: UseLogsOptions) {
  const [lines, setLines] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);
  const pendingRef = useRef<string[]>([]);
  const flushRef = useRef<number | null>(null);
  const positionRef = useRef<StreamPosition | null>(null);

  // Keep a ref to the latest params so the effect doesn't depend on them
  const latestRef = useRef({ appName, params, appNamespace });
  latestRef.current = { appName, params, appNamespace };

  const flush = useCallback(() => {
    if (flushRef.current !== null) {
      cancelFlush(flushRef.current);
      flushRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending.length === 0) return;
    pendingRef.current = [];
    setLines((prev) => {
      const next = prev.concat(pending);
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const queueLine = useCallback(
    (content: string) => {
      const pending = pendingRef.current;
      pending.push(content);
      // A hidden tab gets no animation frames, so bound the pending batch too
      if (pending.length > MAX_LINES) {
        pending.splice(0, pending.length - MAX_LINES);
      }
      if (flushRef.current === null) {
        flushRef.current = scheduleFlush(() => {
          flushRef.current = null;
          flush();
        });
      }
    },
    [flush],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    retriesRef.current = 0;
    flush();
    setIsStreaming(false);
  }, [flush]);

  const start = useCallback(() => {
    stop();
    if (flushRef.current !== null) {
      cancelFlush(flushRef.current);
      flushRef.current = null;
    }
    pendingRef.current = [];
    positionRef.current = null;
    setLines([]);
    setError(null);
    setIsStreaming(true);
    retriesRef.current = 0;

    const runStream = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { appName, params, appNamespace } = latestRef.current;

      // Resume where the previous attempt stopped. Re-opening with the original
      // tailLines/sinceSeconds would replay a fixed tail — duplicating what is
      // already on screen, and dropping anything logged beyond that count while
      // the connection was down.
      // ArgoCD advertises sinceTime.seconds for this, but its grpc-gateway
      // drops the parameter without error (metav1.Time has no seconds field to
      // populate), so the position is sent as a relative sinceSeconds instead.
      const resumeFrom = positionRef.current;
      const streamParams: LogParams = resumeFrom
        ? {
            ...params,
            sinceSeconds: Math.max(
              RESUME_SLACK_S,
              Math.ceil(Date.now() / 1000) - resumeFrom.seconds + RESUME_SLACK_S,
            ),
            tailLines: undefined,
          }
        : params;

      // Entries are chronological, so drop everything the server re-delivers up
      // to and including the last entry we already hold. This stays correct even
      // if the server ignores sinceSeconds and replays more than it was asked for.
      let replay = resumeFrom;
      let replayIndex = 0;
      const isReplayed = (entry: LogEntry): boolean => {
        if (!replay) return false;
        const seconds = entrySeconds(entry.timeStamp);
        if (seconds === null || seconds > replay.seconds) {
          replay = null;
          return false;
        }
        if (seconds < replay.seconds) return true;
        if (
          replayIndex < replay.contents.length &&
          entry.content === replay.contents[replayIndex]
        ) {
          replayIndex++;
          return true;
        }
        // We never saw the start of this second, so entries ahead of the ones
        // we hold were never shown: keep dropping until our sequence begins
        if (replayIndex === 0 && !replay.complete) return true;
        // Diverged from what we hold (log rotated, say): keep the rest
        replay = null;
        return false;
      };

      const record = (entry: LogEntry) => {
        const seconds = entrySeconds(entry.timeStamp);
        if (seconds === null) return;
        const current = positionRef.current;
        if (!current || current.seconds !== seconds) {
          // Only a change of second seen on the stream proves this entry is
          // the first of its second
          positionRef.current = {
            seconds,
            contents: [entry.content],
            complete: current !== null,
          };
          return;
        }
        current.contents.push(entry.content);
        if (current.contents.length > MAX_LINES) {
          current.contents.splice(0, current.contents.length - MAX_LINES);
          current.complete = false;
        }
      };

      try {
        for await (const entry of streamLogs(
          appName,
          streamParams,
          controller.signal,
          appNamespace,
        )) {
          if (controller.signal.aborted) break;
          retriesRef.current = 0;
          if (isReplayed(entry)) continue;
          record(entry);
          queueLine(entry.content);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        // Auto-reconnect on error if follow is enabled
        if (latestRef.current.params.follow && retriesRef.current < MAX_RETRIES) {
          retriesRef.current++;
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (!controller.signal.aborted) {
            void runStream();
          }
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!controller.signal.aborted) {
          flush();
          if (retriesRef.current === 0) {
            setIsStreaming(false);
          }
        }
      }
    };

    void runStream();
  }, [stop, flush, queueLine]);

  // Start on mount, restart when params change
  useEffect(() => {
    if (enabled) {
      void start();
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, appName, params, appNamespace]);

  return { lines, isStreaming, error, stop, restart: start };
}
