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

vi.mock("@/hooks/use-restart-pod", () => ({
  useRestartPod: () => ({ isPending: false, mutate: vi.fn() }),
}));

const { setEnabledMutate } = vi.hoisted(() => ({ setEnabledMutate: vi.fn() }));

vi.mock("@/hooks/use-set-enabled", () => ({
  useSetEnabled: () => ({ isPending: false, mutate: setEnabledMutate }),
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
  namespace?: string;
} = {}): Application {
  return {
    metadata: {
      name: "test-app",
      namespace: overrides.namespace ?? "default",
      labels: overrides.labels,
    },
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

  it("uses the workload's domain label as the Stop target's parent app", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({ health: { status: "Healthy" }, sync: { status: "Synced" } }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useStoppableWorkload).mockReturnValue({
      data: {
        kind: "StatefulSet",
        name: "test-app",
        namespace: "ns",
        group: "apps",
        version: "v1",
        domain: "p47",
      },
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Stop/i }));

    expect(screen.getByText(/on the parent application "p47"/)).toBeInTheDocument();
  });

  it("falls back to <name>-beamline for the parent app without a domain label", () => {
    vi.mocked(useApplication).mockReturnValue({
      data: makeApp({
        health: { status: "Healthy" },
        sync: { status: "Synced" },
        namespace: "p47-beamline",
      }),
      isLoading: false,
    } as ReturnType<typeof useApplication>);
    vi.mocked(useResourceTree).mockReturnValue({
      data: { nodes: [] } as ResourceTree,
      isLoading: false,
    } as ReturnType<typeof useResourceTree>);
    vi.mocked(useStoppableWorkload).mockReturnValue({
      data: {
        kind: "StatefulSet",
        name: "test-app",
        namespace: "ns",
        group: "apps",
        version: "v1",
      },
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);

    renderPage("test-app", "p47-beamline");
    fireEvent.click(screen.getByRole("button", { name: /Stop/i }));

    expect(screen.getByText(/on the parent application "p47"/)).toBeInTheDocument();
  });

  it("names the parent app it tried when Start fails", () => {
    setEnabledMutate.mockImplementationOnce(
      (_vars: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error("ArgoCD API error 403: permission denied")),
    );
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
      data: {
        kind: "StatefulSet",
        name: "test-app",
        namespace: "ns",
        group: "apps",
        version: "v1",
        domain: "p47",
      },
      isLoading: false,
    } as ReturnType<typeof useStoppableWorkload>);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Start/i }));

    expect(
      screen.getByText(/403: permission denied \(parent application "p47", from the workload's domain label\)/),
    ).toBeInTheDocument();
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
});
