import { argocdFetch } from "./argocd-client";
import type { ResourceTree, PodResource } from "@/types/resource";

const STOPPABLE_KINDS = new Set(["StatefulSet", "Deployment"]);

export async function getResourceTree(appName: string, appNamespace?: string): Promise<ResourceTree> {
  const params = new URLSearchParams();
  if (appNamespace) {
    params.set("appNamespace", appNamespace);
  }
  const query = params.toString();
  return argocdFetch<ResourceTree>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource-tree${query ? `?${query}` : ""}`,
  );
}

export async function getPodResource(
  appName: string,
  podName: string,
  namespace: string,
  appNamespace?: string,
): Promise<PodResource> {
  const params = new URLSearchParams({
    name: podName,
    resourceName: podName,
    namespace,
    kind: "Pod",
    version: "v1",
  });
  if (appNamespace) {
    params.set("appNamespace", appNamespace);
  }
  const result = await argocdFetch<{ manifest: string }>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource?${params}`,
  );
  return JSON.parse(result.manifest) as PodResource;
}

export interface StoppableWorkload {
  kind: string;
  name: string;
  namespace: string;
  group: string;
  version: string;
  /**
   * The workload's `domain` label. The ioc-instance chart sets it to the
   * parent ArgoCD Application's name, which Start/Stop needs.
   */
  domain?: string;
}

/**
 * Returns workload identity if this child app renders a StatefulSet/Deployment
 * carrying a `metadata.labels.enabled` label (the marker the ec helm chart stamps
 * on stoppable services). Returns null otherwise — caller should hide the Stop/Start
 * UI in that case.
 */
export async function getStoppableWorkload(
  appName: string,
  appNamespace?: string,
): Promise<StoppableWorkload | null> {
  const tree = await getResourceTree(appName, appNamespace);
  const workload = tree.nodes?.find((n) => STOPPABLE_KINDS.has(n.kind));
  if (!workload) return null;

  const params = new URLSearchParams({
    name: workload.name,
    resourceName: workload.name,
    namespace: workload.namespace,
    group: workload.group ?? "apps",
    kind: workload.kind,
    version: workload.version,
  });
  if (appNamespace) {
    params.set("appNamespace", appNamespace);
  }
  const result = await argocdFetch<{ manifest: string }>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource?${params}`,
  );
  const manifest = JSON.parse(result.manifest) as {
    metadata?: { labels?: Record<string, string> };
  };
  if (!manifest.metadata?.labels || !("enabled" in manifest.metadata.labels)) {
    return null;
  }
  return {
    kind: workload.kind,
    name: workload.name,
    namespace: workload.namespace,
    group: workload.group ?? "apps",
    version: workload.version,
    ...(manifest.metadata.labels.domain ? { domain: manifest.metadata.labels.domain } : {}),
  };
}

export async function deletePod(
  appName: string,
  podName: string,
  namespace: string,
  appNamespace?: string,
): Promise<void> {
  const params = new URLSearchParams({
    name: podName,
    resourceName: podName,
    namespace,
    group: "",
    kind: "Pod",
    version: "v1",
    force: "false",
  });
  if (appNamespace) {
    params.set("appNamespace", appNamespace);
  }
  await argocdFetch<unknown>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource?${params}`,
    { method: "DELETE" },
  );
}
