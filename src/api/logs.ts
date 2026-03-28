import { argocdFetchStream } from "./argocd-client";
import type { LogEntry } from "@/types/resource";

export interface LogParams {
  podName: string;
  container?: string;
  namespace: string;
  sinceSeconds?: number;
  tailLines?: number;
  follow?: boolean;
  previous?: boolean;
}

export async function* streamLogs(
  appName: string,
  params: LogParams,
  signal?: AbortSignal,
  appNamespace?: string,
): AsyncGenerator<LogEntry> {
  const searchParams = new URLSearchParams({
    podName: params.podName,
    namespace: params.namespace,
  });

  if (appNamespace) {
    searchParams.set("appNamespace", appNamespace);
  }

  if (params.container) {
    searchParams.set("container", params.container);
  }
  if (params.sinceSeconds) {
    searchParams.set("sinceSeconds", String(params.sinceSeconds));
  }
  if (params.tailLines) {
    searchParams.set("tailLines", String(params.tailLines));
  }
  if (params.follow) {
    searchParams.set("follow", "true");
  }
  if (params.previous) {
    searchParams.set("previous", "true");
  }

  const stream = await argocdFetchStream(
    `/api/v1/applications/${encodeURIComponent(appName)}/logs?${searchParams}`,
    { signal },
  );

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { result: LogEntry };
          yield parsed.result;
        } catch {
          yield { content: line };
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer) as { result: LogEntry };
        yield parsed.result;
      } catch {
        yield { content: buffer };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
