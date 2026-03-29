import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamLogs } from "@/api/logs";

// Mock the argocd client
vi.mock("@/api/argocd-client", () => ({
  argocdFetchStream: vi.fn(),
}));

import { argocdFetchStream } from "@/api/argocd-client";

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("streamLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses newline-delimited JSON log entries", async () => {
    const chunks = [
      '{"result":{"content":"line 1","podName":"pod-1"}}\n{"result":{"content":"line 2","podName":"pod-1"}}\n',
    ];
    vi.mocked(argocdFetchStream).mockResolvedValue(makeStream(chunks));

    const entries = [];
    for await (const entry of streamLogs("app", {
      podName: "pod-1",
      namespace: "ns",
    })) {
      entries.push(entry);
    }

    expect(entries).toEqual([
      { content: "line 1", podName: "pod-1" },
      { content: "line 2", podName: "pod-1" },
    ]);
  });

  it("handles chunks split across boundaries", async () => {
    const chunks = [
      '{"result":{"content":"lin',
      'e 1"}}\n{"result":{"content":"line 2"}}\n',
    ];
    vi.mocked(argocdFetchStream).mockResolvedValue(makeStream(chunks));

    const entries = [];
    for await (const entry of streamLogs("app", {
      podName: "pod-1",
      namespace: "ns",
    })) {
      entries.push(entry);
    }

    expect(entries).toEqual([
      { content: "line 1" },
      { content: "line 2" },
    ]);
  });

  it("yields remaining buffer on stream end", async () => {
    const chunks = ['{"result":{"content":"last line"}}'];
    vi.mocked(argocdFetchStream).mockResolvedValue(makeStream(chunks));

    const entries = [];
    for await (const entry of streamLogs("app", {
      podName: "pod-1",
      namespace: "ns",
    })) {
      entries.push(entry);
    }

    expect(entries).toEqual([{ content: "last line" }]);
  });

  it("falls back to plain text for non-JSON lines", async () => {
    const chunks = ["not json\n"];
    vi.mocked(argocdFetchStream).mockResolvedValue(makeStream(chunks));

    const entries = [];
    for await (const entry of streamLogs("app", {
      podName: "pod-1",
      namespace: "ns",
    })) {
      entries.push(entry);
    }

    expect(entries).toEqual([{ content: "not json" }]);
  });

  it("skips empty lines", async () => {
    const chunks = ['\n\n{"result":{"content":"data"}}\n\n'];
    vi.mocked(argocdFetchStream).mockResolvedValue(makeStream(chunks));

    const entries = [];
    for await (const entry of streamLogs("app", {
      podName: "pod-1",
      namespace: "ns",
    })) {
      entries.push(entry);
    }

    expect(entries).toEqual([{ content: "data" }]);
  });
});
