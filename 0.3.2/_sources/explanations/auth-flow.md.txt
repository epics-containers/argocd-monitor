# Authentication Flow

This page explains how the app authenticates with ArgoCD, from initial
token entry through to automatic refresh and failure recovery.

## Token lifecycle

Authentication starts when a user runs `argocd login --sso` on their
workstation to authenticate via Keycloak, then copies the resulting
`auth-token` and (optionally) `refresh-token` from
`~/.config/argocd/config` into the app's login dialog.

When the user submits tokens in the `TokenDialog`
(`src/components/shared/token-dialog.tsx:23`), `saveTokens()` writes
both values to localStorage **and** sets them as browser cookies
(`src/lib/auth-token.ts:62`). This dual storage is intentional --
localStorage is the durable source of truth, while cookies are needed
because `fetch()` calls use `credentials: "include"` so the browser
automatically attaches them to every API request
(`src/api/argocd-client.ts:67`).

On page load, `applyStoredTokens()` runs at module-import time
(`src/api/argocd-client.ts:9`) to re-sync localStorage values back
into cookies, since cookies may have expired or been cleared by the
browser between sessions.

## Cookie security flags

Cookies are set with `SameSite=Strict` to prevent CSRF, and with
`Secure` when the page is served over HTTPS
(`src/lib/auth-token.ts:9-10`). The `Secure` flag is conditional
because the app may run over plain HTTP during local development.

## Handling 401s: the singleton refresh promise

When any API call returns a 401, the client attempts to refresh the
auth token before giving up. The key design challenge here is
concurrency: if multiple API requests are in flight and they all
receive 401s simultaneously, the app must not fire multiple refresh
requests in parallel.

The solution is a module-level singleton promise
(`src/api/argocd-client.ts:28`). The first 401 that calls
`tryRefreshToken()` creates the promise and stores it in
`refreshPromise`. Any subsequent 401 that arrives while that refresh
is still in progress receives the **same** promise, so all callers
wait on a single network request. The `finally` block clears
`refreshPromise` back to `null` once the attempt settles
(`src/api/argocd-client.ts:52`), allowing future 401s to try again.

If the refresh succeeds, `saveTokens()` writes the new auth token to
both localStorage and cookies, and the original request is retried. If
it fails, the flow falls through to `onAuthFailure()`.

## Asymmetric token clearing on failure

When authentication fails irrecoverably, `onAuthFailure()`
(`src/lib/auth-token.ts:47`) clears only the auth token and its
cookie. The refresh token is deliberately preserved. This means the
`TokenDialog` will re-appear (because the auth token snapshot becomes
falsy), but the refresh token field will still be pre-populated with
the previously stored value. The user only needs to paste a new auth
token rather than re-entering both.

By contrast, `clearStoredToken()` (`src/lib/auth-token.ts:35`) removes
**both** tokens and is used for explicit logout.

## The AuthGate pattern

`AuthGate` (`src/App.tsx:22`) is a thin wrapper around all routes that
uses React's `useSyncExternalStore` to subscribe to the token store.
It reads `getTokenSnapshot()`, which returns a boolean indicating
whether an auth token exists in localStorage.

When the snapshot is `false`, the `TokenDialog` opens as a modal
overlay. Crucially, the child routes are still rendered behind the
dialog -- `AuthGate` does not conditionally unmount them. This avoids
losing React state if a token expires mid-session: the dialog appears,
the user pastes a new token, and the app continues from where it left
off.

After a successful token submission, the `onTokenSubmit` callback
invalidates all React Query caches
(`src/App.tsx:29`), causing every active query to refetch with the new
credentials.

## Why useAuth disables refetchOnWindowFocus

The `useAuth` hook (`src/hooks/use-auth.ts:4`) queries the
`/api/v1/session/userinfo` endpoint to check whether the current
session is valid. It explicitly sets `refetchOnWindowFocus: false`,
overriding the app-wide default of `true`
(`src/App.tsx:17`).

Without this override, every tab switch or window focus would fire a
userinfo request. If the token has expired, that request returns a 401,
which triggers `onAuthFailure()`, which clears the auth token and pops
the login dialog -- even though the user may simply be switching back
to the app. Disabling focus-based refetch for this specific query
prevents the dialog from appearing unexpectedly on every window focus
event when the token is stale.
