import type { GrafanaConfig } from "@/api/observability-config";
import type { ApplicationDestination } from "@/types/application";
import type { PodResource, ResourceNode } from "@/types/resource";

// Dashboard UIDs bundled with kube-prometheus-stack (kubernetes-mixin and
// node-exporter-mixin). They are stable across chart releases.
export const GRAFANA_DASHBOARDS = {
  workload: { uid: "a164a7f0339f99e89cea5cb47e9be617", slug: "k8s-resources-workload" },
  pod: { uid: "6581e46e4e5c7ba40a07646395ef7b23", slug: "k8s-resources-pod" },
  podNetwork: { uid: "7a18067ce943a40ae25454675c19ff5c", slug: "kubernetes-networking-pod" },
  volume: { uid: "919b92a8e8041bd567af9edab12c840c", slug: "kubernetes-persistent-volumes" },
  node: { uid: "200ac8fdbfbb74b39aff88118e4d1c2c", slug: "k8s-resources-node" },
  nodeExporter: { uid: "7d57716318ee0dddbac5a7f451fb7753", slug: "node-exporter-nodes" },
} as const;

const DEFAULT_FROM = "now-6h";
// node-exporter-nodes is heavy; a long range has made Grafana return 503.
const NODE_HARDWARE_FROM = "now-1h";
const NODE_EXPORTER_PORT = 9100;
const DEFAULT_DATASOURCE_UID = "prometheus";

// Single panels of the Workload dashboard, opened full-screen with viewPanel.
// Unlike Explore, a dashboard panel works for Grafana's Viewer role.
const WORKLOAD_CPU_PANEL = "panel-1";
const WORKLOAD_MEMORY_PANEL = "panel-3";

const WORKLOAD_TYPES: Record<string, string> = {
  StatefulSet: "statefulset",
  Deployment: "deployment",
  DaemonSet: "daemonset",
};

/** The Application's cluster identity: destination.name, falling back to
 *  destination.server for Applications that only set the API server URL. */
export function clusterKey(destination: ApplicationDestination | undefined): string | null {
  return destination?.name || destination?.server || null;
}

/**
 * Resolve the Grafana base URL for an Application's destination cluster, or
 * null when links should be hidden. The cluster name is the cluster key
 * itself, or capture group 1 of `clusterPattern` when one is configured.
 * Overrides are checked first by cluster name, then by the raw cluster key (so
 * clusters the pattern can't parse can still be mapped); an empty override
 * disables links. An invalid pattern is treated as "no match", never an error.
 */
export function resolveGrafanaBaseUrl(
  destination: ApplicationDestination | undefined,
  config: GrafanaConfig | undefined,
): string | null {
  if (!config?.enabled) return null;
  const key = clusterKey(destination);
  if (!key) return null;

  const cluster = extractClusterName(key, config.clusterPattern);
  const overrides = config.overrides ?? {};
  for (const k of [cluster, key]) {
    if (k && Object.hasOwn(overrides, k)) {
      return normaliseBaseUrl(overrides[k]);
    }
  }

  if (!cluster || !config.urlTemplate) return null;
  return normaliseBaseUrl(config.urlTemplate.replaceAll("{cluster}", cluster));
}

function extractClusterName(key: string, pattern?: string): string | null {
  if (!pattern) return key;
  try {
    return new RegExp(pattern).exec(key)?.[1] || null;
  } catch {
    return null;
  }
}

function normaliseBaseUrl(url: string | undefined): string | null {
  const trimmed = (url ?? "").trim().replace(/\/+$/, "");
  return trimmed || null;
}

/** What a link points at; lets the UI pick an icon and describe the target. */
export type GrafanaLinkKind =
  | "workload"
  | "pod"
  | "podNetwork"
  | "volume"
  | "workloadCpu"
  | "workloadMemory"
  | "node"
  | "nodeHardware"
  | "cpu"
  | "memory"
  | "restarts";

export interface GrafanaLink {
  kind: GrafanaLinkKind;
  label: string;
  url: string;
  /** What the link is about when the group name doesn't say, e.g. the PVC name. */
  subject?: string;
}

export interface GrafanaLinkGroup {
  /** Resource the links are about, e.g. the workload/pod/node name. */
  name: string;
  /** Secondary detail, e.g. workload kind or node host IP. */
  detail?: string;
  links: GrafanaLink[];
  /** True while the pod's manifest is still loading, so links that depend on
   *  it (network, volumes) are not known yet. */
  pending?: boolean;
}

export interface GrafanaLinkSet {
  app: GrafanaLink[];
  workloads: GrafanaLinkGroup[];
  pods: GrafanaLinkGroup[];
  nodes: GrafanaLinkGroup[];
}

export interface BuildGrafanaLinksInput {
  baseUrl: string;
  datasourceUid?: string;
  /** Include the app-wide Explore links (needs Explore access in Grafana). */
  exploreLinks?: boolean;
  /** Resource-tree nodes for the Application (workloads and pods are picked out). */
  nodes: ResourceNode[];
  /** Pod manifests keyed by podKey(); missing entries degrade gracefully. */
  podManifests: Record<string, PodResource | undefined>;
  /** podKey()s of pods whose manifest fetch is still in flight. */
  pendingPods?: ReadonlySet<string>;
}

/** Key for per-pod maps: an Application can span namespaces, so pod names
 *  alone can collide. */
export function podKey(pod: { namespace: string; name: string }): string {
  return `${pod.namespace}/${pod.name}`;
}

function dashboardUrl(
  baseUrl: string,
  dashboard: { uid: string; slug: string },
  vars: Record<string, string>,
  from = DEFAULT_FROM,
  viewPanel?: string,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(vars)) params.set(`var-${k}`, v);
  params.set("from", from);
  params.set("to", "now");
  if (viewPanel) params.set("viewPanel", viewPanel);
  return `${baseUrl}/d/${dashboard.uid}/${dashboard.slug}?${params}`;
}

