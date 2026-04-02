# Keycloak Authentication

This guide covers enabling optional Keycloak OIDC authentication using an
[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) sidecar. When
enabled, users authenticate via Keycloak SSO instead of manually pasting
ArgoCD tokens.

## Prerequisites

- ArgoCD configured with [Dex](https://dexidp.io/) as its OIDC provider,
  with Dex connected to Keycloak as an upstream identity provider
- A Dex static client registered for argocd-monitor (see below)
- `kubeseal` and `kubectl` available locally
- Access to the target Kubernetes cluster

## How it works

When `oauth2Proxy.enabled` is `true`, the Helm chart deploys an oauth2-proxy
sidecar container alongside nginx. Traffic flows through the proxy first:

```{mermaid}
flowchart LR
    Browser -->|":80"| oauth2-proxy
    oauth2-proxy -->|":4180"| nginx
    nginx -->|":8080"| ArgoCD[ArgoCD API]

    subgraph " "
        direction TB
        oauth2-proxy <-->|OIDC| Dex
        Dex <-->|Upstream IdP| Keycloak
    end
```

The proxy handles the full OIDC login flow via ArgoCD's Dex instance, which
in turn authenticates against Keycloak. After authentication, oauth2-proxy
passes the OIDC ID token to nginx via the `Authorization: Bearer` header.
Nginx forwards this header when proxying API requests to ArgoCD, which
validates the token against Dex's JWKS.

The frontend detects the auth mode automatically via the `/api/auth-mode`
endpoint and skips the manual token dialog.

## Dex configuration (required)

The ArgoCD team needs to configure two things in Dex:

### 1. Register a static client for argocd-monitor

Add a static client to ArgoCD's `argocd-cm` ConfigMap under `dex.config`:

```yaml
dex.config: |
  staticClients:
    - id: argocd-monitor
      name: ArgoCD Monitor
      secret: <client-secret>
      redirectURIs:
        - https://argocd-monitor.example.com/oauth2/callback
```

### 2. Enable cross-client trust for the audience claim

ArgoCD only accepts tokens where the `aud` (audience) claim includes its
own client ID (`argocd`). To make Dex include `argocd` in tokens issued to
`argocd-monitor`, add `argocd-monitor` as a trusted peer on the `argocd`
client:

```yaml
dex.config: |
  staticClients:
    - id: argocd
      # ... existing ArgoCD client config ...
      trustedPeers:
        - argocd-monitor
```

Then set the cross-client audience scope when deploying (see step 2 below).

## Step 1: Create the sealed secret

The oauth2-proxy needs a **client secret** (matching the Dex static client)
and a **cookie secret** (for session encryption). Two just commands are
available:

```bash
# If you have a PGP-encrypted client secret:
just seal-secret <namespace>

# If you have the client secret in plaintext:
just seal-secret-plain <namespace>
```

Both will auto-generate a random cookie secret and apply a SealedSecret to
the cluster. The resulting Kubernetes Secret is named `argocd-monitor-oauth2`
with two keys: `client-secret` and `cookie-secret`.

## Step 2: Deploy with oauth2-proxy enabled

### Using `--set` flags

```bash
helm upgrade --install argocd-monitor \
  oci://ghcr.io/epics-containers/charts/argocd-monitor \
  --namespace <namespace> \
  --set argocd.url=https://argocd.example.com \
  --set oauth2Proxy.enabled=true \
  --set oauth2Proxy.clientId=argocd-monitor \
  --set oauth2Proxy.issuerUrl=https://argocd.example.com/api/dex \
  --set oauth2Proxy.existingSecret=argocd-monitor-oauth2 \
  --set ingress.enabled=true \
  --set ingress.host=argocd-monitor.example.com \
  --set 'oauth2Proxy.extraArgs[0]=--scope=openid profile email audience:server:client_id:argocd'
```

The `audience:server:client_id:argocd` scope tells Dex to include `argocd`
in the token's `aud` claim (requires the `trustedPeers` config above).

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
  clientId: argocd-monitor
  issuerUrl: https://argocd.example.com/api/dex
  existingSecret: argocd-monitor-oauth2
  extraArgs:
    - "--scope=openid profile email audience:server:client_id:argocd"
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
| `oauth2Proxy.clientId` | `""` | OIDC client ID registered in Dex |
| `oauth2Proxy.issuerUrl` | `""` | Dex issuer URL (e.g. `https://argocd.example.com/api/dex`) |
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
