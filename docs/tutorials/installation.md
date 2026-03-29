# Installation

## Development with Dev Containers

The easiest way to get started is using a [Dev Container](https://containers.dev/).

### Prerequisites

- [Docker](https://www.docker.com/get-started/) installed and running
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

The project uses [just](https://just.systems/) as its task runner. Run all
checks (lint, test, docs) in parallel before committing:

```bash
just check
```

See {doc}`developer-workflow` for details on all available commands.

## Production Deployment

### Install from OCI registry

The Helm chart is published to the GitHub Container Registry on each tagged
release. Install directly from the OCI registry:

```bash
helm install argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor \
  --set argocd.url=https://argocd.example.com \
  --set ingress.enabled=true \
  --set ingress.host=argocd-monitor.example.com
```

### Install from local chart

Alternatively, install from the source tree:

```bash
helm install argocd-monitor helm/argocd-monitor \
  --set argocd.url=https://argocd.example.com \
  --set ingress.enabled=true \
  --set ingress.host=argocd-monitor.example.com
```

See `helm/argocd-monitor/values.yaml` for the full list of configurable values.
