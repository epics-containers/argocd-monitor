# Environment Variables

## Development Variables

These are used by the Vite dev server (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ARGOCD_AUTH_TOKEN` | ArgoCD auth token cookie value for dev proxy | (required) |
| `VITE_ARGOCD_PROJECT` | Filter to a specific ArgoCD project | (none) |
| `VITE_REFRESH_INTERVAL` | Auto-refresh interval in milliseconds | `30000` |

## Helm Chart Values

Key configuration values for production deployment:

| Value | Description | Default |
|-------|-------------|---------|
| `argocd.url` | ArgoCD instance URL | `https://argocd.diamond.ac.uk` |
| `image.repository` | Container image repository | `ghcr.io/epics-containers/argocd-ioc-monitor` |
| `image.tag` | Container image tag | `appVersion` from Chart.yaml |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.host` | Ingress hostname | (none) |
