# Observability Links

The Application detail page has an Observability panel with two kinds of
link, which you enable separately:

- **Grafana**: links into the Grafana instance that monitors each
  Application's destination cluster. These are per-workload, per-pod and
  per-node dashboards, and optionally Grafana Explore queries covering all of
  the Application's pods.
- **Graylog**: a **Graylog** button (first in each workload row) that searches one global
  Graylog server for the logs of that workload's pods, including pods that no
  longer exist.

Both are off by default. The panel appears when at least one of them applies
to the Application, so Graylog links still show for clusters that have no
Grafana.

## Grafana prerequisites

Each destination cluster needs a Grafana deployed with
[kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack).
The links target the dashboards that chart bundles (from kubernetes-mixin and
node-exporter-mixin), whose UIDs are stable across releases:

| Link | Dashboard |
|---|---|
| Workload CPU, Memory | The CPU Usage and Memory Usage panels of Kubernetes / Compute Resources / Workload, opened full-screen |
| Workload resources | Kubernetes / Compute Resources / Workload |
| Pod resources | Kubernetes / Compute Resources / Pod |
| Pod network | Kubernetes / Networking / Pod (not shown for `hostNetwork` pods, where it would show the whole host) |
| Volume | Kubernetes / Persistent Volumes (one link per PVC the pod mounts) |
| Node pods | Kubernetes / Compute Resources / Node (Pods) |
| Node hardware | Node Exporter / Nodes (assumes node-exporter on port 9100; opens with a 1 hour range because the dashboard is heavy) |

With `exploreLinks: true`, an Application row adds CPU, memory and restart
links that open Grafana Explore against a Prometheus datasource, with one
series per pod. They are off by default because Grafana's Viewer role cannot
open Explore: Grafana redirects it to the home page. Turn them on only where
users have Explore access, for example where Viewers have been granted the
Data source explorer role.

## How a cluster maps to a Grafana URL

1. The **cluster key** is the Application's `spec.destination.name`. If the
   Application only sets `spec.destination.server`, the server URL is used
   instead.
2. The **cluster name** is the cluster key itself. If `clusterPattern` is set,
   it is a regular expression with one capture group, and capture group 1 of
   the match against the cluster key is the cluster name. When the pattern does
   not match, the Application gets no links (unless an override matches).
3. `overrides` is checked first, by cluster name and then by the raw cluster
   key. An override value is a full Grafana base URL. An empty string hides the
   links for that cluster.
4. Otherwise `{cluster}` in `urlTemplate` is replaced with the cluster name.

For example, `destination: {name: b01-1, namespace: b01-1-beamline}` with
`urlTemplate: https://k8s-{cluster}-grafana.example.com` links to
`https://k8s-b01-1-grafana.example.com`.

## Configure Grafana

Put the settings in a values file rather than using `--set`. Regular
expressions and URLs with braces or commas are awkward to escape on the
command line.

```yaml
grafana:
  enabled: true
  # Leave empty when destination.name already is the cluster name.
  clusterPattern: ""
  urlTemplate: https://k8s-{cluster}-grafana.example.com
  overrides:
    special-cluster: https://grafana.special.example.com
    cluster-without-grafana: ""
  # Explore links need Explore access in Grafana (not the Viewer role).
  exploreLinks: false
  # UID of the Prometheus datasource that Explore links use.
  datasourceUid: prometheus
```

For Applications that identify their cluster only by API server URL, set
`clusterPattern` to extract the name. For example, this pattern maps
`https://api.k8s-i15.example.com:6443` to `i15`:

```yaml
grafana:
  enabled: true
  clusterPattern: '^https?://api\.k8s-([^.:/]+)'
  urlTemplate: https://k8s-{cluster}-grafana.example.com
  overrides:
    # The pattern does not match the in-cluster server, so map it by raw key.
    https://kubernetes.default.svc: https://grafana.example.com
```

## Configure Graylog

Graylog is a single server shared by every cluster. Set `urlTemplate` to a
Graylog search URL that contains a `{query}` placeholder. The frontend replaces
`{query}` with the URL-encoded Lucene query for the workload. The rest of the
URL chooses the search, stream or saved view and the time range. The
placeholder must appear literally as `{query}`. A browser address bar often
shows it percent-encoded as `%7Bquery%7D`; a template without the literal
placeholder disables the Graylog links rather than opening unfiltered searches.

