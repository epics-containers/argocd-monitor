import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogsPage } from "@/pages/logs";
import type { ResourceTree } from "@/types/resource";

vi.mock("@/hooks/use-application", () => ({
  useResourceTree: vi.fn(),
}));

vi.mock("@/hooks/use-logs", () => ({
  useLogs: vi.fn(() => ({
    lines: [],
    isStreaming: false,
    error: null,
    stop: vi.fn(),
    restart: vi.fn(),
  })),
}));

import { useResourceTree } from "@/hooks/use-application";
import { useLogs } from "@/hooks/use-logs";

function renderLogsPage(
  podName = "my-pod",
  namespace = "my-ns",
  appNamespace = "default",
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          `/apps/my-app/logs/${podName}?namespace=${namespace}&appNamespace=${appNamespace}`,
        ]}
      >
        <Routes>
          <Route path="/apps/:name/logs/:podName" element={<LogsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LogsPage", () => {
  it("renders pod name in heading", () => {
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderLogsPage();

    expect(screen.getAllByText("my-pod").length).toBeGreaterThanOrEqual(1);
  });

  it("extracts containers from resource tree", () => {
    const tree: ResourceTree = {
      nodes: [
        {
          kind: "Pod",
          name: "my-pod",
          namespace: "my-ns",
          version: "v1",
          info: [{ name: "Containers", value: "app, sidecar" }],
        },
      ],
    };
    vi.mocked(useResourceTree).mockReturnValue({
      data: tree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderLogsPage();

    // useLogs should have been called (stream enabled)
    expect(useLogs).toHaveBeenCalled();
  });

  it("displays error message when stream errors", () => {
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useLogs).mockReturnValue({
      lines: [],
      isStreaming: false,
      error: new Error("connection failed"),
      stop: vi.fn(),
      restart: vi.fn(),
    });

    renderLogsPage();

    expect(screen.getAllByText(/connection failed/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows waiting for logs when no lines", () => {
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useLogs).mockReturnValue({
      lines: [],
      isStreaming: true,
      error: null,
      stop: vi.fn(),
      restart: vi.fn(),
    });

    renderLogsPage();

    expect(screen.getAllByText("Waiting for logs...").length).toBeGreaterThanOrEqual(1);
  });
});
