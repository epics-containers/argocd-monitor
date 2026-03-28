# Devcontainer Features

This project uses a [Dev Container](https://containers.dev/) to provide a
fully configured, reproducible development environment. The setup is derived
from the
[python-copier-template](https://github.com/diamondlightsource/python-copier-template)
pattern used across Diamond Light Source projects, extended for a TypeScript
React application with Claude Code integration.

## Base Image

The Dockerfile uses `ghcr.io/diamondlightsource/ubuntu-devcontainer:noble` as
the base image. This provides a minimal Ubuntu Noble environment with common
development tools pre-installed. The `postCreate.sh` script adds
project-specific tooling on first launch:

- **Node.js 22** for the React/TypeScript frontend
- **Claude Code CLI** for AI-assisted development
- **npm dependencies** via `npm install`
- **Python dependencies** via `uv sync --all-extras`
- **Pre-commit hooks** installed and ready

## Claude Code Integration

Claude Code is installed in the devcontainer and configured via
`.claude/settings.json`. A `UserPromptSubmit` hook enforces that Claude Code
can only run inside the devcontainer by checking the `$REMOTE_CONTAINERS`
environment variable. This ensures the permission model is always active.

### Protection from Prompt Injection

The devcontainer applies several layers of protection against prompt injection
attacks (malicious instructions hidden in GitHub issues, web content, or
repository files that attempt to misuse Claude's tool access):

**Credential isolation:**

- `SSH_AUTH_SOCK=""` disables SSH agent forwarding, preventing access to host
  SSH keys
- The host `~/.gitconfig` is bind-mounted read-only to `/tmp/host-gitconfig`;
  `postCreate.sh` extracts only `user.name` and `user.email` into the
  container's global git config — this allows commits without leaking credential
  helpers, aliases, or other unsafe configuration
- `postCreate.sh` blanks the git credential helper
  (`git config --global credential.helper ''`), which overrides any helper
  injected by VS Code's Dev Containers extension. Remote pushes require an
  explicit fine-grained PAT via `gh auth login` + `gh auth setup-git`

**Scoped GitHub authentication:**

- GitHub CLI auth is persisted in a per-repo Docker volume
  (`gh-auth-${localWorkspaceFolderBasename}`)
- Use a fine-grained PAT scoped to only the repositories needed, rather than a
  broad OAuth token
- The volume isolation means each project gets its own credential scope

**Permission rules in `.claude/settings.json`:**

- **Allow:** file operations, bash commands, web search/fetch
- **Prompt (requires confirmation):** force push, hard reset, SSH/SCP/RSYNC,
  and other network escape vectors
- Destructive or externally-visible operations require human approval

For a deeper discussion of this security pattern, including autonomous
execution in ephemeral containers, see the
[Claude safety documentation](https://diamondlightsource.github.io/robot-arm-sim/main/explanations/claude-safety.html)
in the robot-arm-sim project.

## Linting and Type Checking

### Pre-commit Hooks

Every commit runs through pre-commit hooks defined in
`.pre-commit-config.yaml`:

| Hook                     | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `check-added-large-files`| Prevents accidental commit of large files  |
| `check-yaml`             | Validates YAML syntax (excluding Helm templates) |
| `check-merge-conflict`   | Detects unresolved merge conflict markers  |
| `end-of-file-fixer`      | Ensures files end with a newline           |
| `eslint --fix`           | Lints and auto-fixes TypeScript/JavaScript |
| `tsc --noEmit`           | Full TypeScript type checking              |
| `gitleaks`               | Detects secrets before they reach Git      |

### Type-Aware ESLint

ESLint is configured with `tseslint.configs.recommendedTypeChecked`, which
enables rules that use TypeScript's type information for deeper analysis.
This catches issues that basic linting misses:

- **Floating promises** (`no-floating-promises`) — unhandled async calls that
  silently swallow errors
- **Unsafe `any` usage** (`no-unsafe-return`, `no-unsafe-assignment`) —
  values that bypass type checking entirely
- **Misused promises** (`no-misused-promises`) — passing async functions
  where synchronous callbacks are expected

VS Code is configured (`.vscode/settings.json`) to run ESLint validation on
TypeScript files and auto-fix on save.

### Tox Task Runner

[Tox](https://tox.wiki/) provides reproducible task execution for Python-side
tooling:

```bash
uv run tox -p          # Run all checks in parallel
uv run tox -e pre-commit  # Run pre-commit hooks on all files
uv run tox -e docs     # Build Sphinx documentation
```

## Documentation

Documentation is built with [Sphinx](https://www.sphinx-doc.org/) using the
[PyData theme](https://pydata-sphinx-theme.readthedocs.io/) and
[MyST](https://myst-parser.readthedocs.io/) for Markdown support. Additional
extensions provide:

- **Mermaid diagrams** via `sphinxcontrib-mermaid`
- **Copy buttons** on code blocks via `sphinx_copybutton`
- **Grid layouts** via `sphinx_design`

A live-rebuild mode is available for local development:

```bash
uv run tox -e docs-autobuild
```

### Multi-Version Publishing

The docs CI workflow publishes versioned documentation to GitHub Pages. Each
tagged release and the `main` branch get their own directory, with a
`switcher.json` file generated automatically for the version selector in the
PyData theme.

## CI/CD Pipeline

The GitHub Actions CI pipeline is organised as composable reusable workflows
orchestrated by `ci.yml`:

```{mermaid}
graph LR
    push[Push / PR] --> lint[_lint.yml]
    push --> docs[_docs.yml]
    lint --> container[_container.yml]
    lint --> helm[_helm.yml]
```

### Lint (`_lint.yml`)

Runs ESLint and TypeScript type checking on every push and PR. This is the
gate for all other workflows.

### Container (`_container.yml`)

Builds the Docker image, verifies it starts correctly, and publishes to
`ghcr.io` on tagged releases.

### Helm (`_helm.yml`)

Lints and packages the Helm chart, then pushes to the GitHub OCI registry on
tagged releases. The chart is installable via:

```bash
helm install argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor
```

### Docs (`_docs.yml`)

Builds Sphinx documentation and publishes to GitHub Pages with versioned
directories on `main` and tagged releases.

## Persistent Caches

The devcontainer uses Docker volumes for persistence across container rebuilds:

| Volume                           | Mount       | Purpose                          |
| -------------------------------- | ----------- | -------------------------------- |
| `devcontainer-shared-cache`      | `/cache`    | uv, pre-commit, Python venvs    |
| `gh-auth-${workspaceFolderBase}` | `~/.config/gh` | Per-repo GitHub CLI auth     |

The workspace-specific venv path
(`/cache/venv-for${localWorkspaceFolder}`) prevents conflicts when multiple
projects share the cache volume. Environment variables (`VIRTUAL_ENV`, `PATH`)
activate the venv automatically so `uv run` is not needed for every command.

## Workspace Mounting

The parent directory is mounted as `/workspaces` rather than just the project
directory:

```json
"workspaceMount": "source=${localWorkspaceFolder}/..,target=/workspaces,type=bind"
```

This allows `pip install -e ../sibling-project` for developing against peer
projects. The host's `~/.claude` directory is bind-mounted so Claude Code
configuration and memory persist across container rebuilds.
