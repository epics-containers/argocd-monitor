import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

const { restartAllMutate } = vi.hoisted(() => ({ restartAllMutate: vi.fn() }));

vi.mock("@/hooks/use-restart-pod", () => ({
  useRestartPod: () => ({ isPending: false, mutate: vi.fn() }),
  useRestartAllPods: () => ({ isPending: false, mutate: restartAllMutate }),
}));

vi.mock("@/hooks/use-set-enabled", () => ({
  useSetEnabled: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-stoppable-workload", () => ({
  useStoppableWorkload: vi.fn(),
}));

import { useApplication, useResourceTree } from "@/hooks/use-application";
import { useStoppableWorkload } from "@/hooks/use-stoppable-workload";

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
  labels?: Record<string, string>;
} = {}): Application {
  return {
    metadata: { name: "test-app", namespace: "default", labels: overrides.labels },
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
  beforeEach(() => {
    vi.mocked(useStoppableWorkload).mockReturnValue({
      data: null,
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);
  });

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

  it("hides Start/Stop button when workload is not stoppable", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.queryByRole("button", { name: /Stop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start/i })).not.toBeInTheDocument();
  });

  it("renders Stop button when running and stoppable", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useStoppableWorkload).mockReturnValue({
      data: { kind: "StatefulSet", name: "test-app", namespace: "ns", group: "apps", version: "v1" },
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);

    renderPage();

    expect(screen.getByRole("button", { name: /Stop/i })).toBeInTheDocument();
    expect(screen.queryByText(/Stopped/)).not.toBeInTheDocument();
  });

  it("renders Start button and Stopped badge when STOPPED=1", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
        labels: { STOPPED: "1" },
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useStoppableWorkload).mockReturnValue({
      data: { kind: "StatefulSet", name: "test-app", namespace: "ns", group: "apps", version: "v1" },
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);

    renderPage();

    expect(screen.getByRole("button", { name: /Start/i })).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  function makePods(count: number, ownerKind = "StatefulSet", prefix = "test-app"): ResourceTree {
    return {
      nodes: Array.from({ length: count }, (_, i) => ({
        kind: "Pod",
        name: `${prefix}-${i}`,
        namespace: "test-ns",
        version: "v1",
        uid: `${prefix}-uid-${i}`,
        parentRefs: [{ kind: ownerKind, name: prefix, namespace: "test-ns" }],
      })),
    } as ResourceTree;
  }

  it("shows Restart all when the service has several pods", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: makePods(2),
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.getByRole("button", { name: /Restart all/i })).toBeInTheDocument();
  });

  it("hides Restart all for a single pod", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: makePods(1),
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.queryByRole("button", { name: /Restart all/i })).not.toBeInTheDocument();
  });

  it("hides Restart all when the service is stopped", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
        labels: { STOPPED: "1" },
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: makePods(2),
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.queryByRole("button", { name: /Restart all/i })).not.toBeInTheDocument();
  });

  it("ignores Job-owned pods when deciding whether to show Restart all", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: {
        nodes: [...makePods(1).nodes, ...makePods(2, "Job", "backup").nodes],
      },
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    expect(screen.queryByRole("button", { name: /Restart all/i })).not.toBeInTheDocument();
  });

  it("passes only controller-owned pods to Restart all", () => {
    restartAllMutate.mockClear();
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: {
        nodes: [
          ...makePods(2, "ReplicaSet").nodes,
          ...makePods(2, "Job", "backup").nodes,
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Restart all/i }));
    expect(screen.getByText(/Restart all 2 pods/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /Restart all/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(restartAllMutate).toHaveBeenCalledTimes(1);
    const [args] = restartAllMutate.mock.calls[0] as [{ pods: { name: string }[] }];
    const pods = args.pods;
    expect(pods.map((p) => p.name).sort()).toEqual(["test-app-0", "test-app-1"]);
  });
});
