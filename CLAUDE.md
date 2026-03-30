# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
just --list          # Show all available commands
just check           # Run lint, test, docs in parallel — do this before committing
just lint            # ESLint + TypeScript type check
just test            # Run vitest with coverage
just docs            # Build Sphinx documentation
just dev             # Start Vite dev server on http://localhost:5173
just build           # Production build
```

Pre-commit hooks run automatically on commit: ESLint with `--fix`, `tsc --noEmit`, gitleaks, YAML validation, and end-of-file fixing.

**IMPORTANT: If you changed or added any file under `docs/`, you MUST run `just docs` and confirm it succeeds BEFORE committing.** New pages must be added to the appropriate `toctree` in the parent index (e.g. `docs/explanations.md`) or the build will fail with a `toc.not_included` warning. CI treats Sphinx warnings as errors.

## Architecture

React 19 + TypeScript + Vite SPA that monitors ArgoCD applications via its REST API. Uses TanStack React Query for server state and React Router for navigation.

### Data Flow

API clients (`src/api/`) → React Query hooks (`src/hooks/`) → Page components (`src/pages/`)

- `argocdFetch<T>()` and `argocdFetchStream()` in `argocd-client.ts` handle all HTTP requests, including automatic token refresh on 401 via a singleton promise to prevent races
- Hooks wrap API calls with React Query for caching, refetching, and mutations
- Pages compose hooks and pass data to presentational components

### Routes

- `/` → `ApplicationsPage` — sortable/filterable table of all ArgoCD apps
- `/apps/:name` → `ApplicationDetailPage` — app metadata, pod table with images/age/health
- `/apps/:name/logs/:podName` → `LogsPage` — streaming pod logs with container selection

### Auth

Token management lives in `src/lib/auth-token.ts`. Tokens are stored in localStorage and synced to cookies. The `AuthGate` in `App.tsx` shows a `TokenDialog` when no token is present. On 401, the client attempts refresh via `/api/v1/session` before clearing credentials.

### Key Conventions

- UI primitives in `src/components/ui/` are shadcn-style — edit but don't rewrite
- ESLint uses `recommendedTypeChecked` — all promises must be handled (use `void` for fire-and-forget)
- `import.meta.env` values are `any` — cast to `string` when accessing
- Helm chart lives in `helm/argocd-monitor/`
- Dev proxy in `vite.config.ts` forwards `/api/` and `/auth/` to ArgoCD

## Git Workflow

- **NEVER push directly to main.** All changes go through PRs.
- **Releases:** Push a git tag (e.g. `git tag v1.2.3 && git push origin v1.2.3`). CI publishes the container image, Helm chart, and creates a GitHub Release with auto-generated notes.

## Deployment

Docker container with nginx serving the SPA and proxying API requests. Helm chart published to `oci://ghcr.io/epics-containers/charts/argocd-monitor`. CI runs lint → container build → helm package → docs publish.
