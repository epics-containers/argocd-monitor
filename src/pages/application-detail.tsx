import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { ArrowLeft, RotateCcw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HealthBadge, SyncBadge } from "@/components/app-table/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useApplication, useResourceTree } from "@/hooks/use-application";
import { useRestartPod } from "@/hooks/use-restart-pod";
import type { ResourceNode } from "@/types/resource";

function formatAge(dateStr?: string): string {
  if (!dateStr) return "-";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ApplicationDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const appNamespace = searchParams.get("appNamespace") ?? undefined;
  const { data: app, isLoading: appLoading } = useApplication(name!, appNamespace);
  const { data: tree, isLoading: treeLoading } = useResourceTree(name!, appNamespace);
  const restartMutation = useRestartPod();

  const [restartTarget, setRestartTarget] = useState<ResourceNode | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
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

  const pods = tree?.nodes?.filter((n) => n.kind === "Pod") ?? [];
  const namespace = app.spec.destination.namespace ?? "";

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
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {app.metadata.name}
          </h2>
          <div className="flex items-center gap-3">
            <HealthBadge status={app.status.health?.status ?? "Unknown"} />
            <SyncBadge status={app.status.sync?.status ?? "Unknown"} />
            <Badge variant="secondary">project: {app.spec.project}</Badge>
            {namespace && <Badge variant="outline">ns: {namespace}</Badge>}
          </div>
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

      <div>
        <h3 className="mb-3 text-lg font-medium">Pods ({pods.length})</h3>
        {pods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pods found.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pod Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Info</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pods.map((pod) => (
                  <TableRow key={pod.name}>
                    <TableCell className="font-medium">{pod.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          pod.health?.status === "Healthy"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : pod.health?.status === "Degraded"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }
                      >
                        {pod.health?.status ?? "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      {pod.images?.length ? (
                        <div className="flex flex-col gap-0.5">
                          {pod.images.map((img) => (
                            <span key={img} className="font-mono text-xs text-muted-foreground break-all" title={img}>
                              {img}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" title={pod.createdAt ?? ""}>
                      {formatAge(pod.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-normal break-words">
                      {pod.info
                        ?.map((i) => `${i.name}: ${i.value}`)
                        .join(", ") ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/apps/${encodeURIComponent(name!)}/logs/${encodeURIComponent(pod.name)}?namespace=${encodeURIComponent(pod.namespace)}${appNamespace ? `&appNamespace=${encodeURIComponent(appNamespace)}` : ""}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
                        >
                          <ScrollText className="h-4 w-4" />
                          Logs
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRestartTarget(pod)}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Restart
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