/** Escape a literal for use inside a regex. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escape a value for a PromQL double-quoted string literal. */
function escapePromString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function podSelector(namespace: string, podNames: string[]): string {
  const re = `^(${podNames.map(escapeRegex).join("|")})$`;
  return `namespace="${escapePromString(namespace)}", pod=~"${escapePromString(re)}"`;
}

export function exploreUrl(baseUrl: string, datasourceUid: string, expr: string): string {
  const panes = {
    a: {
      datasource: datasourceUid,
      queries: [
        { refId: "A", expr, datasource: { type: "prometheus", uid: datasourceUid } },
      ],
      range: { from: DEFAULT_FROM, to: "now" },
    },
  };
  const params = new URLSearchParams({
    schemaVersion: "1",
    orgId: "1",
    panes: JSON.stringify(panes),
  });
  return `${baseUrl}/explore?${params}`;
}

/** Build every Grafana link for an Application from its resource tree and pod manifests. */
export function buildGrafanaLinks({
  baseUrl,
  datasourceUid,
  exploreLinks,
  nodes,
  podManifests,
  pendingPods,
}: BuildGrafanaLinksInput): GrafanaLinkSet {
  const dsUid = datasourceUid || DEFAULT_DATASOURCE_UID;

  // Sorted by name to match the Pods table's default order.
  const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));

  const workloads: GrafanaLinkGroup[] = sorted
    .filter((n) => n.kind in WORKLOAD_TYPES)
    .map((n) => {
      const vars = { namespace: n.namespace, workload: n.name, type: WORKLOAD_TYPES[n.kind] };
      const panel = (id: string) =>
        dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.workload, vars, DEFAULT_FROM, id);
      return {
        name: n.name,
        detail: n.kind,
        links: [
          { kind: "workloadCpu", label: "CPU", url: panel(WORKLOAD_CPU_PANEL) },
          { kind: "workloadMemory", label: "Memory", url: panel(WORKLOAD_MEMORY_PANEL) },
          {
            kind: "workload",
            label: "Workload resources",
            url: dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.workload, vars),
          },
        ],
      };
    });

  const podNodes = sorted.filter((n) => n.kind === "Pod");
  const nodeGroups = new Map<string, GrafanaLinkGroup>();

  const pods: GrafanaLinkGroup[] = podNodes.map((p) => {
    const manifest = podManifests[podKey(p)];
    const links: GrafanaLink[] = [
      {
        kind: "pod",
        label: "Pod resources",
        url: dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.pod, {
          namespace: p.namespace,
          pod: p.name,
        }),
      },
    ];
    // With hostNetwork the pod's network counters are the whole host's, so
    // only link once the manifest confirms the pod has its own network.
    if (manifest && !manifest.spec?.hostNetwork) {
      links.push({
        kind: "podNetwork",
        label: "Pod network",
        url: dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.podNetwork, {
          namespace: p.namespace,
          pod: p.name,
        }),
      });
    }
    const claims = new Set(
      (manifest?.spec?.volumes ?? []).flatMap((v) => v.persistentVolumeClaim?.claimName || []),
    );
    for (const claim of claims) {
      links.push({
        kind: "volume",
        label: `Volume ${claim}`,
        subject: claim,
        url: dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.volume, {
          namespace: p.namespace,
          volume: claim,
        }),
      });
    }

    const nodeName = manifest?.spec?.nodeName;
    if (nodeName && !nodeGroups.has(nodeName)) {
      const hostIP = manifest?.status?.hostIP;
      const nodeLinks: GrafanaLink[] = [
        {
          kind: "node",
          label: "Node pods",
          url: dashboardUrl(baseUrl, GRAFANA_DASHBOARDS.node, { node: nodeName }),
        },
      ];
      if (hostIP) {
        nodeLinks.push({
          kind: "nodeHardware",
          label: "Node hardware",
          url: dashboardUrl(
            baseUrl,
            GRAFANA_DASHBOARDS.nodeExporter,
            { instance: `${hostIP}:${NODE_EXPORTER_PORT}` },
            NODE_HARDWARE_FROM,
          ),
        });
      }
      nodeGroups.set(nodeName, { name: nodeName, detail: hostIP, links: nodeLinks });
    }

    return { name: p.name, links, pending: !manifest && !!pendingPods?.has(podKey(p)) };
  });

  const app: GrafanaLink[] = [];
  // Explore queries are scoped to a single namespace; pods from the tree all
  // live in the Application's destination namespace in practice, so group by
  // the first pod's namespace and include only pods in it.
  const ns = podNodes[0]?.namespace;
  if (exploreLinks && ns) {
    const names = podNodes.filter((p) => p.namespace === ns).map((p) => p.name);
    const sel = podSelector(ns, names);
    app.push(
      {
        kind: "cpu",
        label: "CPU",
        url: exploreUrl(
          baseUrl,
          dsUid,
          `sum by (pod) (rate(container_cpu_usage_seconds_total{${sel}, container!=""}[5m]))`,
        ),
      },
      {
        kind: "memory",
        label: "Memory",
        url: exploreUrl(
          baseUrl,
          dsUid,
          `sum by (pod) (container_memory_working_set_bytes{${sel}, container!=""})`,
        ),
      },
      {
        kind: "restarts",
        label: "Restarts",
        url: exploreUrl(
          baseUrl,
          dsUid,
          `sum by (pod) (kube_pod_container_status_restarts_total{${sel}})`,
        ),
      },
    );
  }

  const nodeList = [...nodeGroups.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { app, workloads, pods, nodes: nodeList };
}
