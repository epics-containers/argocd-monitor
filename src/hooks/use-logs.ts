import { useCallback, useEffect, useRef, useState } from "react";
import { streamLogs } from "@/api/logs";
import type { LogParams } from "@/api/logs";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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

  // Keep a ref to the latest params so the effect doesn't depend on them
  const latestRef = useRef({ appName, params, appNamespace });
  latestRef.current = { appName, params, appNamespace };

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    retriesRef.current = 0;
    setIsStreaming(false);
  }, []);

  const start = useCallback(() => {
    stop();
    setLines([]);
    setError(null);
    setIsStreaming(true);
    retriesRef.current = 0;

    const runStream = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { appName, params, appNamespace } = latestRef.current;

      try {
        for await (const entry of streamLogs(
          appName,
          params,
          controller.signal,
          appNamespace,
        )) {
          if (controller.signal.aborted) break;
          retriesRef.current = 0;
          setLines((prev) => [...prev, entry.content]);
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
        if (!controller.signal.aborted && retriesRef.current === 0) {
          setIsStreaming(false);
        }
      }
    };

    void runStream();
  }, [stop]);

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
