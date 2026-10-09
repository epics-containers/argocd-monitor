/** Runtime observability link configuration served by nginx at
 *  /api/observability-config (rendered from the Helm chart's `grafana` and
 *  `graylog` values). Each feature is enabled independently. */
export interface ObservabilityConfig {
  grafana: GrafanaConfig;
  graylog: GraylogConfig;
}

export interface GrafanaConfig {
  enabled: boolean;
  /** Optional regex with one capture group applied to the cluster key
   *  (destination.name, falling back to destination.server); group 1 becomes
   *  `{cluster}`. Empty = use the cluster key verbatim. */
  clusterPattern?: string;
  /** Grafana base URL with `{cluster}` replaced by the captured cluster name. */
  urlTemplate?: string;
  /** Cluster name (or raw cluster key) → Grafana base URL.
   *  An empty string disables Grafana links for that cluster. */
  overrides?: Record<string, string>;
  /** Prometheus datasource UID used by Explore links. */
  datasourceUid?: string;
  /** Show the app-wide Explore links. Off by default: Grafana's Viewer role
   *  cannot open Explore, and is redirected to the home page. */
  exploreLinks?: boolean;
}

/** A single global Graylog server shared by every cluster. */
export interface GraylogConfig {
  enabled: boolean;
  /** Graylog search URL with `{query}` replaced by the URL-encoded Lucene query. */
  urlTemplate?: string;
  /** Graylog message field holding the pod name. */
  podField?: string;
}

const DISABLED: ObservabilityConfig = {
  grafana: { enabled: false },
  graylog: { enabled: false },
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function parseGrafana(v: unknown): GrafanaConfig {
  const data = obj(v);
  if (!data || data.enabled !== true) return { enabled: false };
  const overrides: Record<string, string> = {};
  for (const [k, o] of Object.entries(obj(data.overrides) ?? {})) {
    if (typeof o === "string") overrides[k] = o;
  }
  return {
    enabled: true,
    clusterPattern: str(data.clusterPattern),
    urlTemplate: str(data.urlTemplate),
    overrides,
    datasourceUid: str(data.datasourceUid),
    exploreLinks: data.exploreLinks === true,
  };
}

function parseGraylog(v: unknown): GraylogConfig {
  const data = obj(v);
  if (!data || data.enabled !== true) return { enabled: false };
  return { enabled: true, urlTemplate: str(data.urlTemplate), podField: str(data.podField) };
}

/** Fetch the observability link config. A 404 (images without the endpoint)
 *  or a malformed body resolves to disabled and mistyped fields are dropped,
 *  so the feature stays hidden rather than crashing. Other HTTP and network
 *  errors throw, so a transient failure isn't cached and the next mount
 *  retries. */
export async function getObservabilityConfig(): Promise<ObservabilityConfig> {
  const res = await fetch("/api/observability-config");
  if (res.status === 404) return DISABLED;
  if (!res.ok) throw new Error(`Failed to fetch observability config: ${res.status}`);
  try {
    const data = obj(await res.json());
    if (!data) return DISABLED;
    return { grafana: parseGrafana(data.grafana), graylog: parseGraylog(data.graylog) };
  } catch {
    return DISABLED;
  }
}
