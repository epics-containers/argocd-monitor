import type { GrafanaLinkKind } from "@/lib/grafana";

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
  links: ObservabilityLink[];
  /** True while the pod's manifest is still loading, so links that depend on
   *  it (network, volumes) are not known yet. */
  pending?: boolean;
}

/** Merge link groups that describe the same resource (same name and detail),
 *  keeping `a`'s links first, sorted by name. */
export function mergeLinkGroups(a: LinkGroup[], b: LinkGroup[]): LinkGroup[] {
  const key = (g: LinkGroup) => `${g.detail ?? ""}/${g.name}`;
  const merged = new Map<string, LinkGroup>();
  for (const g of [...a, ...b]) {
    const existing = merged.get(key(g));
    merged.set(
      key(g),
      existing
        ? {
            ...existing,
            links: [...existing.links, ...g.links],
            pending: existing.pending || g.pending,
          }
        : g,
    );
  }
  return [...merged.values()].sort((x, y) => x.name.localeCompare(y.name));
}
