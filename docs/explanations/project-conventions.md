# Project Conventions

This project is a showcase for a language-agnostic development template
that combines devcontainer isolation with Claude Code integration. The
conventions documented here are intended to be shared across projects
regardless of language stack — TypeScript, Python, Go, or others — via a
[copier](https://copier.readthedocs.io/) template (extending
[python-copier-template](https://github.com/DiamondLightSource/python-copier-template)).
The goal is a consistent developer experience: anyone who has worked on
one project can pick up another without re-learning the tooling.

See {doc}`claude-code-integration` for the AI-assisted development
pattern that sits on top of these conventions.

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

### `just check` vs pre-commit hooks

Both `just check` and the pre-commit hooks run linting and type checking,
but they serve different purposes and the overlap is intentional:

- **Pre-commit hooks** gate each commit. They run only on staged files,
  apply auto-fixes where possible, and include housekeeping checks (large
  files, merge conflicts, end-of-file fixing, gitleaks, conventional
  commit validation).
- **`just check`** is a full-project validation. It runs lint, tests, and
  the docs build in parallel — read-only, no auto-fix — intended for
  manual use before committing or as a CI gate.

Removing either would leave a gap: pre-commit catches issues at commit
time on changed files, while `just check` validates the entire project.

## Commit messages: Conventional Commits

All projects use [Conventional Commits](https://www.conventionalcommits.org/),
enforced by a `commit-msg` pre-commit hook. The prefix communicates intent
and enables automated changelogs:

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
- **Conventional Commits** — validates commit message format

Language-specific hooks are added per project (e.g. ESLint for TypeScript,
Ruff for Python, golangci-lint for Go).

## CI: GitHub Actions

All projects use a consistent GitHub Actions CI structure with reusable
workflow files:

```
.github/workflows/
├── ci.yml              # Main orchestrator
├── _check.yml          # Lint, type check, and test
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

Every project runs in a [Dev Container](https://containers.dev/) with
**rootless Podman** (or rootless Docker) as the intended runtime. The
security assumptions below rely on unprivileged container execution. The
setup is derived from the
[python-copier-template](https://github.com/diamondlightsource/python-copier-template)
pattern used across Diamond Light Source projects.

### Base image and setup scripts

The devcontainer Dockerfile uses a base image with common development tools
pre-installed. System-level tooling is baked into the image for faster
starts, while tools that change frequently are installed by scripts:

- **`postCreate.sh`** runs once on first container creation — installs
  Claude Code CLI, language dependencies, and pre-commit hooks
- **`postStart.sh`** runs on every container start (including restarts).
  This is necessary because VS Code copies the host gitconfig into the
  container *after* `postCreateCommand`, which can re-inject credential
  helpers. The script resets the credential helper each time to maintain
  isolation.

(credential-isolation)=
### Credential isolation

The devcontainer isolates credentials from the host to limit the blast
radius of prompt injection attacks:

- **`SSH_AUTH_SOCK=""`** disables SSH agent forwarding, preventing access
  to host SSH keys
- **`postStart.sh`** blanks the git credential helper and removes any
  `url.ssh://git@github.com/.insteadOf` rewrite on every start. Without
  this, the SSH rewrite would bypass HTTPS authentication entirely
- **Scoped GitHub PAT** — authentication uses a fine-grained token limited
  to specific repositories, persisted in a per-repo container volume
  (`gh-auth-${localWorkspaceFolderBasename}`). Set up via `just gh-auth`

### Persistent caches

The devcontainer uses container volumes for persistence across rebuilds:

| Volume | Mount | Purpose |
|--------|-------|---------|
| `devcontainer-shared-cache` | `/cache` | uv, pre-commit, Python venvs |
| `gh-auth-${workspaceFolderBase}` | `~/.config/gh` | Per-repo GitHub CLI auth |

The `gh-auth` volume stores a fine-grained PAT. This is safe under
rootless Podman: no daemon socket to compromise, user-owned storage with
standard file permissions, user namespace isolation, and scoped tokens
that limit blast radius.

### Workspace mounting

The parent directory is mounted as `/workspaces` rather than just the
project directory:

```json
"workspaceMount": "source=${localWorkspaceFolder}/..,target=/workspaces,type=bind"
```

This allows `pip install -e ../sibling-project` for developing against
peer projects. The host's `~/.claude` directory is bind-mounted so Claude
Code configuration and memory persist across container rebuilds.

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
