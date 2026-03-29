# Environment Variables

## Development Variables

These are used by the Vite dev server (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ARGOCD_AUTH_TOKEN` | ArgoCD auth token cookie value for dev proxy | (required) |
| `VITE_ARGOCD_PROJECT` | Filter to a specific ArgoCD project | (none) |
| `VITE_ARGOCD_HOST` | ArgoCD hostname shown in login instructions | `argocd.diamond.ac.uk` |
| `VITE_ARGOCD_BASE_URL` | Base URL prefix for API requests | `""` (same origin) |
| `VITE_APP_VERSION` | Version shown in header (set by CI from git tag) | `dev` |
| `VITE_REFRESH_INTERVAL` | Auto-refresh interval in milliseconds | `30000` |

## Helm Chart Values

Key configuration values for production deployment:

| Value | Description | Default |
|-------|-------------|---------|
| `argocd.url` | ArgoCD instance URL | `https://argocd.diamond.ac.uk` |
| `image.repository` | Container image repository | `ghcr.io/epics-containers/argocd-monitor` |
| `image.tag` | Container image tag | `appVersion` from Chart.yaml |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.host` | Ingress hostname | (none) |
