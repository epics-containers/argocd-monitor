import { useQuery } from "@tanstack/react-query";
import { getBeamlineNamespace } from "@/api/beamline";

export function useBeamlineNamespace() {
  return useQuery({
    queryKey: ["beamline-namespace"],
    queryFn: getBeamlineNamespace,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}
