import { argocdFetch } from "./argocd-client";
import type { ResourceTree, PodResource } from "@/types/resource";

export async function getResourceTree(appName: string): Promise<ResourceTree> {
  return argocdFetch<ResourceTree>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource-tree`,
  );
}

export async function getPodResource(
  appName: string,
  podName: string,
  namespace: string,
): Promise<PodResource> {
  const params = new URLSearchParams({
    name: podName,
    namespace,
    kind: "Pod",
    version: "v1",
  });
  const result = await argocdFetch<{ manifest: string }>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource?${params}`,
  );
  return JSON.parse(result.manifest) as PodResource;
}

export async function deletePod(
  appName: string,
  podName: string,
  namespace: string,
): Promise<void> {
  const params = new URLSearchParams({
    name: podName,
    namespace,
    kind: "Pod",
    version: "v1",
    force: "false",
  });
  await argocdFetch<unknown>(
    `/api/v1/applications/${encodeURIComponent(appName)}/resource?${params}`,
    { method: "DELETE" },
  );
}
