import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { ArrowLeft, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthBadge, SyncBadge } from "@/components/app-table/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PodTable } from "@/components/pod-table/pod-table";
import { useApplication, useResourceTree } from "@/hooks/use-application";
import { useRestartPod } from "@/hooks/use-restart-pod";
import { useSetEnabled } from "@/hooks/use-set-enabled";
import { useStoppableWorkload } from "@/hooks/use-stoppable-workload";
import type { ResourceNode } from "@/types/resource";

const EMPTY_NODES: ResourceNode[] = [];

export function ApplicationDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const appNamespace = searchParams.get("appNamespace") ?? undefined;
  const [pendingAction, setPendingAction] = useState<"starting" | "stopping" | null>(null);
  // After the STOPPED label flips, ArgoCD still needs a few seconds to finish
  // syncing replicas, terminate/start pods, and settle sync status. Keep polling
  // fast through that window so the pod list and sync badge converge without a
  // manual refresh.
  const [isSettling, setIsSettling] = useState(false);
  const pollInterval = pendingAction || isSettling ? 2000 : undefined;
  const { data: app, isLoading: appLoading } = useApplication(name!, appNamespace, pollInterval);
  const { data: tree, isLoading: treeLoading } = useResourceTree(name!, appNamespace, pollInterval);
  const { data: stoppable, error: stoppableError } = useStoppableWorkload(name!, appNamespace);
  const restartMutation = useRestartPod();
  const setEnabledMutation = useSetEnabled();

  const [restartTarget, setRestartTarget] = useState<ResourceNode | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [setEnabledError, setSetEnabledError] = useState<string | null>(null);

  const isStopped = app?.metadata.labels?.STOPPED === "1";

  // Drop the spinner once ArgoCD has reflected the requested change in the
  // child's STOPPED label, and enter a brief settling window so polling keeps
  // running until pods/sync converge. Adjusting state during render is React's
  // idiomatic pattern here (avoids the cascading-effect lint rule).
  if (pendingAction && app && isStopped === (pendingAction === "stopping")) {
    setPendingAction(null);
    setIsSettling(true);
  }

  // Safety net: drop the spinner after 2 minutes if ArgoCD never converges.
  useEffect(() => {
    if (!pendingAction) return;
    const t = setTimeout(() => setPendingAction(null), 120_000);
    return () => clearTimeout(t);
  }, [pendingAction]);

  // End the settling window after 30s of fast polling post-flip.
  useEffect(() => {
    if (!isSettling) return;
    const t = setTimeout(() => setIsSettling(false), 30_000);
    return () => clearTimeout(t);
  }, [isSettling]);
  const tableFilters = sessionStorage.getItem("tableFilters");
  const backTo = tableFilters ? `/?${tableFilters}` : "/";
  if (appLoading || treeLoading) {
    return <LoadingSpinner message="Loading application..." />;
  }

  if (!app) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Application not found.
      </div>
    );
  }

  const namespace = app.spec.destination.namespace ?? "";
  const parentNamespace = app.metadata.namespace;
  // Convention: child app's namespace `<beamline>-beamline` is deployed by a
  // parent Application named `<beamline>` in the same namespace. Replace with
  // an explicit annotation/label on the child once one exists (see #44).
  const parentName = parentNamespace.replace(/-beamline$/, "");

  const applyEnabled = (enabled: boolean) => {
    setSetEnabledError(null);
    setPendingAction(enabled ? "starting" : "stopping");
    setEnabledMutation.mutate(
      {
        parentName,
        serviceName: app.metadata.name,
        enabled,
        parentNamespace,
      },
      {
        onSuccess: () => setStopConfirmOpen(false),
        onError: (err) => {
          setStopConfirmOpen(false);
          setSetEnabledError(err.message);
          setPendingAction(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={backTo}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {app.metadata.name}
            </h2>
            <div className="flex items-center gap-3">
              <HealthBadge status={app.status.health?.status ?? "Unknown"} />
              <SyncBadge status={app.status.sync?.status ?? "Unknown"} />
              <Badge variant="secondary">project: {app.spec.project}</Badge>
              {namespace && <Badge variant="outline">ns: {namespace}</Badge>}
              {pendingAction ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {pendingAction === "starting" ? "Starting..." : "Stopping..."}
                </Badge>
              ) : (
                isStopped && <Badge variant="destructive">Stopped</Badge>
              )}
            </div>
          </div>
          {stoppable && (
            pendingAction ? (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {pendingAction === "starting" ? "Starting..." : "Stopping..."}
              </Button>
            ) : isStopped ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => applyEnabled(true)}
              >
                <Play className="mr-1 h-4 w-4" />
                Start
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setStopConfirmOpen(true)}
              >
                <Square className="mr-1 h-4 w-4" />
                Stop
              </Button>
            )
          )}
        </div>

        <div className="rounded-md border p-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {app.spec.source?.repoURL && (
              <div>
                <dt className="font-medium text-muted-foreground">Repository</dt>
                <dd className="mt-0.5 truncate" title={app.spec.source.repoURL}>
                  {app.spec.source.repoURL}
                </dd>
              </div>
            )}
            {app.spec.source?.targetRevision && (
              <div>
                <dt className="font-medium text-muted-foreground">Target Revision</dt>
                <dd className="mt-0.5 font-mono text-xs">{app.spec.source.targetRevision}</dd>
              </div>
            )}
            {app.spec.source?.path && (
              <div>
                <dt className="font-medium text-muted-foreground">Path</dt>
                <dd className="mt-0.5 font-mono text-xs">{app.spec.source.path}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-muted-foreground">Destination</dt>
              <dd className="mt-0.5 truncate" title={app.spec.destination.server ?? app.spec.destination.name ?? ""}>
                {app.spec.destination.name ?? app.spec.destination.server ?? "-"}
                {namespace ? ` / ${namespace}` : ""}
              </dd>
            </div>
            {app.metadata.creationTimestamp && (
              <div>
                <dt className="font-medium text-muted-foreground">Created</dt>
                <dd className="mt-0.5">{new Date(app.metadata.creationTimestamp).toLocaleString()}</dd>
              </div>
            )}
            {app.status.operationState && (
              <div>
                <dt className="font-medium text-muted-foreground">Last Sync</dt>
                <dd className="mt-0.5">
                  <span className="mr-1.5">{app.status.operationState.phase}</span>
                  {app.status.operationState.finishedAt && (
                    <span className="text-muted-foreground">
                      {new Date(app.status.operationState.finishedAt).toLocaleString()}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {restartError && (
        <p className="text-sm text-destructive">
          Restart failed: {restartError}
        </p>
      )}

      {setEnabledError && (
        <p className="text-sm text-destructive">
          Stop/Start failed: {setEnabledError}
        </p>
      )}

      {stoppableError && (
        <p className="text-sm text-destructive">
          Could not determine Start/Stop availability: {stoppableError.message}
        </p>
      )}

      <PodTable
        appName={name!}
        appNamespace={appNamespace}
        destination={app.spec.destination}
        nodes={tree?.nodes ?? EMPTY_NODES}
        onRestart={setRestartTarget}
      />

      <ConfirmDialog
        open={stopConfirmOpen}
        onOpenChange={setStopConfirmOpen}
        title="Stop Service"
        description={`Stop "${app.metadata.name}"? This sets services.${app.metadata.name}.enabled=false on the parent application "${parentName}", and ArgoCD will scale the workload to zero replicas.`}
        confirmLabel="Stop"
        variant="destructive"
        loading={setEnabledMutation.isPending}
        onConfirm={() => applyEnabled(false)}
      />

      <ConfirmDialog
        open={restartTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestartTarget(null);
        }}
        title="Restart Pod"
        description={`Are you sure you want to restart pod "${restartTarget?.name}"? This will delete the pod and Kubernetes will recreate it.`}
        confirmLabel="Restart"
        variant="destructive"
        loading={restartMutation.isPending}
        onConfirm={() => {
          if (restartTarget) {
            setRestartError(null);
            restartMutation.mutate(
              {
                appName: name!,
                podName: restartTarget.name,
                namespace: restartTarget.namespace,
                appNamespace,
              },
              {
                onSuccess: () => setRestartTarget(null),
                onError: (err) => {
                  setRestartTarget(null);
                  setRestartError(err.message);
                },
              },
            );
          }
        }}
      />
    </div>
  );
}
