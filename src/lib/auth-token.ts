const TOKEN_KEY = "argocd-token";
const REFRESH_KEY = "argocd-refresh-token";

// Auth mode detection — cached after first fetch
let authModeCache: AuthMode | null = null;
const authModeListeners = new Set<() => void>();

export type AuthMode = "oauth2-proxy" | "manual" | "anonymous";

export function subscribeAuthMode(cb: () => void) {
  authModeListeners.add(cb);
  return () => { authModeListeners.delete(cb); };
}

export function getAuthModeSnapshot(): AuthMode | null {
  return authModeCache;
}

export async function fetchAuthMode(): Promise<AuthMode> {
  if (authModeCache) return authModeCache;
  try {
    const res = await fetch("/api/auth-mode");
    const data = (await res.json()) as { mode: AuthMode };
    authModeCache = data.mode;
  } catch {
    authModeCache = "manual";
  }
  authModeListeners.forEach((l) => l());
  return authModeCache;
}

function isSecureContext() {
  return location.protocol === "https:";
}

function setCookie(name: string, value: string) {
  const secure = isSecureContext() ? ";Secure" : "";
  document.cookie = `${name}=${value};path=/;SameSite=Strict${secure}`;
}

function deleteCookie(name: string) {
  const secure = isSecureContext() ? ";Secure" : "";
  document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

// Reactive token store — components can subscribe via useSyncExternalStore
const tokenListeners = new Set<() => void>();
function notifyTokenChange() {
  tokenListeners.forEach((l) => l());
}
export function subscribeToken(cb: () => void) {
  tokenListeners.add(cb);
  return () => { tokenListeners.delete(cb); };
}
export function getTokenSnapshot(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  deleteCookie("argocd.token");
  deleteCookie("argocd.token.refresh");
  notifyTokenChange();
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function onAuthFailure(): void {
  // Only clear the auth token; preserve the refresh token so the user
  // doesn't have to re-enter it in the login dialog.
  localStorage.removeItem(TOKEN_KEY);
  deleteCookie("argocd.token");
  notifyTokenChange();
}

export function applyStoredTokens(): void {
  const token = localStorage.getItem(TOKEN_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (token) setCookie("argocd.token", token);
  if (refresh) setCookie("argocd.token.refresh", refresh);
}

/** Redirect to oauth2-proxy sign-in page for re-authentication.
 *  Returns false (and skips redirect) if already redirected recently to avoid loops. */
let lastRedirectTime = 0;
export function redirectToLogin(): boolean {
  const now = Date.now();
  if (now - lastRedirectTime < 30_000) return false;
  lastRedirectTime = now;
  const rd = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/oauth2/sign_in?rd=${rd}`;
  return true;
}

export function saveTokens(authToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, authToken);
  setCookie("argocd.token", authToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
    setCookie("argocd.token.refresh", refreshToken);
  }
  notifyTokenChange();
}
