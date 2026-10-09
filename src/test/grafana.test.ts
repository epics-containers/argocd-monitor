import { describe, it, expect } from "vitest";
import {
  buildGrafanaLinks,
  clusterKey,
  podSelector,
  resolveGrafanaBaseUrl,
} from "@/lib/grafana";
import type { GrafanaConfig } from "@/api/observability-config";
import {
  DLS_CONFIG,
  I15_GRAFANA,
  I15_HOST_IP,
  I15_MANIFESTS,
  I15_NODE,
  I15_NODES,
  I15_NS,
  I15_OAUTH_POD,
} from "./grafana-fixtures";

const SERVER_CONFIG: GrafanaConfig = {
  enabled: true,
  clusterPattern: "^https?://api\\.k8s-([^.:/]+)",
  urlTemplate: "https://k8s-{cluster}-grafana.diamond.ac.uk",
};

function parsed(url: string) {
  return new URL(url);
}

interface ExplorePanes {
  a: {
    datasource: string;
    range: { from: string; to: string };
    queries: { refId: string; expr: string; datasource: { type: string; uid: string } }[];
  };
}

function panesOf(url: string): ExplorePanes {
  return JSON.parse(parsed(url).searchParams.get("panes")!) as ExplorePanes;
}

describe("clusterKey", () => {
  it("prefers destination.name over destination.server", () => {
    expect(clusterKey({ name: "b01-1", server: "https://x" })).toBe("b01-1");
  });
  it("falls back to destination.server", () => {
    expect(clusterKey({ server: "https://x", namespace: "ns" })).toBe("https://x");
  });
  it("is null when neither is set", () => {
    expect(clusterKey({ namespace: "ns" })).toBeNull();
    expect(clusterKey(undefined)).toBeNull();
  });
});

describe("resolveGrafanaBaseUrl", () => {
  it("uses destination.name verbatim when no pattern is set", () => {
    expect(resolveGrafanaBaseUrl({ name: "i15", namespace: I15_NS }, DLS_CONFIG)).toBe(
      I15_GRAFANA,
    );
    expect(
      resolveGrafanaBaseUrl({ name: "b01-1", namespace: "b01-1-beamline" }, DLS_CONFIG),
    ).toBe("https://k8s-b01-1-grafana.diamond.ac.uk");
  });

  it("extracts the cluster from a server-only destination with a pattern", () => {
    expect(
      resolveGrafanaBaseUrl({ server: "https://api.k8s-i15.diamond.ac.uk:6443" }, SERVER_CONFIG),
    ).toBe(I15_GRAFANA);
  });

  it("returns null when the pattern does not match and no override applies", () => {
    expect(
      resolveGrafanaBaseUrl({ server: "https://kubernetes.default.svc" }, SERVER_CONFIG),
    ).toBeNull();
  });

  it("returns null when disabled, unconfigured or destination-less", () => {
    expect(resolveGrafanaBaseUrl({ name: "i15" }, { enabled: false })).toBeNull();
    expect(resolveGrafanaBaseUrl({ name: "i15" }, undefined)).toBeNull();
    expect(resolveGrafanaBaseUrl({ name: "i15" }, { enabled: true })).toBeNull();
    expect(resolveGrafanaBaseUrl({ namespace: "ns" }, DLS_CONFIG)).toBeNull();
  });

  it("treats an invalid regex as no match instead of throwing", () => {
    const config = { ...SERVER_CONFIG, clusterPattern: "([unclosed" };
    expect(resolveGrafanaBaseUrl({ server: "https://api.k8s-i15.x" }, config)).toBeNull();
  });

  it("prefers an override keyed by cluster name", () => {
    const config = { ...SERVER_CONFIG, overrides: { i15: "https://special.example/" } };
    expect(resolveGrafanaBaseUrl({ server: "https://api.k8s-i15.diamond.ac.uk:6443" }, config)).toBe(
      "https://special.example",
    );
  });

  it("matches an override by raw server when the pattern does not match", () => {
    const config = {
      ...SERVER_CONFIG,
      overrides: { "https://kubernetes.default.svc": "https://grafana.local" },
    };
    expect(resolveGrafanaBaseUrl({ server: "https://kubernetes.default.svc" }, config)).toBe(
      "https://grafana.local",
    );
  });

  it("disables links for a cluster whose override is empty", () => {
    const config = { ...DLS_CONFIG, overrides: { "b01-1": "" } };
    expect(resolveGrafanaBaseUrl({ name: "b01-1" }, config)).toBeNull();
    expect(resolveGrafanaBaseUrl({ name: "i15" }, config)).toBe(I15_GRAFANA);
  });
});

