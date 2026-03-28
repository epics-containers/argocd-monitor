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

export function ApplicationDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const appNamespace = searchParams.get("appNamespace") ?? undefined;
  const { data: app, isLoading: appLoading } = useApplication(name!, appNamespace);
  const { data: tree, isLoading: treeLoading } = useResourceTree(name!, appNamespace);
  const restartMutation = useRestartPod();

  const [restartTarget, setRestartTarget] = useState<ResourceNode | null>(null);
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

  const pods = tree?.nodes.filter((n) => n.kind === "Pod") ?? [];
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

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {app.metadata.name}
        </h2>
        <div className="flex items-center gap-3">
          <HealthBadge status={app.status.health.status} />
          <SyncBadge status={app.status.sync.status} />
          <Badge variant="secondary">{app.spec.project}</Badge>
          {namespace && <Badge variant="outline">{namespace}</Badge>}
        </div>
      </div>

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
                    <TableCell className="text-sm text-muted-foreground">
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
            restartMutation.mutate(
              {
                appName: name!,
                podName: restartTarget.name,
                namespace: restartTarget.namespace,
                appNamespace,
              },
              { onSuccess: () => setRestartTarget(null) },
            );
          }
        }}
      />
    </div>
  );
}
