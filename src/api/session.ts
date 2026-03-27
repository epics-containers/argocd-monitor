import { argocdFetch } from "./argocd-client";
import type { UserInfo } from "@/types/session";

export async function getUserInfo(): Promise<UserInfo> {
  return argocdFetch<UserInfo>("/api/v1/session/userinfo");
}
