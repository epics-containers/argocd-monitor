# Helm Deployment

This guide covers deploying argocd-monitor to Kubernetes using the Helm
chart published at `oci://ghcr.io/epics-containers/charts/argocd-monitor`.

## Chart overview

The `argocd-monitor` chart (type: `application`) deploys:

- A **Deployment** running the nginx-based SPA container
- A **ConfigMap** containing the rendered nginx configuration
- A **Service** exposing the deployment
- An optional **Ingress** for external access

Install the chart:

```bash
helm install argocd-monitor \
  oci://ghcr.io/epics-containers/charts/argocd-monitor \
  --set argocd.url=https://argocd.example.com
```

## Key values and customization

| Value | Default | Description |
|---|---|---|
| `image.repository` | `ghcr.io/epics-containers/argocd-monitor` | Container image |
| `image.tag` | `""` (uses `appVersion`) | Image tag override |
| `replicaCount` | `1` | Number of pod replicas |
| `argocd.url` | `https://argocd.diamond.ac.uk` | ArgoCD instance to proxy to |
| `service.type` | `LoadBalancer` | Kubernetes service type |
| `service.port` | `80` | Service port |
| `ingress.enabled` | `false` | Enable Ingress resource |
| `resources.limits.cpu` | `100m` | CPU limit |
| `resources.limits.memory` | `128Mi` | Memory limit |

The most important value is `argocd.url` -- this controls which ArgoCD
server the nginx proxy forwards API requests to.

## Automatic pod restart on ConfigMap changes

The Deployment template includes an annotation that triggers a rolling
restart whenever the nginx ConfigMap changes:

```yaml
metadata:
  annotations:
    checksum/nginx-config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```

Helm computes the SHA-256 hash of the rendered ConfigMap. When `argocd.url`
or any other config value changes, the hash changes, causing the pod spec
to differ from the running version. Kubernetes then performs a rolling
update to pick up the new configuration.

Without this annotation, updating a ConfigMap alone would not restart the
pods -- Kubernetes does not watch for ConfigMap content changes by default.

## How the ConfigMap renders the nginx config

The ConfigMap template renders the full nginx server block at deploy time,
substituting Helm values directly:

```yaml
proxy_pass {{ .Values.argocd.url }};
proxy_set_header Host {{ .Values.argocd.url | trimPrefix "https://" | trimPrefix "http://" }};
```

This differs from the Docker entrypoint approach (which uses `envsubst` at
container startup). In Kubernetes the URL is known at deploy time, so Helm
bakes it into the config. The ConfigMap is mounted read-only at
`/etc/nginx/conf.d/default.conf`, and the entrypoint's `envsubst` step
silently skips (via `|| true`) since the file is already present and
read-only.

The ConfigMap version also omits the `resolver` directive because
Kubernetes provides DNS resolution through kube-dns / CoreDNS, and the
`proxy_pass` value is a literal URL rather than an nginx variable, so nginx
resolves it at startup.

## Ingress and TLS configuration

Ingress is disabled by default. To expose the dashboard externally, enable
it and set a hostname:

```yaml
ingress:
  enabled: true
  className: nginx
  host: argocd-monitor.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    - secretName: argocd-monitor-tls
      hosts:
        - argocd-monitor.example.com
```

The Ingress routes all traffic (`path: /`, `pathType: Prefix`) to the
service's `http` port. The `className` field selects which Ingress
controller handles the resource. TLS configuration accepts the standard
Kubernetes `tls` array -- pair it with cert-manager or a pre-provisioned
Secret to terminate HTTPS at the ingress.

The Service defaults to type `LoadBalancer`. If you enable Ingress, you
will typically want to change the Service type to `ClusterIP` so the
dashboard is only reachable through the Ingress:

```yaml
service:
  type: ClusterIP
```
