import {
  applyStoredTokens,
  getStoredRefreshToken,
  onAuthFailure,
  saveTokens,
} from "@/lib/auth-token";

// Restore cookies from localStorage on module load (e.g. after page refresh)
applyStoredTokens();

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`ArgoCD API error ${status}: ${body}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function getBaseUrl(): string {
  return (import.meta.env.VITE_ARGOCD_BASE_URL as string) || "";
}

/** Singleton refresh promise so concurrent 401s don't race. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/v1/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { token: string };
      if (!data.token) return false;
      saveTokens(data.token, refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function argocdFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getBaseUrl();
  const fetchOpts: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  };

  let response = await fetch(`${baseUrl}${path}`, fetchOpts);

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(`${baseUrl}${path}`, fetchOpts);
    }
    if (response.status === 401) {
      onAuthFailure();
      throw new ApiError(response.status, "Unauthenticated");
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function argocdFetchStream(
  path: string,
  init?: RequestInit,
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = getBaseUrl();
  const fetchOpts: RequestInit = { ...init, credentials: "include" };

  let response = await fetch(`${baseUrl}${path}`, fetchOpts);

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(`${baseUrl}${path}`, fetchOpts);
    }
    if (response.status === 401) {
      onAuthFailure();
      throw new ApiError(response.status, "Unauthenticated");
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  if (!response.body) {
    throw new Error("No response body for streaming");
  }

  return response.body;
}
