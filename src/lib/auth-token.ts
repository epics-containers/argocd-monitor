const TOKEN_KEY = "argocd-token";
const REFRESH_KEY = "argocd-refresh-token";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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

export function saveTokens(authToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, authToken);
  setCookie("argocd.token", authToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
    setCookie("argocd.token.refresh", refreshToken);
  }
  notifyTokenChange();
}
