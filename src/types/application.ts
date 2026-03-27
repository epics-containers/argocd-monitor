export interface ApplicationList {
  items: Application[];
  metadata: { resourceVersion?: string };
}

export interface Application {
  metadata: ApplicationMetadata;
  spec: ApplicationSpec;
  status: ApplicationStatus;
}

export interface ApplicationMetadata {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
}

export interface ApplicationSpec {
  project: string;
  source?: ApplicationSource;
  destination: ApplicationDestination;
}

export interface ApplicationSource {
  repoURL: string;
  path?: string;
  targetRevision?: string;
  chart?: string;
}

export interface ApplicationDestination {
  server?: string;
  namespace?: string;
  name?: string;
}

export interface ApplicationStatus {
  health: HealthStatus;
  sync: SyncStatus;
  operationState?: OperationState;
  summary?: { images?: string[] };
  resources?: ResourceStatus[];
}

export interface HealthStatus {
  status: HealthStatusCode;
  message?: string;
}

export type HealthStatusCode =
  | "Healthy"
  | "Degraded"
  | "Progressing"
  | "Suspended"
  | "Missing"
  | "Unknown";

export interface SyncStatus {
  status: SyncStatusCode;
  revision?: string;
}

export type SyncStatusCode = "Synced" | "OutOfSync" | "Unknown";

export interface OperationState {
  phase: string;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ResourceStatus {
  group?: string;
  version: string;
  kind: string;
  namespace?: string;
  name: string;
  status?: string;
  health?: HealthStatus;
}
