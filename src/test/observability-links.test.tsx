import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PodTable } from "@/components/pod-table/pod-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getObservabilityConfig,
  type GrafanaConfig,
  type GraylogConfig,
  type ObservabilityConfig,
} from "@/api/observability-config";
import { getPodResource } from "@/api/resources";
import type { ResourceNode } from "@/types/resource";
import {
  DLS_CONFIG,
  GRAYLOG_CONFIG,
  GRAYLOG_SEARCH,
  I15_GRAFANA,
  I15_MANIFESTS,
  I15_NODE,
  I15_NODES,
  I15_NS,
  I15_OAUTH_POD,
} from "./grafana-fixtures";

vi.mock("@/api/resources", () => ({
  getPodResource: vi.fn((_app: string, pod: string, ns: string) => Promise.resolve(I15_MANIFESTS[`${ns}/${pod}`])),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

const OFF = { enabled: false };

function configResponse(
  grafana: GrafanaConfig | typeof OFF = DLS_CONFIG,
  graylog: GraylogConfig | typeof OFF = OFF,
): Response {
  return jsonResponse({ grafana, graylog });
}

const onRestart = vi.fn();

function renderTable(destination = { name: "i15", namespace: I15_NS }, nodes = I15_NODES) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter>
          <PodTable
            appName="i15-1-blueapi"
            destination={destination}
            nodes={nodes}
            onRestart={onRestart}
          />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** Wait until the config query has settled, so "no links" assertions aren't
 *  satisfied by the pre-fetch render. */
async function configSettled(queryClient: QueryClient) {
  await waitFor(() =>
    expect(queryClient.getQueryState(["observability-config"])?.status).toMatch(/success|error/),
  );
}

/** Open a pod's Dashboards menu and return it. */
async function openPodMenu(pod: string) {
  const trigger = await screen.findByRole("button", { name: `Dashboards for pod ${pod}` });
  act(() => {
    fireEvent.click(trigger);
  });
  return screen.findByRole("menu");
}

function closeMenu() {
  act(() => {
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  });
}

/** The row group (workload header plus its pods) whose header names `name`. */
function workloadGroup(name: string): HTMLElement {
  const header = screen.getAllByRole("rowheader").find((h) => within(h).queryByText(name));
  return header!.closest("tbody")!;
}

describe("PodTable", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    onRestart.mockReset();
    vi.mocked(getPodResource).mockClear();
    vi.mocked(getPodResource).mockImplementation((_app, pod, ns) =>
      Promise.resolve(I15_MANIFESTS[`${ns}/${pod}`]),
    );
  });

  it("groups pods under their workload, through ReplicaSets", () => {
    mockFetch.mockResolvedValue(configResponse(OFF, OFF));
    const idle = { ...I15_NODES[0], name: "i15-1-idle", uid: "idle" };
    renderTable(undefined, [...I15_NODES, idle]);

    expect(within(workloadGroup("i15-1-blueapi")).getByText("i15-1-blueapi-0")).toBeInTheDocument();
    expect(within(workloadGroup("i15-1-blueapi-oauth2")).getByText(I15_OAUTH_POD)).toBeInTheDocument();
    // A workload scaled to zero still gets its row (and so its links).
    expect(within(workloadGroup("i15-1-idle")).getByText("No pods running.")).toBeInTheDocument();
    expect(screen.queryByText("Other pods")).not.toBeInTheDocument();
  });

  it("restarts the pod whose Restart button is pressed", () => {
    mockFetch.mockResolvedValue(configResponse(OFF, OFF));
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: `Restart pod ${I15_OAUTH_POD}` }));
    expect(onRestart).toHaveBeenCalledWith(I15_NODES[5]);
  });

  it("puts workload dashboards on the workload row and the rest in each pod's menu", async () => {
    mockFetch.mockResolvedValue(configResponse());
    renderTable();

    expect(await screen.findByRole("link", { name: /Open Grafana/ })).toHaveAttribute(
      "href",
      I15_GRAFANA,
    );
    const sts = workloadGroup("i15-1-blueapi");
    expect(within(sts).getByRole("link", { name: /^CPU: CPU usage panel/ })).toBeInTheDocument();
    expect(within(sts).getByRole("link", { name: /^Workload resources/ })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /Grafana in a new tab/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\/k8s-i15-grafana\.diamond\.ac\.uk/);
    }

    // The node row shows once manifests load: short name, FQDN in the tooltip.
    expect(await within(sts).findByText(I15_NODE.split(".")[0])).toHaveAttribute("title", I15_NODE);
    // hostNetwork pod: volume but no network link; its node's dashboards.
    let menu = await openPodMenu("i15-1-blueapi-0");
    expect(within(menu).getByRole("menuitem", { name: /^Pod resources: Kubernetes \/ Compute Resources \/ Pod/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Volume i15-1-blueapi-scratch/ })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /Pod network/ })).not.toBeInTheDocument();
    expect(within(menu).getByText(`Node ${I15_NODE.split(".")[0]}`)).toHaveAttribute("title", I15_NODE);
    expect(
      within(menu).getByRole("menuitem", { name: /^Node hardware: Node Exporter \/ Nodes, last hour/ }),
    ).toHaveAttribute("target", "_blank");
    closeMenu();

    menu = await openPodMenu(I15_OAUTH_POD);
    expect(within(menu).getByRole("menuitem", { name: /Pod network/ })).toBeInTheDocument();
  });

  it("shows pending links while pod manifests load", async () => {
    vi.mocked(getPodResource).mockReturnValue(new Promise(() => {}));
    mockFetch.mockResolvedValue(configResponse());
    renderTable();

    const menu = await openPodMenu(I15_OAUTH_POD);
    expect(screen.getByRole("region", { name: "Pods" })).toHaveAttribute("aria-busy", "true");
    expect(within(menu).getByText("Loading network and volume links…")).toBeInTheDocument();
    // Network links wait for the manifest rather than flickering in and out.
    expect(within(menu).queryByRole("menuitem", { name: /Pod network/ })).not.toBeInTheDocument();
  });

  it("still links to pod dashboards when pod manifests fail to load", async () => {
    vi.mocked(getPodResource).mockRejectedValue(new Error("403"));
    mockFetch.mockResolvedValue(configResponse());
    renderTable();

    const section = await screen.findByRole("region", { name: "Pods" });
    await waitFor(() => expect(section).toHaveAttribute("aria-busy", "false"));
    // Workload CPU / Memory panels come from the tree alone.
    expect(screen.getAllByRole("link", { name: /^CPU: CPU usage panel/ })).toHaveLength(2);
    const menu = await openPodMenu("i15-1-blueapi-0");
    expect(within(menu).getByRole("menuitem", { name: /^Pod resources/ })).toBeInTheDocument();
    // Unknown hostNetwork and node: no network link, no node group.
    expect(within(menu).queryByRole("menuitem", { name: /Pod network/ })).not.toBeInTheDocument();
    expect(within(menu).queryByText(/^Node /)).not.toBeInTheDocument();
    expect(within(menu).queryByText(/Loading/)).not.toBeInTheDocument();
  });

  it("shows the app-wide Explore links only when exploreLinks is set", async () => {
    mockFetch.mockResolvedValue(configResponse());
    const { unmount } = renderTable();
    await screen.findByRole("link", { name: /Open Grafana/ });
    expect(screen.queryByText("All pods in Explore")).not.toBeInTheDocument();
    unmount();

    mockFetch.mockResolvedValue(configResponse({ ...DLS_CONFIG, exploreLinks: true }));
    renderTable();
    expect(await screen.findByText("All pods in Explore")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Explore/ })).toHaveLength(3);
  });

  it("shows an empty state when the app has no workloads or pods", () => {
    mockFetch.mockResolvedValue(configResponse());
    renderTable(undefined, []);
    expect(screen.getByText("No pods found.")).toBeInTheDocument();
  });

  it.each([
    ["Grafana and Graylog are disabled", () => configResponse(OFF, OFF)],
    ["the endpoint is missing", () => new Response("not found", { status: 404 })],
    ["Graylog has no URL template", () => configResponse(OFF, { enabled: true, urlTemplate: " " })],
    ["the cluster override is empty", () => configResponse({ ...DLS_CONFIG, overrides: { i15: "" } })],
  ])("lists pods without links when %s", async (_why, response) => {
    mockFetch.mockResolvedValue(response());
    const { queryClient } = renderTable();
    await configSettled(queryClient);
    expect(screen.getByText("i15-1-blueapi-0")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /new tab/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Dashboards for pod/ })).not.toBeInTheDocument();
    expect(getPodResource).not.toHaveBeenCalled();
  });

  it("puts a Graylog chip first on each workload, alongside Grafana", async () => {
    mockFetch.mockResolvedValue(configResponse(DLS_CONFIG, GRAYLOG_CONFIG));
    renderTable();

    const logs = await screen.findAllByRole("link", {
      name: "Graylog: historical logs, last 2 hours (opens Graylog in a new tab)",
    });
    expect(logs.map((l) => l.getAttribute("href"))).toEqual([
      `${GRAYLOG_SEARCH}?q=pod_name%3A%2Fi15-1-blueapi-%5B0-9%5D%2B%2F&rangetype=relative&from=7200`,
      `${GRAYLOG_SEARCH}?q=pod_name%3A%2Fi15-1-blueapi-oauth2-%5Ba-z0-9%5D%7B1%2C10%7D-%5Ba-z0-9%5D%7B5%7D%2F&rangetype=relative&from=7200`,
    ]);
    for (const l of logs) {
      expect(l).toHaveTextContent("Graylog");
      expect(l).toHaveAttribute("target", "_blank");
      expect(l).toHaveAttribute("rel", "noopener noreferrer");
    }
    const chips = within(workloadGroup("i15-1-blueapi")).getAllByRole("link");
    expect(chips[0]).toBe(logs[0]);
    expect(chips.length).toBeGreaterThan(1);
  });

  it("shows Graylog links when the cluster has no Grafana", async () => {
    mockFetch.mockResolvedValue(
      configResponse({ ...DLS_CONFIG, overrides: { i15: "" } }, GRAYLOG_CONFIG),
    );
    renderTable();
    expect(await screen.findAllByRole("link", { name: /^Graylog: historical logs/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Open Grafana/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Workload resources/ })).not.toBeInTheDocument();
    // No Grafana means no manifest fetches, and owned pods have nothing to menu.
    expect(getPodResource).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Dashboards for pod/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pods" })).toHaveAttribute("aria-busy", "false");
  });

  it("links a bare pod to Graylog by its exact name, under Other pods", async () => {
    mockFetch.mockResolvedValue(configResponse(OFF, GRAYLOG_CONFIG));
    const bare: ResourceNode = { ...I15_NODES[4], name: "debug-shell", uid: "bare", parentRefs: undefined };
    renderTable(undefined, [I15_NODES[0], I15_NODES[4], bare]);

    expect(await screen.findByText("Other pods")).toBeInTheDocument();
    expect(
      within(workloadGroup("Other pods")).getByText("debug-shell"),
    ).toBeInTheDocument();
    const workloadLogs = await screen.findAllByRole("link", { name: /^Graylog: historical logs/ });
    expect(workloadLogs).toHaveLength(1);
    const menu = await openPodMenu("debug-shell");
    const podLog = within(menu).getByRole("menuitem", { name: /^Graylog: historical logs/ });
    expect(new URL(podLog.getAttribute("href")!).searchParams.get("q")).toBe('pod_name:"debug-shell"');
  });
});

