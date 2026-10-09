import type { GrafanaLinkKind } from "@/lib/grafana";
import type { ParentRef, ResourceNode } from "@/types/resource";

/** What a link points at; lets the UI pick an icon and describe the target. */
export type LinkKind = GrafanaLinkKind | "logs";

export interface ObservabilityLink {
  kind: LinkKind;
  label: string;
  url: string;
  /** What the link is about when the group name doesn't say, e.g. the PVC name. */
  subject?: string;
  /** Search query the link runs, shown in the tooltip. */
  query?: string;
  /** Time range shown in the tooltip, overriding the kind's default. */
  range?: string;
}

export interface LinkGroup {
  /** Resource the links are about, e.g. the workload/pod/node name. */
  name: string;
  /** Secondary detail, e.g. workload kind or node host IP. */
  detail?: string;
  /** Namespace of a workload or pod group; unset for nodes. */
  namespace?: string;
  links: ObservabilityLink[];
  /** True while the pod's manifest is still loading, so links that depend on
   *  it (network, volumes) are not known yet. */
  pending?: boolean;
}

/** Map key for a workload: kind and name are only unique within a namespace. */
export function workloadKey(w: { namespace?: string; kind?: string; detail?: string; name: string }): string {
  return `${w.namespace ?? ""}/${w.kind ?? w.detail ?? ""}/${w.name}`;
}

/** Controllers whose pods are shown grouped under them. */
const WORKLOAD_KINDS = new Set(["StatefulSet", "Deployment", "DaemonSet"]);

export interface WorkloadPods {
  /** The owning workload, or null for pods with no recognised controller
   *  (bare pods, Job pods). */
  workload: ResourceNode | null;
  pods: ResourceNode[];
}

/**
 * Group an Application's pods under the workload that owns them, following
 * owner references through intermediate controllers (Pod → ReplicaSet →
 * Deployment). Every workload is listed, including ones scaled to zero, sorted
 * by name; pods without a recognised workload come last in a group whose
 * `workload` is null.
 */
export function groupPodsByWorkload(nodes: ResourceNode[]): WorkloadPods[] {
  const key = (n: { kind: string; namespace: string; name: string }) =>
    `${n.namespace}/${n.kind}/${n.name}`;
  const byKey = new Map(nodes.map((n) => [key(n), n]));

  const ownerOf = (pod: ResourceNode): ResourceNode | null => {
    let current: ResourceNode | undefined = pod;
    // Owner chains are short; the bound guards against malformed cycles.
    for (let depth = 0; current && depth < 5; depth++) {
      const ref: ParentRef | undefined = current.parentRefs?.[0];
      if (!ref) return null;
      const parent = byKey.get(key({ ...ref, namespace: ref.namespace || current.namespace }));
      if (parent && WORKLOAD_KINDS.has(parent.kind)) return parent;
      current = parent;
    }
    return null;
  };

  const groups = new Map<string, WorkloadPods>();
  for (const n of [...nodes].sort((a, b) => a.name.localeCompare(b.name))) {
    if (WORKLOAD_KINDS.has(n.kind)) groups.set(key(n), { workload: n, pods: [] });
  }
  const other: WorkloadPods = { workload: null, pods: [] };
  for (const n of nodes) {
    if (n.kind !== "Pod") continue;
    const owner = ownerOf(n);
    (owner ? groups.get(key(owner))! : other).pods.push(n);
  }
  const result = [...groups.values()];
  if (other.pods.length > 0) result.push(other);
  return result;
}

/** A value from the `info` list ArgoCD attaches to resource-tree nodes, e.g.
 *  "Containers" ("1/1"), "Restart Count", "Status Reason" or "Node". */
export function nodeInfo(node: ResourceNode, name: string): string | undefined {
  return node.info?.find((i) => i.name === name)?.value;
}

/** Node names are FQDNs; the first label is what people call the machine. */
export function shortNodeName(name: string): string {
  return name.split(".")[0];
}
