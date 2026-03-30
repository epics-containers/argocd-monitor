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
development tools pre-installed. System-level tooling is baked into the Docker
image for faster container starts:

- **Node.js 22** for the React/TypeScript frontend
- **just** task runner for unified dev commands
- **GitHub CLI** (`gh`) for push/PR workflows

The `postCreate.sh` script runs once on first container creation to install
tools and dependencies that change more frequently:

- **Claude Code CLI** for AI-assisted development
- **npm dependencies** via `npm install`
- **Python dependencies** via `uv sync --all-extras`
- **Pre-commit hooks** installed and ready

A separate `postStart.sh` script runs on every container start (including
restarts and reopens). This is necessary because VS Code's Dev Containers
extension copies the host gitconfig into the container *after*
`postCreateCommand` runs, which can re-inject credential helpers that were
already blanked. The `postStart.sh` script resets the credential helper each
time to maintain isolation (see [Credential isolation](#credential-isolation)
below).

## Claude Code Integration

Claude Code is installed in the devcontainer and configured via
`.claude/settings.json`. A `UserPromptSubmit` hook enforces that Claude Code
can only run inside the devcontainer by checking the `$REMOTE_CONTAINERS`
environment variable. This ensures the permission model is always active.

### Protection from Prompt Injection

The devcontainer applies several layers of protection against prompt injection
attacks (malicious instructions hidden in GitHub issues, web content, or
repository files that attempt to misuse Claude's tool access):

(credential-isolation)=
**Credential isolation:**

- `SSH_AUTH_SOCK=""` disables SSH agent forwarding, preventing access to host
  SSH keys
- `postStart.sh` blanks the git credential helper and removes any
  `url.ssh://git@github.com/.insteadOf` rewrite on every container start.
  This must run at start time rather than create time because VS Code's Dev
  Containers extension copies the host gitconfig (including credential helpers
  and URL rewrites) into the container after `postCreateCommand` completes.
  Without this, the SSH rewrite would bypass HTTPS authentication entirely.
  Remote pushes require an explicit fine-grained PAT via `just gh-auth`
  (which wraps `gh auth login` + `gh auth setup-git`)

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

### `just check` vs pre-commit hooks

Both `just check` and the pre-commit hooks run ESLint and `tsc --noEmit`, but
they serve different purposes and the overlap is intentional:

- **Pre-commit hooks** gate each commit. They run only on staged files, apply
  ESLint with `--fix` to auto-correct issues, and include housekeeping checks
  (large files, merge conflicts, end-of-file fixing, gitleaks).
- **`just check`** is a full-project validation. It runs lint, tests, and the
  docs build in parallel — read-only, no `--fix` — intended for manual use
  before committing or as a CI gate.

Removing either would leave a gap: pre-commit catches issues at commit time on
changed files, while `just check` validates the entire project.

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
`just gh-auth`). This is safe under rootless Podman,
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
