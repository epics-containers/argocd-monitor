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
