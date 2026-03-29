import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationDetailPage } from "@/pages/application-detail";
import type { Application } from "@/types/application";
import type { ResourceTree } from "@/types/resource";

// Mock the hooks to control test data
vi.mock("@/hooks/use-application", () => ({
  useApplication: vi.fn(),
  useResourceTree: vi.fn(),
}));

vi.mock("@/hooks/use-restart-pod", () => ({
  useRestartPod: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { useApplication, useResourceTree } from "@/hooks/use-application";

function renderPage(name = "test-app", appNamespace = "default") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          `/apps/${name}?appNamespace=${appNamespace}`,
        ]}
      >
        <Routes>
          <Route path="/apps/:name" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeApp(overrides: {
  health?: { status: string } | undefined;
  sync?: { status: string } | undefined;
} = {}): Application {
  return {
    metadata: { name: "test-app", namespace: "default" },
    spec: {
      project: "default",
      destination: { namespace: "test-ns" },
    },
    status: {
      health: overrides.health as Application["status"]["health"],
      sync: overrides.sync as Application["status"]["sync"],
    },
  } as Application;
}

describe("ApplicationDetailPage", () => {
  it("renders when health and sync are present", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getByText("test-app")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("renders when health and sync are undefined", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: undefined, sync: undefined }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getAllByText("test-app").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
  });

  it("renders when tree is undefined", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getAllByText("test-app").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pods \(0\)/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders when tree.nodes is undefined", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: {} as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getAllByText("test-app").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pods \(0\)/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading spinner while loading", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getByText("Loading application...")).toBeInTheDocument();
  });
});
