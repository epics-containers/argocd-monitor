import { argocdFetch } from "./argocd-client";
import { getAuthModeSnapshot } from "@/lib/auth-token";
import type { UserInfo } from "@/types/session";

export async function getUserInfo(): Promise<UserInfo> {
  if (getAuthModeSnapshot() === "oauth2-proxy") {
    const res = await fetch("/api/oauth2/userinfo");
    return (await res.json()) as UserInfo;
  }
  return argocdFetch<UserInfo>("/api/v1/session/userinfo");
}
