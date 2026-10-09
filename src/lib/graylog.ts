import type { GraylogConfig } from "@/api/observability-config";
import { isHttpUrl } from "@/lib/grafana";
import type { ObservabilityLink, LinkGroup } from "@/lib/observability";
import type { ResourceNode } from "@/types/resource";

const DEFAULT_POD_FIELD = "pod_name";
const QUERY_PLACEHOLDER = "{query}";

/** Pod-name suffix each controller appends to the workload name, as a Lucene
 *  regex fragment. Lucene regexes match the whole term, so the pattern must
 *  cover the entire pod name, which also stops a workload matching the pods of
 *  a sibling whose name merely starts with it (i15-1-blueapi vs
 *  i15-1-blueapi-oauth2-…). */
const POD_SUFFIX: Record<string, string> = {
  // <name>-<ordinal>
  StatefulSet: "-[0-9]+",
  // <name>-<pod-template-hash>-<5 char suffix>
  Deployment: "-[a-z0-9]{1,10}-[a-z0-9]{5}",
  // <name>-<5 char suffix>
  DaemonSet: "-[a-z0-9]{5}",
};

/** Escape a literal for a Lucene regular expression: every character other
 *  than letters, digits, '-' and '_' is backslash-escaped (which also covers
 *  the '/' delimiter). */
export function escapeLuceneRegex(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "\\$&");
}

/** Quote a literal as a Lucene phrase (exact match on a keyword field). */
function quoteLucene(s: string): string {
  return `"${s.replace(/["\\]/g, "\\$&")}"`;
}

/** Lucene query matching every pod (current and historical) of a workload,
 *  e.g. `pod_name:/i15-1-blueapi-[0-9]+/`. A bare Pod (kind "Pod") matches
 *  its exact name, e.g. `pod_name:"debug-shell"`. Returns null for kinds whose pod names aren't derivable. */
export function graylogPodQuery(
  kind: string,
  name: string,
  podField = DEFAULT_POD_FIELD,
): string | null {
  if (kind === "Pod") return `${podField}:${quoteLucene(name)}`;
  const suffix = POD_SUFFIX[kind];
  if (!suffix) return null;
  return `${podField}:/${escapeLuceneRegex(name)}${suffix}/`;
}

/** Substitute the URL-encoded query into the Graylog URL template. */
export function graylogUrl(urlTemplate: string, query: string): string {
  return urlTemplate.replaceAll(QUERY_PLACEHOLDER, encodeURIComponent(query));
}

/** Human-readable time range of a Graylog search URL template ("Last 2 hours")
 *  when it uses a relative range in seconds, else null. */
export function graylogRangeLabel(urlTemplate: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URL(urlTemplate.replaceAll(QUERY_PLACEHOLDER, "")).searchParams;
  } catch {
    return null;
  }
  if (params.get("rangetype") !== "relative") return null;
  const raw = params.get("from") ?? params.get("relative");
  if (!raw || !/^[0-9]+$/.test(raw)) return null;
  const secs = Number(raw);
  if (secs === 0) return null;
  for (const [unit, size] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ] as const) {
    if (secs % size === 0) {
      const n = secs / size;
      return n === 1 ? `Last ${unit}` : `Last ${n} ${unit}s`;
    }
  }
  return null;
}

/**
 * The usable Graylog URL template, or null when Graylog links are off. A
 * template without a literal `{query}` placeholder would open every link
 * unfiltered, so it counts as off too.
 */
export function resolveGraylogTemplate(config: GraylogConfig | undefined): string | null {
  if (!config?.enabled) return null;
  const template = config.urlTemplate?.trim();
  return template && template.includes(QUERY_PLACEHOLDER) && isHttpUrl(template)
    ? template
    : null;
}

export interface GraylogLinkSet {
  workloads: LinkGroup[];
  /** Bare pods with no owning controller. */
  pods: LinkGroup[];
}

/** One historical-logs link per workload (and per bare pod) in the tree. */
export function buildGraylogLinks({
  urlTemplate,
  podField,
  nodes,
}: {
  urlTemplate: string;
  podField?: string;
  nodes: ResourceNode[];
}): GraylogLinkSet {
  const field = podField?.trim() || DEFAULT_POD_FIELD;
  const range = graylogRangeLabel(urlTemplate) ?? undefined;
  const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
  const linkFor = (n: ResourceNode): ObservabilityLink | null => {
    const query = graylogPodQuery(n.kind, n.name, field);
    if (!query) return null;
    return { kind: "logs", label: "Graylog", url: graylogUrl(urlTemplate, query), query, range };
  };

  const workloads: LinkGroup[] = [];
  const pods: LinkGroup[] = [];
  for (const n of sorted) {
    if (n.kind in POD_SUFFIX) {
      const link = linkFor(n);
      if (link) workloads.push({ name: n.name, detail: n.kind, namespace: n.namespace, links: [link] });
    } else if (n.kind === "Pod" && !n.parentRefs?.length) {
      const link = linkFor(n);
      if (link) pods.push({ name: n.name, namespace: n.namespace, links: [link] });
    }
  }
  return { workloads, pods };
}
