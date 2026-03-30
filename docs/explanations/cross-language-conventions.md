# Cross-Language Conventions

These conventions are shared across all projects that follow the
devcontainer + Claude Code pattern described in
{doc}`claude-code-integration`, regardless of whether the project uses
TypeScript, Python, Go, or another stack. The goal is a consistent
developer experience: anyone who has worked on one project can pick up
another without re-learning the tooling.

```{contents}
:local:
:depth: 2
```

## Task runner: just

All projects use [just](https://github.com/casey/just) as the task runner.
`just` is language-agnostic, has no runtime dependencies beyond a single
binary, and uses a simple recipe syntax.

Every project must expose at least these recipes:

| Recipe | Purpose |
|--------|---------|
| `just check` | Run lint, test, and docs in parallel — the local CI equivalent |
| `just lint` | Language-specific linting and type checking |
| `just test` | Run tests with coverage |
| `just docs` | Build Sphinx documentation |
| `just dev` | Start the development server (where applicable) |
| `just build` | Production build (where applicable) |

`just check` is the single command a developer runs before committing.
CI runs the same checks, so a passing `just check` should predict a
passing CI build.

## Commit messages: Conventional Commits

All projects use [Conventional Commits](https://www.conventionalcommits.org/).
The prefix communicates intent and enables automated changelogs:

| Prefix | When to use |
|--------|------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Maintenance (deps, config, CI) |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:` | Adding or updating tests |
| `security:` | Security hardening |

Keep the summary line under 70 characters. Use the body for detail.

## Documentation: Sphinx + MyST + Diataxis

All projects build documentation with [Sphinx](https://www.sphinx-doc.org/)
using [MyST](https://myst-parser.readthedocs.io/) for Markdown support and
the [PyData theme](https://pydata-sphinx-theme.readthedocs.io/).

Documentation follows the [Diataxis](https://diataxis.fr) framework with
four sections:

- **Tutorials** (`docs/tutorials/`) — learning-oriented, get to a working
  result
- **How-to guides** (`docs/how-to/`) — task-oriented, practical steps for
  experienced users
- **Explanations** (`docs/explanations/`) — understanding-oriented, how and
  why things work
- **Reference** (`docs/reference/`) — information-oriented, precise
  technical specifications

CI treats Sphinx warnings as errors (`--fail-on-warning`). New pages must
be added to the appropriate `toctree` or the build will fail.

## Pre-commit hooks

All projects use [pre-commit](https://pre-commit.com/) to catch issues at
commit time. The standard hooks across all languages:

- **Large file detection** — prevents accidental binary commits
- **YAML validation** — catches syntax errors in config files
- **Merge conflict markers** — blocks commits with unresolved conflicts
- **End-of-file fixing** — ensures consistent file endings
- **Gitleaks** — scans for hardcoded secrets

Language-specific hooks are added per project (e.g. ESLint for TypeScript,
Ruff for Python, golangci-lint for Go).

## CI: GitHub Actions

All projects use a consistent GitHub Actions CI structure with reusable
workflow files:

```
.github/workflows/
├── ci.yml              # Main orchestrator
├── _lint.yml           # Linting and type checking
├── _test.yml           # Tests (with coverage)
├── _container.yml      # Docker image build and publish
├── _docs.yml           # Sphinx docs build and GitHub Pages deploy
├── _helm.yml           # Helm chart packaging (if applicable)
└── _release.yml        # GitHub Release creation
```

The `ci.yml` workflow orchestrates: lint → test → container → docs →
release. Container images and Helm charts are published only on tagged
releases.

## Releases: GitHub Releases

Releases are created via the GitHub Releases UI with auto-generated
release notes. **Never tag manually from the CLI** — the tag is created by
the release and triggers CI to publish artifacts (container images, Helm
charts, PyPI packages).

## Dependency updates: Renovate

All projects use [Renovate](https://docs.renovatebot.com/) for automated
dependency updates. Minor and patch updates are auto-merged when tests
pass. Major updates create PRs for manual review.

## Git workflow

- **Never push directly to main** — all changes go through pull requests
- PRs are the unit of review and the trigger for CI

## Devcontainer

Every project runs in a [Dev Container](https://containers.dev/) with:

- Language tooling and dependencies pre-installed
- Claude Code CLI installed in `postCreate.sh`
- Credential isolation (see {doc}`claude-code-integration`)
- Persistent caches for package managers and pre-commit

See {doc}`devcontainer-features` for the full setup.

## What varies per language

The conventions above are universal. The following are language-specific
choices that each project makes independently:

| Concern | TypeScript | Python | Go |
|---------|-----------|--------|-----|
| Linter | ESLint + tsc | Ruff + Pyright | golangci-lint |
| Test runner | vitest | pytest | go test |
| Package manager | npm | uv | go modules |
| Formatter | ESLint | Ruff | gofmt |
| Devcontainer base | ubuntu-devcontainer + Node.js | ubuntu-devcontainer | mcr.microsoft.com/devcontainers/go |

The `justfile` recipes wrap these language-specific tools so that the
top-level commands (`just check`, `just test`, etc.) remain the same
everywhere.
