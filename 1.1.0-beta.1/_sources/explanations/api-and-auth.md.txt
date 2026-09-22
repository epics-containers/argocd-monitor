# API and Authentication

This page explains how the app communicates with the ArgoCD API —
authentication, data fetching, caching, and log streaming.

```{contents}
:local:
:depth: 2
```

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

### Cookie security flags

Cookies are set with `SameSite=Strict` to prevent CSRF, and with
`Secure` when the page is served over HTTPS
(`src/lib/auth-token.ts:9-10`). The `Secure` flag is conditional
because the app may run over plain HTTP during local development.

### Handling 401s: the singleton refresh promise

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

### Asymmetric token clearing on failure

When authentication fails irrecoverably, `onAuthFailure()`
(`src/lib/auth-token.ts:47`) clears only the auth token and its
cookie. The refresh token is deliberately preserved. This means the
`TokenDialog` will re-appear (because the auth token snapshot becomes
falsy), but the refresh token field will still be pre-populated with
the previously stored value. The user only needs to paste a new auth
token rather than re-entering both.

By contrast, `clearStoredToken()` (`src/lib/auth-token.ts:35`) removes
**both** tokens and is used for explicit logout.

### The AuthGate pattern

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

### Why useAuth disables refetchOnWindowFocus

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

## Data fetching with React Query

All HTTP calls flow through `argocdFetch<T>` (JSON) and
`argocdFetchStream` (streaming) in `src/api/argocd-client.ts`. Both
share the same 401-handling logic described above.

### Query key hierarchy

React Query uses **query keys** to identify cached data. This app
organises keys into a hierarchy that mirrors the API resource model:

| Hook | Query key | Scope |
|---|---|---|
| `useApplications` | `["applications", project]` | All apps, optionally filtered by project |
| `useApplication` | `["application", name, appNamespace]` | Single app metadata |
| `useResourceTree` | `["resourceTree", appName, appNamespace]` | Kubernetes resources owned by one app |

The first element of each key acts as a **category tag**. Because React
Query matches keys by prefix, invalidating `["applications"]` (without
a project) clears every project-scoped variant too.

Key definitions live alongside the hooks that use them
(`src/hooks/use-applications.ts:10`, `src/hooks/use-application.ts:7`,
`src/hooks/use-application.ts:15`).

### Polling with refetch intervals

Two hooks set up automatic background polling so the UI stays current
without manual refreshes:

- **`useApplications`** refetches every `VITE_REFRESH_INTERVAL`
  milliseconds (default 30 000) and marks data stale after 10 seconds.
- **`useResourceTree`** refetches every 15 seconds to keep the pod
  table up to date.

`useApplication` does **not** poll -- the detail page relies on
`useResourceTree` for live resource state while the app metadata
changes infrequently.

### Mutation invalidation

When a user restarts a pod, the `useRestartPod` mutation needs to
update three levels of the cache so every view reflects the change. Its
`onSuccess` handler (`src/hooks/use-restart-pod.ts:17-26`) invalidates
queries in a cascade:

1. `["resourceTree", appName]` -- the pod table for the affected
   application.
2. `["application", appName]` -- the application detail (health status
   may change).
3. `["applications"]` -- the top-level application list (sync/health
   summary columns).

Because keys are matched by prefix, the `["applications"]` invalidation
covers all project-filtered variants in a single call.

## Streaming logs

Log streaming is the most complex data-fetching pattern in the app. It
bypasses React Query entirely because log data is an append-only stream,
not a cacheable query result.

### The transport layer

`argocdFetchStream` (`src/api/argocd-client.ts:97-127`) returns a raw
`ReadableStream<Uint8Array>` from the Fetch API. It handles 401
responses the same way `argocdFetch` does -- attempting a token refresh
before giving up.

### The async generator

`streamLogs` (`src/api/logs.ts:14-85`) wraps the readable stream in an
**async generator**. It reads chunks from the stream, accumulates them
in a text buffer, splits on newline boundaries, and `yield`s each
parsed `LogEntry`. This approach:

- Lets the consumer use a simple `for await...of` loop.
- Handles partial JSON lines that span chunk boundaries by keeping a
  buffer (`src/api/logs.ts:61`).
- Releases the stream reader lock in a `finally` block
  (`src/api/logs.ts:83`) so the connection is cleaned up regardless of
  how the loop exits.

### The React hook

`useLogs` (`src/hooks/use-logs.ts:15-90`) manages the stream lifecycle
inside a React component:

- **Start/stop** -- the `start` callback creates a new
  `AbortController`, clears accumulated lines, and kicks off the stream.
  The `stop` callback aborts the controller, resetting state.
- **Appending lines** -- each yielded entry is appended to state via
  `setLines(prev => [...prev, entry.content])`.
- **Auto-reconnect** -- when `follow` mode is enabled and the stream
  errors, the hook retries up to `MAX_RETRIES` (3) times with a
  2-second delay between attempts. A successful read resets the retry
  counter, so only *consecutive* failures count towards the limit.

## Cancellation with AbortController

The app uses `AbortController` in two places to cancel in-flight HTTP
requests:

1. **Log streaming** -- `useLogs` stores a controller in a ref. Calling
   `stop()` or unmounting the component aborts the signal, which
   propagates through `argocdFetchStream` into the underlying `fetch`
   call. The async generator's `reader.read()` rejects with an
   `AbortError`, which the hook catches and silently ignores.

2. **React Query queries** -- TanStack React Query passes its own
   `AbortSignal` to query functions automatically. When a component
   unmounts or a query is cancelled, React Query aborts the signal. The
   app's `argocdFetch` receives this through the `init` parameter's
   `signal` property.

This ensures that navigating away from a page does not leave orphaned
connections consuming server resources.
