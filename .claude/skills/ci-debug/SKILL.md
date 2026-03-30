---
name: ci-debug
description: "Guidance for investigating CI failures, reproducing locally, and reading workflow logs. TRIGGER when: CI fails, user mentions a failed check or workflow, or asks about reproducing a CI issue locally."
---

> **Generic skill** — This skill is project-agnostic. Do not add project-specific
> references, paths, or terminology here.

# CI Debug

Guidance for investigating CI failures and reproducing them locally.

## Step 1 — Read the failure

Use `gh` to fetch the failing workflow run and identify which job failed:

```bash
gh run list --limit 5                    # find the run ID
gh run view <run-id>                     # see job-level status
gh run view <run-id> --log-failed        # show only failed step logs
```

Focus on the **first** failure — later jobs often fail as a cascade.

## Step 2 — Reproduce locally

Most projects have a single command that mirrors CI:

| Runner | Command |
|--------|---------|
| just | `just check` |
| tox | `tox -p` or `uv run tox -p` |
| make | `make ci` |

Run it locally inside the devcontainer. If the failure doesn't reproduce,
check for environment differences (Python/Node/Go version, OS, missing
system dependencies).

## Step 3 — Common failure patterns

**Lint / type-check failures:**
- Run the linter in isolation (e.g. `just lint`, `tox -e pre-commit`, `make lint`)
- Check if auto-fix is available (e.g. `eslint --fix`, `ruff check --fix`)
- Type errors often come from missing type stubs or strictness upgrades

**Test failures:**
- Run the specific failing test: `pytest tests/test_foo.py::test_bar -xvs`
  or `go test -v -run TestFoo ./pkg/...` or `npx vitest run src/test/foo.test.tsx`
- Check for flaky tests: race conditions, time-dependent assertions, port conflicts
- Look for missing test fixtures or environment variables

**Docs build failures:**
- Sphinx treats warnings as errors in CI (`--fail-on-warning`)
- Common causes: new pages not added to a `toctree`, broken cross-references,
  invalid MyST syntax
- Run the docs build locally with the same flags

**Container build failures:**
- Check Dockerfile COPY paths match the actual file locations
- Check for missing build args or changed base images
- Run `docker build .` locally (or equivalent)

**Dependency failures:**
- Lock file out of sync: regenerate with `uv lock`, `npm install`, or `go mod tidy`
- Renovate PRs can introduce breaking changes — check the PR diff

## Step 4 — Fix and verify

1. Make the fix
2. Run the full local check command to verify
3. Commit and push — watch CI to confirm the fix
