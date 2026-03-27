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
  return import.meta.env.VITE_ARGOCD_BASE_URL || "";
}

export async function argocdFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    window.location.href = `${baseUrl}/auth/login`;
    throw new ApiError(response.status, "Unauthenticated");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

export async function argocdFetchStream(
  path: string,
  init?: RequestInit,
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401 || response.status === 403) {
    window.location.href = `${baseUrl}/auth/login`;
    throw new ApiError(response.status, "Unauthenticated");
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
