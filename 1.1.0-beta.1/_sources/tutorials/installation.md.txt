# Installation

## Development with Dev Containers

The easiest way to get started is using a [Dev Container](https://containers.dev/).

### Prerequisites

- [Podman](https://podman.io/) (recommended) or [Docker](https://www.docker.com/get-started/) installed and running
- [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Steps

1. Clone the repository and open it in VS Code.
2. VS Code will prompt **"Reopen in Container"** — click it.
3. Wait for the container to build. The `postCreate` script will install
   Node.js, npm dependencies, Python dependencies, pre-commit hooks, and
   development tools (Claude Code CLI, just task runner, GitHub CLI).
4. Copy `.env.example` to `.env` and fill in the required values:

   ```bash
   cp .env.example .env
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. The app is available at `http://localhost:5173`.

## Running Checks

Before committing, run `just check` to lint, test, and build docs in
parallel. See {doc}`developer-workflow` for the full set of commands.

## Production Deployment

See {doc}`/how-to/helm-deployment` for Helm installation, configuration,
and Ingress/TLS setup.
