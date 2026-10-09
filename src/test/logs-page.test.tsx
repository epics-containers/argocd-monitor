import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("searches without hiding lines, stepping between hits", async () => {
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useLogs).mockReturnValue({
      lines: ["INFO started", "ERROR disk full", "error: retry (1)"],
      isStreaming: true,
      error: null,
      stop: vi.fn(),
      restart: vi.fn(),
    });

    const { container } = renderLogsPage();
    const input = screen.getByRole("searchbox", { name: "Search logs" });
    const current = () => container.querySelector('[aria-current="true"]')?.getAttribute("data-line");

    fireEvent.change(input, { target: { value: "error" } });
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    // Nothing is filtered out.
    expect(screen.getByText("INFO started")).toBeInTheDocument();
    expect(current()).toBe("1");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("2 of 2")).toBeInTheDocument();
    expect(current()).toBe("2");
    // Wraps around, both ways.
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(await screen.findByText("2 of 2")).toBeInTheDocument();

    // Plain text is literal: "(1)" is not a regex group.
    fireEvent.change(input, { target: { value: "(1)" } });
    expect(await screen.findByText("1 of 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use regular expression" }));
    fireEvent.change(input, { target: { value: "^ERROR" } });
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match case" }));
    expect(await screen.findByText("1 of 1")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "nothing-here" } });
    expect(await screen.findByText("No results")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "(" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Invalid regex/);
  });
});
