# Data Fetching Patterns

This page explains how the app fetches, caches, and streams data from the ArgoCD API using [TanStack React Query](https://tanstack.com/query/latest) and the browser Fetch/Streams APIs.

## Query key hierarchy

React Query uses **query keys** to identify cached data. This app organises keys into a hierarchy that mirrors the API resource model:

| Hook | Query key | Scope |
|---|---|---|
| `useApplications` | `["applications", project]` | All apps, optionally filtered by project |
| `useApplication` | `["application", name, appNamespace]` | Single app metadata |
| `useResourceTree` | `["resourceTree", appName, appNamespace]` | Kubernetes resources owned by one app |

The first element of each key acts as a **category tag**. Because React Query matches keys by prefix, invalidating `["applications"]` (without a project) clears every project-scoped variant too. The mutation hook exploits this -- see the mutation invalidation section below.

Key definitions live alongside the hooks that use them (`src/hooks/use-applications.ts:10`, `src/hooks/use-application.ts:7`, `src/hooks/use-application.ts:15`).

## Polling with refetch intervals

Two hooks set up automatic background polling so the UI stays current without manual refreshes:

- **`useApplications`** refetches every `VITE_REFRESH_INTERVAL` milliseconds (default 30 000) and marks data stale after 10 seconds (`src/hooks/use-applications.ts:4-6`, `src/hooks/use-applications.ts:12-13`).
- **`useResourceTree`** refetches every 15 seconds to keep the pod table up to date (`src/hooks/use-application.ts:18`).

`useApplication` does **not** poll -- the detail page relies on `useResourceTree` for live resource state while the app metadata changes infrequently.

The `VITE_REFRESH_INTERVAL` environment variable lets operators tune polling frequency at build time. A shorter interval gives faster feedback at the cost of higher API load.

## Mutation invalidation

When a user restarts a pod, the `useRestartPod` mutation needs to update three levels of the cache so every view reflects the change. Its `onSuccess` handler (`src/hooks/use-restart-pod.ts:17-26`) invalidates queries in a cascade:

1. `["resourceTree", appName]` -- the pod table for the affected application.
2. `["application", appName]` -- the application detail (health status may change).
3. `["applications"]` -- the top-level application list (sync/health summary columns).

Because keys are matched by prefix, the `["applications"]` invalidation covers all project-filtered variants in a single call. React Query marks these entries as stale and refetches them the next time a component reads them, or immediately if a component is currently mounted.

## Streaming logs with async generators

Log streaming is the most complex data-fetching pattern in the app. It bypasses React Query entirely because log data is an append-only stream, not a cacheable query result.

### The transport layer

`argocdFetchStream` (`src/api/argocd-client.ts:97-127`) returns a raw `ReadableStream<Uint8Array>` from the Fetch API. It handles 401 responses the same way `argocdFetch` does -- attempting a token refresh before giving up.

### The async generator

`streamLogs` (`src/api/logs.ts:14-85`) wraps the readable stream in an **async generator**. It reads chunks from the stream, accumulates them in a text buffer, splits on newline boundaries, and `yield`s each parsed `LogEntry`. This approach:

- Lets the consumer use a simple `for await...of` loop.
- Handles partial JSON lines that span chunk boundaries by keeping a buffer (`src/api/logs.ts:61`).
- Releases the stream reader lock in a `finally` block (`src/api/logs.ts:83`) so the connection is cleaned up regardless of how the loop exits.

### The React hook

`useLogs` (`src/hooks/use-logs.ts:15-90`) manages the stream lifecycle inside a React component:

- **Start/stop** -- the `start` callback creates a new `AbortController`, clears accumulated lines, and kicks off the stream. The `stop` callback aborts the controller, resetting state (`src/hooks/use-logs.ts:26-31`, `src/hooks/use-logs.ts:33-38`).
- **Appending lines** -- each yielded entry is appended to state via `setLines(prev => [...prev, entry.content])` (`src/hooks/use-logs.ts:54`).
- **Auto-reconnect** -- when `follow` mode is enabled and the stream errors (e.g. a transient network failure), the hook retries up to `MAX_RETRIES` (3) times with a 2-second delay between attempts (`src/hooks/use-logs.ts:61-68`). A successful read resets the retry counter (`src/hooks/use-logs.ts:53`), so only *consecutive* failures count towards the limit.

## Cancellation with AbortController

The app uses `AbortController` in two places to cancel in-flight HTTP requests:

1. **Log streaming** -- `useLogs` stores a controller in a ref (`src/hooks/use-logs.ts:19`). Calling `stop()` or unmounting the component aborts the signal, which propagates through `argocdFetchStream` into the underlying `fetch` call. The async generator's `reader.read()` rejects with an `AbortError`, which the hook catches and silently ignores (`src/hooks/use-logs.ts:57-59`).

2. **React Query queries** -- TanStack React Query passes its own `AbortSignal` to query functions automatically. When a component unmounts or a query is cancelled, React Query aborts the signal. The app's `argocdFetch` receives this through the `init` parameter's `signal` property.

This ensures that navigating away from a page does not leave orphaned connections consuming server resources.

## API client and auth retry

All HTTP calls flow through `argocdFetch<T>` (JSON) and `argocdFetchStream`
(streaming) in `src/api/argocd-client.ts`. Both share the same 401-handling
logic: attempt a token refresh, then retry the request once. See
{doc}`/explanations/auth-flow` for details on the singleton refresh promise
and the token lifecycle.
