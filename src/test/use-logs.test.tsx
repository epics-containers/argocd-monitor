import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLogs } from "@/hooks/use-logs";
import type { LogParams } from "@/api/logs";
import type { LogEntry } from "@/types/resource";

vi.mock("@/api/logs", () => ({
  streamLogs: vi.fn(),
}));

import { streamLogs } from "@/api/logs";

interface Connection {
  entries: LogEntry[];
  throws?: boolean;
}

/** Each call to streamLogs consumes the next connection in turn. */
function mockConnections(...connections: Connection[]) {
  let call = 0;
  vi.mocked(streamLogs).mockImplementation(async function* () {
    const connection = connections[Math.min(call, connections.length - 1)];
    call++;
    for (const entry of connection.entries) {
      await Promise.resolve();
      yield entry;
    }
    if (connection.throws) {
      throw new Error("connection lost");
    }
  });
}

/** ISO timestamp in the shape ArgoCD sends. */
function at(seconds: number, ms = 0) {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, seconds, ms)).toISOString();
}

const baseParams: LogParams = {
  podName: "my-pod",
  namespace: "my-ns",
  tailLines: 1000,
};

describe("useLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only the most recent lines once the ring is full", async () => {
    const entries = Array.from({ length: 10500 }, (_, i) => ({
      content: `line ${i}`,
    }));
    mockConnections({ entries });

    const { result } = renderHook(() =>
      useLogs({ appName: "app", params: baseParams }),
    );

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.lines).toHaveLength(10000);
    expect(result.current.lines[0]).toBe("line 500");
    expect(result.current.lines[9999]).toBe("line 10499");
  });

  it("batches a burst of lines into a small number of renders", async () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({
      content: `line ${i}`,
    }));
    mockConnections({ entries });

    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useLogs({ appName: "app", params: baseParams });
    });

    await waitFor(() => expect(result.current.lines).toHaveLength(200));
    expect(renders).toBeLessThan(20);
  });

  it("resumes from the last entry instead of replaying tailLines", async () => {
    const followParams: LogParams = { ...baseParams, follow: true };
    mockConnections(
      {
        entries: [
          { content: "a", timeStamp: at(1) },
          { content: "b", timeStamp: at(2) },
          { content: "c", timeStamp: at(2, 500) },
        ],
        throws: true,
      },
      {
        // The server replays the whole second we stopped in, then continues
        entries: [
          { content: "b", timeStamp: at(2) },
          { content: "c", timeStamp: at(2, 500) },
          { content: "d", timeStamp: at(3) },
        ],
      },
    );

    const { result } = renderHook(() =>
      useLogs({ appName: "app", params: followParams }),
    );

    await waitFor(() => expect(result.current.lines).toEqual(["a", "b", "c", "d"]), {
      timeout: 8000,
    });

    const resumed = vi.mocked(streamLogs).mock.calls[1][1];
    expect(resumed.sinceTimeSeconds).toBe(Math.floor(Date.parse(at(2)) / 1000));
    expect(resumed.tailLines).toBeUndefined();
    expect(resumed.sinceSeconds).toBeUndefined();
  });

  it("drops entries older than the resume point", async () => {
    const followParams: LogParams = { ...baseParams, follow: true };
    mockConnections(
      {
        entries: [
          { content: "a", timeStamp: at(1) },
          { content: "b", timeStamp: at(2) },
        ],
        throws: true,
      },
      {
        // A server that ignores sinceTime and replays the whole tail
        entries: [
          { content: "a", timeStamp: at(1) },
          { content: "b", timeStamp: at(2) },
          { content: "c", timeStamp: at(4) },
        ],
      },
    );

    const { result } = renderHook(() =>
      useLogs({ appName: "app", params: followParams }),
    );

    await waitFor(() => expect(result.current.lines).toEqual(["a", "b", "c"]), {
      timeout: 8000,
    });
  });

  it("starts a fresh stream without a resume point", async () => {
    mockConnections({ entries: [{ content: "a", timeStamp: at(1) }] });

    renderHook(() => useLogs({ appName: "app", params: baseParams }));

    await waitFor(() => expect(streamLogs).toHaveBeenCalled());
    const first = vi.mocked(streamLogs).mock.calls[0][1];
    expect(first.sinceTimeSeconds).toBeUndefined();
    expect(first.tailLines).toBe(1000);
  });
});