describe("getObservabilityConfig", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns the parsed config and drops mistyped fields", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        grafana: {
          enabled: true,
          clusterPattern: "^(.*)$",
          urlTemplate: 42,
          overrides: { a: "https://a", b: 1 },
          datasourceUid: "prom",
        },
        graylog: { enabled: true, urlTemplate: "https://g/?q={query}", podField: 7 },
      }),
    );
    await expect(getObservabilityConfig()).resolves.toEqual({
      grafana: {
        enabled: true,
        clusterPattern: "^(.*)$",
        urlTemplate: undefined,
        overrides: { a: "https://a" },
        datasourceUid: "prom",
        exploreLinks: false,
      },
      graylog: { enabled: true, urlTemplate: "https://g/?q={query}", podField: undefined },
    } satisfies ObservabilityConfig);
    expect(mockFetch).toHaveBeenCalledWith("/api/observability-config");
  });

  it("parses each feature independently", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ graylog: GRAYLOG_CONFIG }));
    await expect(getObservabilityConfig()).resolves.toEqual({
      grafana: { enabled: false },
      graylog: GRAYLOG_CONFIG,
    });
  });

  it("resolves to disabled on 404 and malformed responses", async () => {
    const disabled = { grafana: { enabled: false }, graylog: { enabled: false } };
    mockFetch.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    await expect(getObservabilityConfig()).resolves.toEqual(disabled);
    mockFetch.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    await expect(getObservabilityConfig()).resolves.toEqual(disabled);
    mockFetch.mockResolvedValueOnce(jsonResponse(null));
    await expect(getObservabilityConfig()).resolves.toEqual(disabled);
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ grafana: { enabled: "yes" }, graylog: ["enabled"] }),
    );
    await expect(getObservabilityConfig()).resolves.toEqual(disabled);
  });

  it("throws on transient failures so they are not cached as disabled", async () => {
    mockFetch.mockResolvedValueOnce(new Response("bad gateway", { status: 502 }));
    await expect(getObservabilityConfig()).rejects.toThrow("502");
    mockFetch.mockRejectedValueOnce(new TypeError("network"));
    await expect(getObservabilityConfig()).rejects.toThrow("network");
  });
});
