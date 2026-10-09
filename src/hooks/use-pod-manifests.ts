import { useQueries } from "@tanstack/react-query";
import { getPodResource } from "@/api/resources";
import { podKey } from "@/lib/grafana";
import type { PodResource, ResourceNode } from "@/types/resource";

/** Fetch the full manifest for each pod, keyed by podKey(). Pods whose fetch
 *  is pending or failed are absent from the map; `pending` holds the keys of
 *  pods still loading. The fields read (node, hostNetwork, volumes, host IP) are
 *  fixed for a pod's lifetime, so each pod (by uid) is fetched only once. */
export function usePodManifests(
  appName: string,
  pods: ResourceNode[],
  appNamespace?: string,
  enabled = true,
) {
  return useQueries({
    queries: pods.map((pod) => ({
      queryKey: ["pod-manifest", appName, appNamespace, pod.namespace, pod.name, pod.uid],
      queryFn: () => getPodResource(appName, pod.name, pod.namespace, appNamespace),
      enabled: enabled && !!appName,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    })),
    combine: (results) => {
      const manifests: Record<string, PodResource | undefined> = {};
      const pending = new Set<string>();
      results.forEach((r, i) => {
        if (r.data) manifests[podKey(pods[i])] = r.data;
        else if (r.isLoading) pending.add(podKey(pods[i]));
      });
      return { manifests, pending, isLoading: pending.size > 0 };
    },
  });
}
