import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ObservabilityLinksSection } from "@/components/observability/observability-links";
import {
  getObservabilityConfig,
  type GrafanaConfig,
  type GraylogConfig,
  type ObservabilityConfig,
} from "@/api/observability-config";
import { getPodResource } from "@/api/resources";
import {
  DLS_CONFIG,
  GRAYLOG_CONFIG,
  GRAYLOG_SEARCH,
  I15_GRAFANA,
  I15_MANIFESTS,
  I15_NODE,
  I15_NODES,
  I15_NS,
} from "./grafana-fixtures";

vi.mock("@/api/resources", () => ({
  getPodResource: vi.fn((_app: string, pod: string) => Promise.resolve(I15_MANIFESTS[pod])),
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

function renderSection(destination = { name: "i15", namespace: I15_NS }, nodes = I15_NODES) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ObservabilityLinksSection appName="i15-1-blueapi" destination={destination} nodes={nodes} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** Wait until the config query has settled, so "renders nothing" assertions
 *  aren't satisfied by the pre-fetch empty render. */
async function configSettled(queryClient: QueryClient) {
  await waitFor(() =>
    expect(queryClient.getQueryState(["observability-config"])?.status).toMatch(/success|error/),
  );
}

describe("ObservabilityLinksSection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getPodResource).mockClear();
    vi.mocked(getPodResource).mockImplementation((_app, pod) =>
      Promise.resolve(I15_MANIFESTS[pod]),
    );
  });

  it("renders dashboard links for the i15 app", async () => {
    mockFetch.mockResolvedValue(configResponse());
    renderSection();

    expect(await screen.findByText("Observability")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Grafana/ })).toHaveAttribute(
      "href",
      I15_GRAFANA,
    );
    // Node group appears once pod manifests have loaded.
    expect(await screen.findByText(I15_NODE)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Pod network/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Volume i15-1-blueapi-scratch/ })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\/k8s-i15-grafana\.diamond\.ac\.uk/);
    }
  });

  it("names the target dashboard in each link's accessible name", async () => {
    mockFetch.mockResolvedValue(configResponse());
    renderSection();

    expect(await screen.findByText(I15_NODE)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Node hardware: Node Exporter \/ Nodes/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /^Workload resources: Kubernetes \/ Compute Resources \/ Workload/ }),
    ).toHaveLength(2);
  });

  it("holds a skeleton node row while pod manifests load", async () => {
    vi.mocked(getPodResource).mockReturnValue(new Promise(() => {}));
    mockFetch.mockResolvedValue(configResponse());
    renderSection();

    const section = await screen.findByRole("region", { name: "Observability" });
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { name: "Node" })).toBeInTheDocument();
    expect(section.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText(I15_NODE)).not.toBeInTheDocument();
    // Network chips wait for the manifest rather than flickering in and out.
    expect(screen.queryByRole("link", { name: /Pod network/ })).not.toBeInTheDocument();
  });

  it("still renders tree-derived links when pod manifests fail to load", async () => {
    vi.mocked(getPodResource).mockRejectedValue(new Error("403"));
    mockFetch.mockResolvedValue(configResponse());
    renderSection();

    const section = await screen.findByRole("region", { name: "Observability" });
    await waitFor(() => expect(section).toHaveAttribute("aria-busy", "false"));
    expect(screen.getAllByRole("link", { name: /^Pod resources/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /^Workload resources/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /^CPU/ })).toBeInTheDocument();
    // Unknown hostNetwork: no network link, and no lingering skeletons.
    expect(screen.queryByRole("link", { name: /Pod network/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Node" })).not.toBeInTheDocument();
    expect(section.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("shows an empty state when the app has no workloads or pods", async () => {
    mockFetch.mockResolvedValue(configResponse());
    renderSection(undefined, []);
    expect(await screen.findByText("No workloads or pods to link to.")).toBeInTheDocument();
  });

  it("renders nothing when Grafana and Graylog are disabled", async () => {
    mockFetch.mockResolvedValue(configResponse(OFF, OFF));
    const { container, queryClient } = renderSection();
    await configSettled(queryClient);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the endpoint is missing", async () => {
    mockFetch.mockResolvedValue(new Response("not found", { status: 404 }));
    const { container, queryClient } = renderSection();
    await configSettled(queryClient);
    expect(container).toBeEmptyDOMElement();
  });

  it("adds a Graylog Logs chip to each workload alongside Grafana", async () => {
    mockFetch.mockResolvedValue(configResponse(DLS_CONFIG, GRAYLOG_CONFIG));
    renderSection();

    expect(await screen.findByText(/Grafana dashboards · k8s-i15-grafana/)).toBeInTheDocument();
    expect(screen.getByText(/Graylog logs · graylog\.example\.com/)).toBeInTheDocument();
    const logs = screen.getAllByRole("link", {
      name: "Logs: Graylog, last 2 hours (opens Graylog in a new tab)",
    });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.getAttribute("href"))).toEqual([
      `${GRAYLOG_SEARCH}?q=pod_name%3A%2Fi15-1-blueapi-%5B0-9%5D%2B%2F&rangetype=relative&from=7200`,
      `${GRAYLOG_SEARCH}?q=pod_name%3A%2Fi15-1-blueapi-oauth2-%5Ba-z0-9%5D%7B1%2C10%7D-%5Ba-z0-9%5D%7B5%7D%2F&rangetype=relative&from=7200`,
    ]);
    for (const l of logs) {
      expect(l).toHaveAttribute("target", "_blank");
      expect(l).toHaveAttribute("rel", "noopener noreferrer");
    }
    // Grafana chips are unaffected.
    expect(screen.getAllByRole("link", { name: /^Workload resources/ })).toHaveLength(2);
  });

  it("shows Graylog links when Grafana is disabled", async () => {
    mockFetch.mockResolvedValue(configResponse(OFF, GRAYLOG_CONFIG));
    renderSection();

    const section = await screen.findByRole("region", { name: "Observability" });
    expect(screen.getAllByRole("link", { name: /^Logs: Graylog/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Open Grafana/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Grafana dashboards/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Workload resources/ })).not.toBeInTheDocument();
    // No Grafana means no pod manifest fetches and no Pods/Node rows for owned pods.
    expect(getPodResource).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Pods" })).not.toBeInTheDocument();
    expect(section).toHaveAttribute("aria-busy", "false");
  });

  it("shows Graylog links when the cluster has no Grafana", async () => {
    mockFetch.mockResolvedValue(
      configResponse({ ...DLS_CONFIG, overrides: { i15: "" } }, GRAYLOG_CONFIG),
    );
    renderSection();
    expect(await screen.findAllByRole("link", { name: /^Logs: Graylog/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /Open Grafana/ })).not.toBeInTheDocument();
  });

  it("links a bare pod with no owner by its exact name", async () => {
    mockFetch.mockResolvedValue(configResponse(OFF, GRAYLOG_CONFIG));
    const bare = { ...I15_NODES[4], name: "debug-shell", uid: "bare", parentRefs: undefined };
    const owned = I15_NODES[4];
    renderSection(undefined, [I15_NODES[0], owned, bare]);

    expect(await screen.findByRole("heading", { name: "Pods" })).toBeInTheDocument();
    const logs = screen.getAllByRole("link", { name: /^Logs: Graylog/ });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => new URL(l.getAttribute("href")!).searchParams.get("q"))).toEqual([
      "pod_name:/i15-1-blueapi-[0-9]+/",
      'pod_name:"debug-shell"',
    ]);
    expect(screen.queryByText("i15-1-blueapi-0")).not.toBeInTheDocument();
  });

  it("renders nothing when Graylog is enabled without a URL template", async () => {
    mockFetch.mockResolvedValue(configResponse(OFF, { enabled: true, urlTemplate: " " }));
    const { container, queryClient } = renderSection();
    await configSettled(queryClient);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the cluster override is empty", async () => {
    mockFetch.mockResolvedValue(configResponse({ ...DLS_CONFIG, overrides: { i15: "" } }));
    const { container, queryClient } = renderSection();
    await configSettled(queryClient);
    expect(container).toBeEmptyDOMElement();
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
