import { useCallback, useEffect, useRef, useState } from "react";
import { streamLogs } from "@/api/logs";
import type { LogParams } from "@/api/logs";

interface UseLogsOptions {
  appName: string;
  params: LogParams;
  enabled?: boolean;
}

export function useLogs({ appName, params, enabled = true }: UseLogsOptions) {
  const [lines, setLines] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    setLines([]);
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const entry of streamLogs(
        appName,
        params,
        controller.signal,
      )) {
        if (controller.signal.aborted) break;
        setLines((prev) => [...prev, entry.content]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsStreaming(false);
    }
  }, [appName, params, stop]);

  useEffect(() => {
    if (enabled) {
      start();
    }
    return stop;
  }, [enabled, start, stop]);

  return { lines, isStreaming, error, stop, restart: start };
}
