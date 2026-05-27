---
name: helm-chart
description: "Helm chart conventions: values schema generation, Chart.yaml versioning, template patterns. TRIGGER when: editing files under helm/ or Charts/, working with Helm values or templates, or discussing Helm chart packaging."
---

> **Generic skill** — This skill is project-agnostic. Do not add project-specific
> references, paths, or terminology here.

# Helm Chart Conventions

## Values schema generation

All Helm charts use the
[helm-values-schema-json](https://github.com/losisin/helm-values-schema-json)
plugin to generate a JSON Schema from `values.yaml`. This enables IDE
autocompletion and validation for anyone writing values overrides.

### How it works

1. `values.yaml` contains `@schema` annotations as inline comments
2. A `.schema.config.yaml` in the chart directory configures the generator
3. A pre-commit hook regenerates the schema on every commit
4. The generated `values.schema.json` is committed to the repo

### Schema annotations

Add `@schema` comments above or inline with values:

```yaml
# @schema description: The ArgoCD instance URL
# @schema pattern: ^https?://
url: https://argocd.example.com

# @schema description: Service type
# @schema enum: [ClusterIP, LoadBalancer, NodePort]
type: LoadBalancer

# @schema description: Number of replicas
# @schema minimum: 1
replicaCount: 1
```

### Regenerating the schema

The schema regenerates automatically via pre-commit. To run manually:

```bash
helm schema --config helm/<chart-name>/.schema.config.yaml
```

### YAML language server integration

Add this as the first line of `values.yaml` for IDE validation:

```yaml
# yaml-language-server: $schema=values.schema.json
```

### Array-of-objects gotcha

`noAdditionalProperties: true` in `.schema.config.yaml` propagates into
array item schemas. If you declare `# @schema item: object` for an array
whose entries have specific keys (`[{cidr, namespace}, …]`), the
generated item schema becomes `{"type":"object","additionalProperties":false}`
with no `properties` — so **every** real entry fails validation. The
plugin also won't accept a JSON-blob `# @schema item: {"type":"object",…}`
annotation; it parses the first token as the type.

Workaround: leave such arrays as `# @schema type: array` only, without
`item`. You lose item-shape validation but Helm template rendering
surfaces missing keys clearly enough.

## Nginx behind a localhost sidecar

When the chart ships nginx with an in-pod sidecar (oauth2-proxy, a
service-mesh proxy, etc.) that forwards traffic over loopback, the
immediate peer nginx sees is `127.0.0.1`. nginx's `real_ip` module only
consults `X-Forwarded-For` when the immediate peer is listed in
`set_real_ip_from`. Trusting only the cluster pod CIDR (e.g.
`10.0.0.0/8`) is not enough.

Always include `127.0.0.1` (or `127.0.0.0/8`) in `set_real_ip_from`
when any server-side logic depends on `$remote_addr` — `geo` lookups,
`geoip`, IP-based allowlists, rate-limit keys. Without it `real_ip`
silently no-ops and `$remote_addr` stays as `127.0.0.1`.

Symptom that masks this bug: a `/api/client-ip` endpoint that returns
both `$remote_addr` and `$http_x_forwarded_for` will display the right
IP in the UI when the frontend prefers XFF over `$remote_addr`. The
server-side `geo`/allowlist still misses. Verify `real_ip` directly by
checking which value `$remote_addr` returns, not which value the UI
renders.

## Chart.yaml versioning

- `version` in Chart.yaml is updated by CI when tagging releases —
  do not manually bump it
- `appVersion` tracks the application version (container image tag)
- CI derives the chart version from the git tag by stripping the `v`
  prefix (e.g. tag `v1.2.3` → chart version `1.2.3`)

## Template conventions

- Helm templates are excluded from YAML pre-commit validation (they
  contain Go template syntax that isn't valid YAML)
- Use `_helpers.tpl` for reusable template functions (labels, names)
- Add a ConfigMap checksum annotation to Deployments so pods restart
  when config changes:
  ```yaml
  checksum/config: {{ include (print .Template.BasePath "/configmap.yaml") . | sha256sum }}
  ```

## Pre-commit configuration

The `.pre-commit-config.yaml` should exclude Helm templates from YAML
checks and include the schema generation hook:

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  hooks:
    - id: check-yaml
      exclude: ^(helm|Charts)/.*/templates/

- repo: https://github.com/losisin/helm-values-schema-json
  hooks:
    - id: helm-schema
      args: ["--config", "helm/<chart-name>/.schema.config.yaml"]
```
