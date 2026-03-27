import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePod } from "@/api/resources";

interface RestartParams {
  appName: string;
  podName: string;
  namespace: string;
}

export function useRestartPod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appName, podName, namespace }: RestartParams) =>
      deletePod(appName, podName, namespace),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["resourceTree", variables.appName],
      });
      queryClient.invalidateQueries({
        queryKey: ["application", variables.appName],
      });
      queryClient.invalidateQueries({
        queryKey: ["applications"],
      });
    },
  });
}
