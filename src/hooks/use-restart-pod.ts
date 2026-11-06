import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePod } from "@/api/resources";

interface RestartParams {
  appName: string;
  podName: string;
  namespace: string;
  appNamespace?: string;
}

export function useRestartPod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appName, podName, namespace, appNamespace }: RestartParams) =>
      deletePod(appName, podName, namespace, appNamespace),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["resourceTree", variables.appName],
      });
      void queryClient.invalidateQueries({
        queryKey: ["application", variables.appName],
      });
      void queryClient.invalidateQueries({
        queryKey: ["applications"],
      });
    },
  });
}

interface RestartAllParams {
  appName: string;
  pods: { name: string; namespace: string }[];
  appNamespace?: string;
}

/**
 * Restart every pod of an application by deleting them all; their
 * controllers recreate them. Equivalent to `ec restart` for a service with
 * several pods.
 */
export function useRestartAllPods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appName, pods, appNamespace }: RestartAllParams) => {
      const results = await Promise.allSettled(
        pods.map((pod) => deletePod(appName, pod.name, pod.namespace, appNamespace)),
      );
      const failed = results.flatMap((r, i) =>
        r.status === "rejected" ? [`${pods[i].name}: ${String(r.reason instanceof Error ? r.reason.message : r.reason)}`] : [],
      );
      if (failed.length > 0) {
        throw new Error(failed.join("; "));
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["resourceTree", variables.appName],
      });
      void queryClient.invalidateQueries({
        queryKey: ["application", variables.appName],
      });
      void queryClient.invalidateQueries({
        queryKey: ["applications"],
      });
    },
  });
}
