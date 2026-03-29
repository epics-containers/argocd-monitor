# Developer Workflow

This project uses [just](https://just.systems/) as its task runner. All
common development tasks are available as `just` recipes. Run `just --list`
to see them all.

## Before committing

Run all checks (lint, test, docs) in parallel:

```bash
just check
```

This is the single command to run before every commit. It catches lint
errors, type errors, test failures, and broken documentation in one go.

## Available commands

### Code quality

```bash
just lint          # ESLint + TypeScript type check
just test          # Run vitest with coverage report
just test-watch    # Run vitest in watch mode (re-runs on file change)
just pre-commit    # Run all pre-commit hooks on every file
```

`just lint` runs ESLint with type-aware rules followed by a full TypeScript
type check. Pre-commit hooks run these automatically on `git commit`, but
`just lint` lets you check without committing.

`just test` runs the full test suite and prints a coverage table showing
which source files are tested and which lines are missed.

### Documentation

```bash
just docs          # Build Sphinx docs (fails on warnings)
just docs-watch    # Live-rebuild docs in browser on file change
```

`just docs` builds to `build/html/`. CI treats Sphinx warnings as errors,
so always run this before committing documentation changes.

`just docs-watch` starts a local server with auto-reload — useful when
writing or editing docs.

### Development

```bash
just dev           # Start Vite dev server on http://localhost:5173
just build         # Production build (type check + Vite build)
```

`just dev` starts the Vite dev server with hot module replacement and a
proxy that forwards `/api/` and `/auth/` requests to ArgoCD. You need a
valid `ARGOCD_AUTH_TOKEN` in your `.env` file (see {doc}`installation`).

## Typical workflow

1. Make your changes
2. Run `just check` to verify everything passes
3. Commit — pre-commit hooks will run automatically
4. Push and create a PR

If you're only working on docs, `just docs-watch` gives you a fast
feedback loop without running the full check suite.

If you're iterating on tests, `just test-watch` re-runs affected tests
on every save.
