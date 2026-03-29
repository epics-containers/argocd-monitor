# CI/CD Pipeline

This page explains how the project's continuous integration and delivery
pipeline works, from local pre-commit checks through to published
container images and Helm charts.

## Pipeline overview

The CI pipeline is defined in `.github/workflows/ci.yml` and is
composed of four reusable workflow files:

```
lint  ──────┬──► container (build & optionally push)
            │
            └──► helm      (package & optionally push)

docs  ────────► build & optionally publish to GitHub Pages
```

Every push to `main`, every pull request, and every tag triggers the
full pipeline. The `lint` job must succeed before `container` and `helm`
run (they depend on it via `needs: lint`). The `docs` job runs
independently with no dependencies.

## Lint, test, and type check

The `_lint.yml` workflow installs Node 22, runs `npm ci`, then executes
three checks in sequence:

1. **ESLint** (`npm run lint`) -- catches style and correctness issues.
2. **TypeScript type check** (`npx tsc --noEmit`) -- ensures the project
   compiles without errors.
3. **Unit tests with coverage** (`npm run test:coverage`) -- runs the
   Vitest suite.

If any step fails the workflow fails, blocking the `container` and
`helm` jobs downstream.

## Container image build and publish

The `_container.yml` workflow builds a Docker image, smoke-tests it, and
conditionally pushes it to the GitHub Container Registry (GHCR).

### Build and test

Every CI run builds the image and loads it into the local Docker daemon.
A quick health check verifies the container starts and serves
`/healthz`:

```yaml
# from _container.yml
docker run -d --name test_container -p 8080:8080 tag_for_testing
curl -sf http://localhost:8080/healthz
```

The build argument `VITE_APP_VERSION` is set to the git tag name on tag
pushes and `dev` otherwise, so the app can display its own version.

### Conditional publishing

The image is only pushed to the registry when **both** conditions are
met:

- The `lint` job passed (`inputs.publish` is true).
- The git ref is a **tag** (`github.ref_type == 'tag'`).

This means pull requests and pushes to `main` build and test the image
but never publish it. Only a tagged release produces a registry image.

The `docker/metadata-action` generates two tags for the published image:
the git tag itself (e.g. `v1.2.3`) and `latest`.

## Helm chart packaging and publish

The `_helm.yml` workflow lints, packages, and conditionally pushes the
Helm chart to an OCI registry.

### Dynamic versioning from git tags

When the pipeline runs on a tag, the chart version is derived by
stripping the leading `v`:

```bash
# from _helm.yml
echo "chart_version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"
```

So a git tag `v1.2.3` produces a Helm chart with `--version 1.2.3
--app-version 1.2.3`. On non-tag runs the chart is packaged with
whatever version is in `Chart.yaml` (useful for local testing).

### Conditional publishing

Like the container image, the chart is only pushed when lint passes and
the ref is a tag:

```yaml
# from _helm.yml
if: inputs.publish && github.ref_type == 'tag'
```

The chart is pushed to `oci://ghcr.io/<owner>/charts` where it can be
installed with:

```bash
helm install argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor --version 1.2.3
```

## Documentation publishing

The `_docs.yml` workflow builds Sphinx documentation and publishes it to
GitHub Pages.

Key details:

- **Tag conflict avoidance** -- when a tag is pushed, the docs job
  sleeps 60 seconds before checkout to avoid git conflicts with a
  simultaneous branch push.
- **Versioned directories** -- each build is placed under a sanitized
  ref name (e.g. `main`, `1.2.3`), so multiple versions coexist on
  the Pages site.
- **Version switcher** -- a `make_switcher.py` script updates
  `switcher.json` so the docs site can offer a version dropdown.
- **Publish condition** -- docs are only published for tags and the
  `main` branch, not for pull requests.

## Pre-commit hooks

The `.pre-commit-config.yaml` file defines hooks that run automatically
on every `git commit`:

| Hook | Source | Purpose |
|------|--------|---------|
| `check-added-large-files` | pre-commit-hooks | Prevent accidental large file commits |
| `check-yaml` | pre-commit-hooks | Validate YAML syntax (Helm templates excluded) |
| `check-merge-conflict` | pre-commit-hooks | Catch unresolved merge markers |
| `end-of-file-fixer` | pre-commit-hooks | Ensure files end with a newline |
| `eslint` | local | Lint and auto-fix JS/TS files |
| `tsc` | local | TypeScript type checking |
| `gitleaks` | gitleaks | Scan for accidentally committed secrets |

These hooks catch common issues before code reaches CI, reducing
round-trip time.

## Local quality gate: `just check`

The `just check` command runs lint, tests, and docs build **in
parallel** using background shell processes:

```bash
# from justfile
just lint & pid_lint=$!
just test & pid_test=$!
just docs & pid_docs=$!
wait $pid_lint  || fail=1
wait $pid_test  || fail=1
wait $pid_docs  || fail=1
```

This mirrors the CI pipeline locally and is the recommended command to
run before committing. It exits non-zero if any of the three jobs fail.

## The release process

Releases follow this workflow:

1. A maintainer creates a **GitHub Release** through the GitHub UI,
   which creates a git tag (e.g. `v1.2.3`).
2. The tag push triggers the CI pipeline.
3. Because the ref is a tag:
   - The container image is built with `VITE_APP_VERSION=v1.2.3` and
     pushed to GHCR with both the version tag and `latest`.
   - The Helm chart is packaged as version `1.2.3` and pushed to the
     OCI chart registry.
   - Documentation is built and published under the version directory.
4. GitHub auto-generates release notes from merged PRs.

Tags should **not** be created manually from the CLI. The GitHub
Releases UI is the single entry point for cutting a release, ensuring
release notes are generated and the tag triggers CI correctly.
