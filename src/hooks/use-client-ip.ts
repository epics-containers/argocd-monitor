import { useQuery } from "@tanstack/react-query";
import { getClientIp } from "@/api/client-ip";

export function useClientIp() {
  const query = useQuery({
    queryKey: ["client-ip"],
    queryFn: getClientIp,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  return { ip: query.data };
}
