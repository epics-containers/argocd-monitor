import { useMemo } from "react";
import { useObservabilityConfig } from "@/hooks/use-observability-config";
import { usePodManifests } from "@/hooks/use-pod-manifests";
import { buildGrafanaLinks, podKey, resolveGrafanaBaseUrl } from "@/lib/grafana";
import { buildGraylogLinks, resolveGraylogTemplate } from "@/lib/graylog";
import { workloadKey, type LinkGroup, type ObservabilityLink } from "@/lib/observability";
import type { ApplicationDestination } from "@/types/application";
import type { ResourceNode } from "@/types/resource";

export interface PodLinks {
  links: ObservabilityLink[];
  /** True while the pod's manifest loads, so network/volume links are not known yet. */
  pending: boolean;
}

export interface ObservabilityLinks {
  /** Base URL of the destination cluster's Grafana, when it has one. */
  grafanaUrl: string | null;
  /** Host of the Graylog server, when Graylog links are on. */
  graylogHost: string | null;
  /** App-wide Grafana Explore links (only with `exploreLinks`). */
  app: ObservabilityLink[];
  /** Links for a workload, Graylog first. */
  workload: (w: ResourceNode) => ObservabilityLink[];
  /** Links for a single pod: Graylog for a bare pod, then Grafana pod dashboards. */
  pod: (p: ResourceNode) => PodLinks;
  /** Dashboards for the node a pod runs on, once its manifest has loaded. */
  node: (p: ResourceNode) => LinkGroup | undefined;
  /** Node a pod runs on, from its manifest. */
  nodeName: (p: ResourceNode) => string | undefined;
  /** True while pod manifests (which feed network, volume and node links) load. */
  loading: boolean;
}

const NO_LINKS: ObservabilityLink[] = [];

/** Observability links for an Application: dashboards in the destination
 *  cluster's Grafana and historical logs in the global Graylog, indexed by the
 *  workload, pod or node they are about. Each source is configured
 *  independently; with neither, every lookup returns nothing. */
export function useObservabilityLinks(
  appName: string,
  appNamespace: string | undefined,
  destination: ApplicationDestination,
  nodes: ResourceNode[],
): ObservabilityLinks {
  const { data: config } = useObservabilityConfig();
  const baseUrl = resolveGrafanaBaseUrl(destination, config?.grafana);
  const graylogTemplate = resolveGraylogTemplate(config?.graylog);
  const graylogPodField = config?.graylog.podField;
  const datasourceUid = config?.grafana.datasourceUid;
  const exploreLinks = config?.grafana.exploreLinks;
  const pods = useMemo(() => nodes.filter((n) => n.kind === "Pod"), [nodes]);
  // Pod manifests only feed Grafana links (network, volumes, nodes).
  const { manifests, pending, isLoading } = usePodManifests(appName, pods, appNamespace, !!baseUrl);

  return useMemo((): ObservabilityLinks => {
    const grafana = baseUrl
      ? buildGrafanaLinks({
          baseUrl,
          datasourceUid,
          exploreLinks,
          nodes,
          podManifests: manifests,
          pendingPods: pending,
        })
      : { app: [], workloads: [], pods: [], nodes: [] };
    const graylog = graylogTemplate
      ? buildGraylogLinks({ urlTemplate: graylogTemplate, podField: graylogPodField, nodes })
      : { workloads: [], pods: [] };

    const workloads = new Map<string, ObservabilityLink[]>();
    // Graylog first: it is the link people reach for most.
    for (const g of [...graylog.workloads, ...grafana.workloads]) {
      const k = workloadKey(g);
      workloads.set(k, [...(workloads.get(k) ?? []), ...g.links]);
    }
    const podLinks = new Map<string, PodLinks>();
    for (const g of [...graylog.pods, ...grafana.pods]) {
      const k = podKey({ namespace: g.namespace ?? "", name: g.name });
      const existing = podLinks.get(k);
      podLinks.set(k, {
        links: [...(existing?.links ?? []), ...g.links],
        pending: !!existing?.pending || !!g.pending,
      });
    }
    const nodeGroups = new Map(grafana.nodes.map((g) => [g.name, g]));
    const nodeName = (p: ResourceNode) => manifests[podKey(p)]?.spec?.nodeName;

    return {
      grafanaUrl: baseUrl,
      graylogHost: graylogTemplate ? hostOf(graylogTemplate) : null,
      app: grafana.app,
      workload: (w) => workloads.get(workloadKey(w)) ?? NO_LINKS,
      pod: (p) => podLinks.get(podKey(p)) ?? { links: NO_LINKS, pending: false },
      node: (p) => {
        const name = nodeName(p);
        return name ? nodeGroups.get(name) : undefined;
      },
      nodeName,
      loading: !!baseUrl && isLoading,
    };
  }, [
    baseUrl,
    graylogTemplate,
    graylogPodField,
    datasourceUid,
    exploreLinks,
    nodes,
    manifests,
    pending,
    isLoading,
  ]);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
