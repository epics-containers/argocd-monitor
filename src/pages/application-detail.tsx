import { useEffect, useState, type ReactNode } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthDot, SyncDot } from "@/components/app-table/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PodTable } from "@/components/pod-table/pod-table";
import { useApplication, useResourceTree } from "@/hooks/use-application";
import { useRestartPod } from "@/hooks/use-restart-pod";
import { useSetEnabled } from "@/hooks/use-set-enabled";
import { useStoppableWorkload } from "@/hooks/use-stoppable-workload";
import { formatAge } from "@/lib/format";
import { cn } from "@/lib/utils";
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
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link
                to={backTo}
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Applications
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="truncate text-foreground">
              {app.metadata.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-2xl font-semibold tracking-tight break-all">
                {app.metadata.name}
              </h2>
              {pendingAction ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {pendingAction === "starting" ? "Starting..." : "Stopping..."}
                </Badge>
              ) : (
                isStopped && (
                  <Badge variant="secondary" className="gap-1">
                    <Square className="fill-current" />
                    Stopped
                  </Badge>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <HealthDot status={app.status.health?.status ?? "Unknown"} />
              <SyncDot status={app.status.sync?.status ?? "Unknown"} />
              <span aria-hidden className="h-3.5 w-px bg-border" />
              <span className="text-muted-foreground">
                project <span className="text-foreground">{app.spec.project}</span>
              </span>
              {namespace && (
                <span className="text-muted-foreground">
                  namespace <span className="text-foreground">{namespace}</span>
                </span>
              )}
            </div>
          </div>
          {stoppable && (
            pendingAction ? (
              <Button variant="outline" disabled>
                <Loader2 className="animate-spin" />
                {pendingAction === "starting" ? "Starting..." : "Stopping..."}
              </Button>
            ) : isStopped ? (
              <Button onClick={() => applyEnabled(true)}>
                <Play />
                Start
              </Button>
            ) : (
              // Calm until confirmed: the confirm dialog carries the danger.
              <Button variant="outline" onClick={() => setStopConfirmOpen(true)}>
                <Square className="text-destructive" />
                Stop
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Source">
          {app.spec.source?.repoURL && (
            <Detail label="Repository">
              {/^https?:\/\//.test(app.spec.source.repoURL) ? (
                <a
                  href={app.spec.source.repoURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={app.spec.source.repoURL}
                  className="hover:underline"
                >
                  {app.spec.source.repoURL.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span title={app.spec.source.repoURL}>{app.spec.source.repoURL}</span>
              )}
            </Detail>
          )}
          {app.spec.source?.targetRevision && (
            <Detail label="Revision" mono>
              {app.spec.source.targetRevision}
            </Detail>
          )}
          {app.spec.source?.path && (
            <Detail label="Path" mono>
              {app.spec.source.path}
            </Detail>
          )}
        </DetailCard>
        <DetailCard title="Deployment">
          <Detail
            label="Destination"
            title={app.spec.destination.server ?? app.spec.destination.name ?? ""}
          >
            {app.spec.destination.name ?? app.spec.destination.server ?? "-"}
            {namespace && <span className="text-muted-foreground"> / </span>}
            {namespace}
          </Detail>
          {app.status.operationState && (
            <Detail label="Last sync">
              {app.status.operationState.phase}
              {app.status.operationState.finishedAt && (
                <When timestamp={app.status.operationState.finishedAt} />
              )}
            </Detail>
          )}
          {app.metadata.creationTimestamp && (
            <Detail label="Created">
              <When timestamp={app.metadata.creationTimestamp} first />
            </Detail>
          )}
        </DetailCard>
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

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-xl border bg-muted/40 px-5 py-4"
    >
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Detail({
  label,
  mono,
  title,
  children,
}: {
  label: string;
  mono?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono text-[0.8rem]")} title={title}>
        {children}
      </dd>
    </>
  );
}

/** Relative age, with the absolute time in the tooltip. `first` leads with the
 *  age ("7 months ago · 12 Mar 2026"); otherwise it follows other text. */
function When({ timestamp, first }: { timestamp: string; first?: boolean }) {
  const date = new Date(timestamp);
  const age = `${formatAge(timestamp)} ago`;
  return (
    <span title={date.toLocaleString()}>
      {first ? (
        <>
          {age}
          <span className="text-muted-foreground"> · {date.toLocaleDateString()}</span>
        </>
      ) : (
        <span className="text-muted-foreground"> · {age}</span>
      )}
    </span>
  );
}
