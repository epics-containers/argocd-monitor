# Keycloak Authentication

This guide covers enabling optional Keycloak OIDC authentication using an
[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) sidecar. When
enabled, users authenticate via Keycloak SSO instead of manually pasting
ArgoCD tokens.

## Prerequisites

- A Keycloak realm with an OIDC client registered for argocd-monitor
- `gpg`, `kubeseal`, and `kubectl` available locally
- Access to the target Kubernetes cluster

## How it works

When `oauth2Proxy.enabled` is `true`, the Helm chart deploys an oauth2-proxy
sidecar container alongside nginx. Traffic flows through the proxy first:

```
Browser -> oauth2-proxy (:4180) -> nginx (:8080) -> ArgoCD API
               |
           Keycloak OIDC
```

The proxy handles the full OIDC login flow with Keycloak. After
authentication, it passes the access token to nginx via the
`X-Forwarded-Access-Token` header. Nginx injects this as an `argocd.token`
cookie when proxying requests to ArgoCD.

The frontend detects the auth mode automatically via the `/api/auth-mode`
endpoint and skips the manual token dialog.

## Step 1: Create the sealed secret

The oauth2-proxy needs a **client secret** (from Keycloak) and a **cookie
secret** (for session encryption). The `seal-secret` just command handles
both:

```bash
just seal-secret <namespace>
```

This will:

1. Prompt you to paste the PGP-encrypted client secret (press Ctrl-D when done)
2. Decrypt it using your GPG key
3. Auto-generate a random cookie secret
4. Create a SealedSecret and apply it to the cluster

The resulting Kubernetes Secret is named `argocd-monitor-oauth2` with two
keys: `client-secret` and `cookie-secret`.

## Step 2: Deploy with oauth2-proxy enabled

### Using `--set` flags

```bash
helm upgrade --install argocd-monitor \
  oci://ghcr.io/epics-containers/charts/argocd-monitor \
  --namespace <namespace> \
  --set argocd.url=https://argocd.example.com \
  --set oauth2Proxy.enabled=true \
  --set oauth2Proxy.clientId=my-client-id \
  --set oauth2Proxy.issuerUrl=https://identity.example.com/realms/my-realm \
  --set oauth2Proxy.existingSecret=argocd-monitor-oauth2 \
  --set ingress.enabled=true \
  --set ingress.host=argocd-monitor.example.com
```

:::{note}
Ingress with a real hostname is required for oauth2-proxy because the OIDC
redirect flow needs a stable callback URL.
:::

### Using a values file

Create a `values-keycloak.yaml`:

```yaml
argocd:
  url: https://argocd.example.com

ingress:
  enabled: true
  host: argocd-monitor.example.com

oauth2Proxy:
  enabled: true
  clientId: my-client-id
  issuerUrl: https://identity.example.com/realms/my-realm
  existingSecret: argocd-monitor-oauth2
```

Then deploy:

```bash
helm upgrade --install argocd-monitor \
  oci://ghcr.io/epics-containers/charts/argocd-monitor \
  --namespace <namespace> \
  -f values-keycloak.yaml
```

## OAuth2 proxy values reference

| Value | Default | Description |
|---|---|---|
| `oauth2Proxy.enabled` | `false` | Enable the oauth2-proxy sidecar |
| `oauth2Proxy.image.repository` | `quay.io/oauth2-proxy/oauth2-proxy` | Proxy container image |
| `oauth2Proxy.image.tag` | `v7.7.1` | Proxy image tag |
| `oauth2Proxy.clientId` | `""` | OIDC client ID from Keycloak |
| `oauth2Proxy.issuerUrl` | `""` | OIDC issuer URL (e.g. `https://identity.example.com/realms/my-realm`) |
| `oauth2Proxy.existingSecret` | `""` | Name of K8s Secret with `client-secret` and `cookie-secret` keys |
| `oauth2Proxy.extraArgs` | `[]` | Additional oauth2-proxy command-line arguments |
| `oauth2Proxy.resources.limits.cpu` | `50m` | CPU limit |
| `oauth2Proxy.resources.limits.memory` | `64Mi` | Memory limit |

## Passing additional oauth2-proxy arguments

Use `oauth2Proxy.extraArgs` for any extra flags:

```yaml
oauth2Proxy:
  extraArgs:
    - --allowed-group=my-team
    - --cookie-expire=12h
```

## Deploying without Keycloak

When `oauth2Proxy.enabled` is `false` (the default), the chart deploys
without the proxy sidecar. Users authenticate by pasting ArgoCD tokens
into the login dialog as before. No secret or additional configuration is
needed.
