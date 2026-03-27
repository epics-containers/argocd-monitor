import { useQuery } from "@tanstack/react-query";
import { listApplications } from "@/api/applications";

const REFRESH_INTERVAL = Number(
  import.meta.env.VITE_REFRESH_INTERVAL || 30000,
);

export function useApplications(project?: string) {
  return useQuery({
    queryKey: ["applications", project],
    queryFn: () => listApplications(project),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
    select: (data) => data.items ?? [],
  });
}
