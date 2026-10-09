import { useQuery } from "@tanstack/react-query";
import { getObservabilityConfig } from "@/api/observability-config";

export const OBSERVABILITY_CONFIG_KEY = ["observability-config"] as const;

export function useObservabilityConfig() {
  return useQuery({
    queryKey: OBSERVABILITY_CONFIG_KEY,
    queryFn: getObservabilityConfig,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}
