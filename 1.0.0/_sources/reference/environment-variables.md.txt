# Environment Variables

## Development Variables

These are used by the Vite dev server (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ARGOCD_AUTH_TOKEN` | ArgoCD auth token cookie value for dev proxy (dev only) | (required for dev) |
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
| `replicaCount` | Number of pod replicas | `1` |
| `service.type` | Kubernetes service type | `LoadBalancer` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.host` | Ingress hostname | (none) |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.tls` | TLS configuration | `[]` |
| `resources.limits.cpu` | CPU limit | `100m` |
| `resources.limits.memory` | Memory limit | `128Mi` |
| `resources.requests.cpu` | CPU request | `50m` |
| `resources.requests.memory` | Memory request | `64Mi` |
