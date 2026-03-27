export interface ResourceTree {
  nodes: ResourceNode[];
}

export interface ResourceNode {
  group?: string;
  version: string;
  kind: string;
  namespace: string;
  name: string;
  uid?: string;
  parentRefs?: ParentRef[];
  health?: { status: string; message?: string };
  info?: ResourceInfo[];
  resourceVersion?: string;
  createdAt?: string;
  images?: string[];
}

export interface ParentRef {
  group?: string;
  kind: string;
  namespace: string;
  name: string;
  uid?: string;
}

export interface ResourceInfo {
  name: string;
  value: string;
}

export interface PodResource {
  apiVersion: string;
  kind: "Pod";
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
  };
  status: {
    phase: string;
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
  };
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: {
    running?: { startedAt?: string };
    waiting?: { reason?: string; message?: string };
    terminated?: { reason?: string; exitCode?: number };
  };
}

export interface LogEntry {
  content: string;
  podName?: string;
  last?: boolean;
  timeStamp?: string;
}
