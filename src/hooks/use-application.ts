import { useQuery } from "@tanstack/react-query";
import { getApplication } from "@/api/applications";
import { getResourceTree } from "@/api/resources";

export function useApplication(name: string) {
  return useQuery({
    queryKey: ["application", name],
    queryFn: () => getApplication(name),
    enabled: !!name,
  });
}

export function useResourceTree(appName: string) {
  return useQuery({
    queryKey: ["resourceTree", appName],
    queryFn: () => getResourceTree(appName),
    enabled: !!appName,
    refetchInterval: 15000,
  });
}