describe("buildGrafanaLinks (i15-1-blueapi)", () => {
  const links = buildGrafanaLinks({
    baseUrl: I15_GRAFANA,
    exploreLinks: true,
    nodes: I15_NODES,
    podManifests: I15_MANIFESTS,
  });

  it("links each workload to the workload dashboard with its type", () => {
    expect(links.workloads.map((w) => w.name)).toEqual([
      "i15-1-blueapi",
      "i15-1-blueapi-oauth2",
    ]);
    const u = parsed(links.workloads[0].links[0].url);
    expect(u.origin).toBe(I15_GRAFANA);
    expect(u.pathname).toBe("/d/a164a7f0339f99e89cea5cb47e9be617/k8s-resources-workload");
    expect(u.searchParams.get("var-namespace")).toBe(I15_NS);
    expect(u.searchParams.get("var-workload")).toBe("i15-1-blueapi");
    expect(u.searchParams.get("var-type")).toBe("statefulset");
    expect(u.searchParams.get("from")).toBe("now-6h");
    expect(parsed(links.workloads[1].links[0].url).searchParams.get("var-type")).toBe(
      "deployment",
    );
  });

  it("omits pod network for hostNetwork pods and adds one link per PVC", () => {
    const blueapi = links.pods.find((p) => p.name === "i15-1-blueapi-0")!;
    expect(blueapi.links.map((l) => l.label)).toEqual([
      "Pod resources",
      "Volume i15-1-blueapi-scratch-1.20.0",
    ]);
    const vol = parsed(blueapi.links[1].url);
    expect(vol.pathname).toBe("/d/919b92a8e8041bd567af9edab12c840c/kubernetes-persistent-volumes");
    expect(vol.searchParams.get("var-volume")).toBe("i15-1-blueapi-scratch-1.20.0");

    const oauth = links.pods.find((p) => p.name === I15_OAUTH_POD)!;
    expect(oauth.links.map((l) => l.label)).toEqual(["Pod resources", "Pod network"]);
    const net = parsed(oauth.links[1].url);
    expect(net.pathname).toBe("/d/7a18067ce943a40ae25454675c19ff5c/kubernetes-networking-pod");
    expect(net.searchParams.get("var-pod")).toBe(I15_OAUTH_POD);
  });

  it("deduplicates the shared node and uses a 1h range for node hardware", () => {
    expect(links.nodes).toHaveLength(1);
    expect(links.nodes[0].name).toBe(I15_NODE);
    const [pods, hw] = links.nodes[0].links.map((l) => parsed(l.url));
    expect(pods.pathname).toBe("/d/200ac8fdbfbb74b39aff88118e4d1c2c/k8s-resources-node");
    expect(pods.searchParams.get("var-node")).toBe(I15_NODE);
    expect(hw.pathname).toBe("/d/7d57716318ee0dddbac5a7f451fb7753/node-exporter-nodes");
    expect(hw.searchParams.get("var-instance")).toBe(`${I15_HOST_IP}:9100`);
    expect(hw.searchParams.get("from")).toBe("now-1h");
  });

  it("builds Explore links scoped to exactly this app's pods", () => {
    expect(links.app.map((l) => l.label)).toEqual(["CPU", "Memory", "Restarts"]);
    const u = parsed(links.app[0].url);
    expect(u.pathname).toBe("/explore");
    expect(u.searchParams.get("orgId")).toBe("1");
    const panes = panesOf(links.app[0].url);
    expect(panes.a.datasource).toBe("prometheus");
    expect(panes.a.range).toEqual({ from: "now-6h", to: "now" });
    expect(panes.a.queries[0].datasource).toEqual({ type: "prometheus", uid: "prometheus" });
    expect(panes.a.queries[0].expr).toBe(
      `sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="${I15_NS}", ` +
        `pod=~"^(i15-1-blueapi-0|${I15_OAUTH_POD})$", container!=""}[5m]))`,
    );
  });

  it("uses a custom datasource UID", () => {
    const custom = buildGrafanaLinks({
      baseUrl: I15_GRAFANA,
      exploreLinks: true,
      datasourceUid: "prom-uid",
      nodes: I15_NODES,
      podManifests: I15_MANIFESTS,
    });
    const panes = panesOf(custom.app[0].url);
    expect(panes.a.datasource).toBe("prom-uid");
    expect(panes.a.queries[0].datasource.uid).toBe("prom-uid");
  });

  it("degrades gracefully when pod manifests are not yet loaded", () => {
    const partial = buildGrafanaLinks({
      baseUrl: I15_GRAFANA,
      nodes: I15_NODES,
      podManifests: {},
      pendingPods: new Set([`${I15_NS}/i15-1-blueapi-0`]),
    });
    expect(partial.pods).toHaveLength(2);
    expect(partial.nodes).toEqual([]);
    // hostNetwork is unknown without the manifest, so no pod network link.
    for (const p of partial.pods) expect(p.links.map((l) => l.kind)).toEqual(["pod"]);
    expect(partial.pods.map((p) => p.pending)).toEqual([true, false]);
  });

  it("links CPU and Memory panels of the Workload dashboard per workload", () => {
    const links = buildGrafanaLinks({ baseUrl: I15_GRAFANA, nodes: I15_NODES, podManifests: {} });
    const sts = links.workloads.find((g) => g.name === "i15-1-blueapi")!;
    expect(sts.links.map((l) => l.kind)).toEqual(["workloadCpu", "workloadMemory", "workload"]);
    const cpu = new URL(sts.links[0].url);
    expect(cpu.pathname).toBe("/d/a164a7f0339f99e89cea5cb47e9be617/k8s-resources-workload");
    expect(cpu.searchParams.get("viewPanel")).toBe("panel-1");
    expect(cpu.searchParams.get("var-workload")).toBe("i15-1-blueapi");
    expect(cpu.searchParams.get("var-type")).toBe("statefulset");
    expect(new URL(sts.links[1].url).searchParams.get("viewPanel")).toBe("panel-3");
    expect(new URL(sts.links[2].url).searchParams.has("viewPanel")).toBe(false);
  });

  it("leaves out Explore links unless asked: Viewers cannot open Explore", () => {
    const links = buildGrafanaLinks({ baseUrl: I15_GRAFANA, nodes: I15_NODES, podManifests: {} });
    expect(links.app).toEqual([]);
  });

  it("keeps same-named pods in different namespaces apart", () => {
    const pod = I15_MANIFESTS[`${I15_NS}/i15-1-blueapi-0`];
    const other = { ...I15_NODES.find((n) => n.name === "i15-1-blueapi-0")!, namespace: "other", uid: "other" };
    const links = buildGrafanaLinks({
      baseUrl: I15_GRAFANA,
      nodes: [...I15_NODES, other],
      podManifests: {
        ...I15_MANIFESTS,
        "other/i15-1-blueapi-0": { ...pod, spec: { nodeName: "elsewhere", volumes: [] } },
      },
    });
    const pods = links.pods.filter((g) => g.name === "i15-1-blueapi-0");
    expect(pods).toHaveLength(2);
    // The i15 pod keeps its hostNetwork (no Network link) and its PVC; the other
    // namespace's pod gets its own manifest's (Network link, no PVC).
    const kinds = pods.map((g) => g.links.map((l) => l.kind).sort());
    expect(kinds).toContainEqual(["pod", "volume"]);
    expect(kinds).toContainEqual(["pod", "podNetwork"]);
  });

  it("links a PVC once even when mounted by several volumes", () => {
    const pod = I15_MANIFESTS[`${I15_NS}/i15-1-blueapi-0`];
    const twice = buildGrafanaLinks({
      baseUrl: I15_GRAFANA,
      nodes: I15_NODES,
      podManifests: {
        ...I15_MANIFESTS,
        [`${I15_NS}/i15-1-blueapi-0`]: {
          ...pod,
          spec: {
            ...pod.spec,
            volumes: [
              ...(pod.spec?.volumes ?? []),
              { name: "scratch2", persistentVolumeClaim: { claimName: "i15-1-blueapi-scratch-1.20.0" } },
            ],
          },
        },
      },
    });
    const vols = twice.pods[0].links.filter((l) => l.kind === "volume");
    expect(vols).toHaveLength(1);
    expect(vols[0].subject).toBe("i15-1-blueapi-scratch-1.20.0");
  });

  it("sorts workloads and pods by name regardless of tree order", () => {
    const reversed = buildGrafanaLinks({
      baseUrl: I15_GRAFANA,
      nodes: [...I15_NODES].reverse(),
      podManifests: I15_MANIFESTS,
    });
    expect(reversed.workloads.map((w) => w.name)).toEqual(links.workloads.map((w) => w.name));
    expect(reversed.pods.map((p) => p.name)).toEqual(["i15-1-blueapi-0", I15_OAUTH_POD]);
  });

  it("returns no app links when the tree has no pods", () => {
    const none = buildGrafanaLinks({ baseUrl: I15_GRAFANA, nodes: [], podManifests: {} });
    expect(none).toEqual({ app: [], workloads: [], pods: [], nodes: [] });
  });
});

describe("podSelector", () => {
  it("regex-escapes pod names and PromQL-escapes the string", () => {
    expect(podSelector("ns", ["a.b", "c+d"])).toBe(
      'namespace="ns", pod=~"^(a\\\\.b|c\\\\+d)$"',
    );
  });
});
