# Devcontainer Features

This project uses a [Dev Container](https://containers.dev/) to provide a
fully configured, reproducible development environment. The intended runtime
is **rootless Podman** (or rootless Docker) — the security assumptions in
this document rely on unprivileged container execution. The setup is derived
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
- **just** task runner for unified dev commands
- **GitHub CLI** (`gh`) for push/PR workflows
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
- `postCreate.sh` blanks the git credential helper
  (`git config --global credential.helper ''`), which overrides any helper
  injected by VS Code's Dev Containers extension. Remote pushes require an
  explicit fine-grained PAT via `gh auth login` + `gh auth setup-git`

**Scoped GitHub authentication:**

- GitHub CLI auth is persisted in a per-repo container volume
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

## Linting, Testing, and CI/CD

Pre-commit hooks, the just task runner, and the CI/CD pipeline are covered in
detail elsewhere:

- {doc}`/tutorials/developer-workflow` — all `just` commands and the typical
  dev loop
- {doc}`/explanations/ci-cd-pipeline` — GitHub Actions workflows, container
  publishing, and Helm chart versioning

ESLint uses `tseslint.configs.recommendedTypeChecked` for type-aware rules
(floating promises, unsafe `any`, misused promises). VS Code is configured
(`.vscode/settings.json`) to run ESLint on save.

Documentation is built with [Sphinx](https://www.sphinx-doc.org/) using the
[PyData theme](https://pydata-sphinx-theme.readthedocs.io/) and
[MyST](https://myst-parser.readthedocs.io/) for Markdown support, with
extensions for Mermaid diagrams, copy buttons, and grid layouts.

## Persistent Caches

The devcontainer uses container volumes for persistence across rebuilds:

| Volume                           | Mount       | Purpose                          |
| -------------------------------- | ----------- | -------------------------------- |
| `devcontainer-shared-cache`      | `/cache`    | uv, pre-commit, Python venvs    |
| `gh-auth-${workspaceFolderBase}` | `~/.config/gh` | Per-repo GitHub CLI auth     |

The workspace-specific venv path
(`/cache/venv-for${localWorkspaceFolder}`) prevents conflicts when multiple
projects share the cache volume. Environment variables (`VIRTUAL_ENV`, `PATH`)
activate the venv automatically so `uv run` is not needed for every command.

### GitHub CLI credentials in a volume

The `gh-auth` volume stores a fine-grained PAT (set up via
`gh auth login` + `gh auth setup-git`). This is safe under rootless Podman,
which is the intended runtime for this devcontainer:

- **No daemon socket** — there is no privileged Docker socket to compromise.
  Each developer runs their own unprivileged `podman` process.
- **User-owned storage** — volumes live under
  `~/.local/share/containers/storage/volumes/`, owned by the host user with
  standard file permissions. Accessing them requires the user's login
  credentials.
- **User namespace isolation** — container processes run in a subordinate UID
  range, so even a container escape lands in an unprivileged namespace.
- **Scoped PATs** — fine-grained tokens are limited to specific repositories,
  reducing blast radius if a token is ever leaked.

The PAT in the volume is effectively as secure as any other file in the
user's home directory (e.g. `~/.ssh/`, browser cookies).

## Workspace Mounting

The parent directory is mounted as `/workspaces` rather than just the project
directory:

```json
"workspaceMount": "source=${localWorkspaceFolder}/..,target=/workspaces,type=bind"
```

This allows `pip install -e ../sibling-project` for developing against peer
projects. The host's `~/.claude` directory is bind-mounted so Claude Code
configuration and memory persist across container rebuilds.
