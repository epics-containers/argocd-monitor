# Nginx Configuration

This guide explains how the nginx reverse proxy is configured to serve the
argocd-monitor SPA and proxy requests to an upstream ArgoCD instance.

## How nginx serves the SPA and proxies API requests

The container runs nginx on port 8080 with two responsibilities:

1. **Serve the React SPA** -- Static files are served from
   `/usr/share/nginx/html`. The catch-all `location /` block uses
   `try_files $uri $uri/ /index.html` so that client-side routes (e.g.
   `/apps/my-app`) always return `index.html` and let React Router handle
   the path.

2. **Reverse-proxy API requests** -- Requests to `/api/`, `/auth/`, and
   `/login` are forwarded to the upstream ArgoCD server. This avoids CORS
   issues because the browser only ever talks to the nginx origin.

Static assets matching common extensions (`.js`, `.css`, `.png`, etc.) are
served with a one-year `Cache-Control: public, immutable` header because Vite
fingerprints their filenames on each build.

A `/healthz` endpoint returns `200 ok` for Kubernetes liveness and readiness
probes.

## Log streaming location block ordering

The nginx config contains two location blocks that match `/api/` paths:

```text
# 1. Regex location -- matched first
location ~ ^/api/v1/applications/[^/]+/logs { ... }

# 2. Prefix location -- matched second
location /api/ { ... }
```

The regex location for log streaming **must appear above** the `/api/`
prefix block. Nginx evaluates locations in a specific order: regex locations
(`~`) are checked in the order they appear in the config file, and the first
regex match wins. If the `/api/` prefix block were the only match, log
streaming requests would go through the generic API proxy, which lacks the
streaming-specific headers and timeouts that logs require.

By placing the regex block first, any request to
`/api/v1/applications/{name}/logs` is handled by the streaming-aware
location, while all other `/api/` requests fall through to the general
proxy.

## Buffering headers for event streams

The log streaming endpoint returns server-sent events (SSE). Two settings
prevent nginx and downstream proxies from buffering the stream:

```nginx
proxy_buffering off;
add_header X-Accel-Buffering no always;
```

- **`proxy_buffering off`** tells nginx itself not to buffer the upstream
  response. Without this, nginx collects the response into memory before
  forwarding it to the client, which defeats the purpose of streaming.

- **`X-Accel-Buffering: no`** is an instruction to any upstream proxy or
  CDN (such as a Kubernetes ingress controller or cloud load balancer) to
  also disable response buffering for this request.

Additionally, `gzip off` is set because compressing a stream forces the
server to buffer enough data to fill a compression block, adding latency.
The `proxy_read_timeout` is extended to 3600 seconds so long-lived log
streams are not prematurely closed.

## DNS resolver configuration

```nginx
resolver 127.0.0.11 8.8.8.8 valid=30s;
set $argocd_url "${ARGOCD_URL}";
```

Using a variable for the upstream URL (`$argocd_url`) forces nginx to
resolve the hostname at request time rather than at startup. This means
nginx can start even if the ArgoCD server is temporarily unreachable.

Two resolvers are configured:

- **`127.0.0.11`** -- The built-in DNS resolver provided by the container
  runtime's embedded DNS server (Podman or Docker). Inside a container
  network or Kubernetes cluster this resolves internal service names.

- **`8.8.8.8`** -- Google's public DNS, used as a fallback. If the
  ArgoCD URL points to an external hostname (not a cluster-internal
  service), the container-internal resolver may not be able to resolve it.
  The external fallback ensures resolution still works.

The `valid=30s` parameter caches DNS results for 30 seconds, balancing
responsiveness to DNS changes against query volume.

```{note}
When deployed via the Helm chart, the ConfigMap renders the ArgoCD URL
directly into `proxy_pass` directives (no variable or resolver), because
the Kubernetes DNS service handles resolution and the URL is known at
deploy time. The resolver configuration only applies to standalone container
usage.
```

## The envsubst pattern and read-only ConfigMap fallback

The Docker entrypoint script (`docker/docker-entrypoint.sh`) bridges the gap
between the template and a running config:

```sh
ARGOCD_URL="${ARGOCD_URL:-https://argocd.diamond.ac.uk}"
ARGOCD_HOST="${ARGOCD_URL#https://}"
ARGOCD_HOST="${ARGOCD_HOST#http://}"
export ARGOCD_URL ARGOCD_HOST

envsubst '${ARGOCD_URL} ${ARGOCD_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf 2>/dev/null || true
```

1. **Default URL** -- If `ARGOCD_URL` is not set, it defaults to
   `https://argocd.diamond.ac.uk`.

2. **Host extraction** -- `ARGOCD_HOST` is derived by stripping the
   protocol prefix, producing a bare hostname for the `Host` header.

3. **`envsubst`** -- Only the two named variables are substituted. This
   is important because the nginx config itself contains `$uri` and other
   nginx variables that must not be replaced.

4. **`|| true` fallback** -- When the Helm chart deploys the container, the
   ConfigMap is mounted directly over `/etc/nginx/conf.d/default.conf` as a
   read-only file. The `envsubst` write fails because the target path is
   read-only, but the `|| true` ensures the entrypoint continues. The
   mounted ConfigMap already contains the fully-rendered config (with the
   ArgoCD URL baked in by Helm), so the template step is not needed.

This dual-mode approach lets the same container image work both in plain
Docker (configured via environment variable) and in Kubernetes (configured
via the Helm ConfigMap).
