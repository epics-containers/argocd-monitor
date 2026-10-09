import type { GrafanaConfig, GraylogConfig } from "@/api/observability-config";
import type { PodResource, ResourceNode } from "@/types/resource";

// Real-world reference: i15-1-blueapi on the i15 cluster, as verified against
// https://k8s-i15-grafana.diamond.ac.uk.
export const I15_GRAFANA = "https://k8s-i15-grafana.diamond.ac.uk";
export const I15_NS = "i15-beamline";
export const I15_NODE = "i15-k8s-serv-01.diamond.ac.uk";
export const I15_HOST_IP = "172.23.115.31";
export const I15_OAUTH_POD = "i15-1-blueapi-oauth2-7d9f8b6c5-x2x4q";

export const DLS_CONFIG: GrafanaConfig = {
  enabled: true,
  urlTemplate: "https://k8s-{cluster}-grafana.diamond.ac.uk",
  overrides: {},
};

// Example only: the real DLS search id lives in scripts/observability.yaml.
export const GRAYLOG_SEARCH = "https://graylog.example.com/search/abc123";
export const GRAYLOG_CONFIG: GraylogConfig = {
  enabled: true,
  urlTemplate: `${GRAYLOG_SEARCH}?q={query}&rangetype=relative&from=7200`,
  podField: "pod_name",
};

function node(kind: string, name: string, parent?: [string, string]): ResourceNode {
  return {
    kind,
    name,
    namespace: I15_NS,
    group: kind === "Pod" ? "" : "apps",
    version: "v1",
    uid: `${kind}-${name}`,
    ...(parent && { parentRefs: [{ kind: parent[0], name: parent[1], namespace: I15_NS }] }),
  };
}

export const I15_NODES: ResourceNode[] = [
  node("StatefulSet", "i15-1-blueapi"),
  node("Deployment", "i15-1-blueapi-oauth2"),
  node("ReplicaSet", "i15-1-blueapi-oauth2-7d9f8b6c5", ["Deployment", "i15-1-blueapi-oauth2"]),
  node("Service", "i15-1-blueapi"),
  node("Pod", "i15-1-blueapi-0", ["StatefulSet", "i15-1-blueapi"]),
  node("Pod", I15_OAUTH_POD, ["ReplicaSet", "i15-1-blueapi-oauth2-7d9f8b6c5"]),
];

export const I15_MANIFESTS: Record<string, PodResource> = {
  [`${I15_NS}/i15-1-blueapi-0`]: {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: "i15-1-blueapi-0", namespace: I15_NS },
    spec: {
      nodeName: I15_NODE,
      hostNetwork: true,
      volumes: [
        { name: "scratch", persistentVolumeClaim: { claimName: "i15-1-blueapi-scratch-1.20.0" } },
        { name: "config" },
      ],
    },
    status: { phase: "Running", hostIP: I15_HOST_IP },
  },
  [`${I15_NS}/${I15_OAUTH_POD}`]: {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: I15_OAUTH_POD, namespace: I15_NS },
    spec: { nodeName: I15_NODE, volumes: [{ name: "kube-api-access" }] },
    status: { phase: "Running", hostIP: I15_HOST_IP },
  },
};
