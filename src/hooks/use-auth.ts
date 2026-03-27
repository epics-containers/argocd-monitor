import { useQuery } from "@tanstack/react-query";
import { getUserInfo } from "@/api/session";

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "userinfo"],
    queryFn: getUserInfo,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isAuthenticated: query.data?.loggedIn ?? false,
    error: query.error,
  };
}