```yaml
graylog:
  enabled: true
  urlTemplate: https://graylog.example.com/search/<view-id>?q={query}&rangetype=relative&from=7200
  # Graylog message field that holds the Kubernetes pod name.
  podField: pod_name
```

When the URL uses `rangetype=relative&from=<seconds>`, the button's tooltip
shows the range, for example "Last 2 hours".

### Query patterns

Graylog stores logs by pod name, and pods get new names whenever they are
recreated. So that one search finds the logs of the workload's current and
past pods, each **Graylog** button runs a regular expression over the pod-name
field. Lucene regular expressions must match the whole value, so the pattern
spells out the suffix each controller adds to the workload name. This stops a
workload such as `i15-1-blueapi` from matching the pods of a sibling such as
`i15-1-blueapi-oauth2`:

| Workload kind | Pod name | Query |
|---|---|---|
| StatefulSet | `<name>-<ordinal>` | `pod_name:/<name>-[0-9]+/` |
| Deployment | `<name>-<replicaset hash>-<5 chars>` | `pod_name:/<name>-[a-z0-9]{1,10}-[a-z0-9]{5}/` |
| DaemonSet | `<name>-<5 chars>` | `pod_name:/<name>-[a-z0-9]{5}/` |
| Pod with no owner | `<name>` | `pod_name:"<name>"` |

Characters in the name that have a meaning in regular expressions, such as `.`,
are escaped. For example, the StatefulSet `i15-1-blueapi` gets the query
`pod_name:/i15-1-blueapi-[0-9]+/`, and the Deployment `i15-1-blueapi-oauth2`
gets `pod_name:/i15-1-blueapi-oauth2-[a-z0-9]{1,10}-[a-z0-9]{5}/`.

The patterns cannot tell every pair of names apart. A Deployment named `x`
also matches the pods of a DaemonSet named `x-<word>` when the word is at most
10 characters long. The query is not limited to a namespace, so workloads with
the same name in other namespaces also match.

```{note}
Regular expression queries only work when the pod-name field is a keyword
(non-analyzed) field in Graylog's index. On an analyzed text field, Graylog
splits the pod name into tokens and the regular expression matches nothing.
```

## Example values file

Install with `helm upgrade --install ... -f observability.yaml`. The DLS test
deployment uses `scripts/observability.yaml`:

```{literalinclude} ../../scripts/observability.yaml
:language: yaml
```

## How the frontend gets the config

The chart writes the `grafana` and `graylog` values as one JSON file into its
nginx ConfigMap, and nginx serves the file at `GET /api/observability-config`:

```json
{
  "grafana": {
    "enabled": true,
    "clusterPattern": "",
    "urlTemplate": "https://k8s-{cluster}-grafana.example.com",
    "overrides": {},
    "datasourceUid": "prometheus",
    "exploreLinks": false
  },
  "graylog": {
    "enabled": true,
    "urlTemplate": "https://graylog.example.com/search?q={query}",
    "podField": "pod_name"
  }
}
```

A disabled feature is reported as `{"enabled":false}`. The standalone Docker
image (without Helm) reports both as disabled.

If the endpoint is missing or returns invalid JSON, `clusterPattern` is not a
valid regular expression, or Graylog is enabled with an empty `urlTemplate`,
the affected links are hidden and the rest of the page works as usual.

## Try it locally

The Vite dev server mocks `/api/observability-config`. Set
`DEV_GRAFANA_URL_TEMPLATE` to enable Grafana links, and optionally
`DEV_GRAFANA_CLUSTER_PATTERN`. Set `DEV_GRAYLOG_URL_TEMPLATE` to enable Graylog
links, and optionally `DEV_GRAYLOG_POD_FIELD`:

```bash
DEV_GRAFANA_URL_TEMPLATE='https://k8s-{cluster}-grafana.example.com' \
DEV_GRAYLOG_URL_TEMPLATE='https://graylog.example.com/search?q={query}&rangetype=relative&from=7200' \
  just dev
```
