import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, RotateCcw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LinkChip, PodLinksMenu } from "@/components/observability/observability-links";
import { useObservabilityLinks } from "@/hooks/use-observability-links";
import { formatAge } from "@/lib/format";
import { groupPodsByWorkload, nodeInfo, shortNodeName } from "@/lib/observability";
import { cn } from "@/lib/utils";
import type { ApplicationDestination } from "@/types/application";
import type { ResourceNode } from "@/types/resource";

type SortKey = "name" | "status" | "age";

const COLUMNS = 6;

/** Status dot per pod health; Progressing is an open ring so it reads apart
 *  from Healthy by shape as well as colour. */
const HEALTH_DOT: Record<string, string> = {
  Healthy: "bg-emerald-500",
  Degraded: "bg-red-500",
  Progressing: "border-2 border-blue-500",
  Missing: "bg-amber-500",
  Suspended: "bg-gray-400",
};

const WARN = "text-amber-600 dark:text-amber-400";

interface PodTableProps {
  appName: string;
  appNamespace?: string;
  destination: ApplicationDestination;
  /** The Application's resource-tree nodes; pods and workloads are picked out. */
  nodes: ResourceNode[];
  onRestart: (pod: ResourceNode) => void;
}

/** The Application's pods, grouped under the workload that owns them, with
 *  each workload's and pod's Grafana and Graylog links alongside. */
export function PodTable({ appName, appNamespace, destination, nodes, onRestart }: PodTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "name", asc: true });
  const obs = useObservabilityLinks(appName, appNamespace, destination, nodes);
  const groups = useMemo(() => groupPodsByWorkload(nodes), [nodes]);
  const podCount = groups.reduce((n, g) => n + g.pods.length, 0);
  const hasWorkloads = groups.some((g) => g.workload);
  const hasLinks = !!obs.grafanaUrl || !!obs.graylogHost;

  const sortPods = (pods: ResourceNode[]) =>
    [...pods].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name") cmp = a.name.localeCompare(b.name);
      else if (sort.key === "status")
        cmp = (a.health?.status ?? "").localeCompare(b.health?.status ?? "");
      else cmp = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      return sort.asc ? cmp : -cmp;
    });

  const sortHeader = (key: SortKey, label: string, className?: string) => {
    const active = sort.key === key;
    const Icon = active ? (sort.asc ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        className={className}
        aria-sort={active ? (sort.asc ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}
          className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {label}
          <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
        </button>
      </TableHead>
    );
  };

  return (
    <section aria-labelledby="pods-heading" aria-busy={obs.loading}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <h3 id="pods-heading" className="text-lg font-medium">
            Pods
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {podCount}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {obs.app.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">All pods in Explore</span>
              {obs.app.map((l) => (
                <LinkChip key={l.url} link={l} />
              ))}
            </div>
          )}
          {obs.grafanaUrl && (
            <a
              href={obs.grafanaUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={obs.grafanaUrl}
              className="group inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Open Grafana
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
            </a>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pods found.</p>
      ) : (
        <div className="rounded-lg border">
          <Table className="min-w-[52rem]">
            <TableHeader>
              <TableRow className="text-xs hover:bg-transparent [&_th]:text-muted-foreground">
                {sortHeader("status", "Status", "w-32 pl-5")}
                {sortHeader("name", "Pod")}
                <TableHead className="w-16">Ready</TableHead>
                <TableHead className="w-20">Restarts</TableHead>
                {sortHeader("age", "Age", "w-16")}
                <TableHead className="w-44 pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            {groups.map((g) => {
              const links = g.workload ? obs.workload(g.workload) : [];
              return (
                <TableBody
                  key={g.workload ? `${g.workload.namespace}/${g.workload.kind}/${g.workload.name}` : "other"}
                  className="border-b last:border-b-0"
                >
                  {hasWorkloads && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <th scope="rowgroup" colSpan={COLUMNS} className="px-5 py-2.5 text-left font-normal">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          {g.workload ? (
                            <div className="flex min-w-0 items-baseline gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {g.workload.kind}
                              </span>
                              <span className="truncate font-medium">{g.workload.name}</span>
                            </div>
                          ) : (
                            <span className="font-medium text-muted-foreground">Other pods</span>
                          )}
                          {links.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {links.map((l) => (
                                <LinkChip key={l.url} link={l} />
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                    </TableRow>
                  )}
                  {g.pods.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={COLUMNS} className="px-5 py-3 text-muted-foreground">
                        No pods running.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortPods(g.pods).map((pod) => {
                      const podLinks = obs.pod(pod);
                      const node = obs.node(pod);
                      const showMenu = podLinks.links.length > 0 || podLinks.pending || !!node;
                      return (
                        <PodRow
                          key={`${pod.namespace}/${pod.name}`}
                          pod={pod}
                          nodeName={nodeInfo(pod, "Node") || obs.nodeName(pod)}
                          logsHref={`/apps/${encodeURIComponent(appName)}/logs/${encodeURIComponent(pod.name)}?namespace=${encodeURIComponent(pod.namespace)}${appNamespace ? `&appNamespace=${encodeURIComponent(appNamespace)}` : ""}`}
                          menu={
                            showMenu ? (
                              <PodLinksMenu
                                podName={pod.name}
                                links={podLinks.links}
                                pending={podLinks.pending}
                                node={node}
                              />
                            ) : (
                              // Keep the Restart buttons aligned across rows.
                              hasLinks && <span className="size-7" aria-hidden />
                            )
                          }
                          onRestart={() => onRestart(pod)}
                        />
                      );
                    })
                  )}
                </TableBody>
              );
            })}
          </Table>
        </div>
      )}
    </section>
  );
}

function PodRow({
  pod,
  nodeName,
  logsHref,
  menu,
  onRestart,
}: {
  pod: ResourceNode;
  nodeName?: string;
  logsHref: string;
  menu: ReactNode;
  onRestart: () => void;
}) {
  const status = pod.health?.status ?? "Unknown";
  const reason = nodeInfo(pod, "Status Reason");
  const ready = nodeInfo(pod, "Containers");
  const [readyNow, readyWant] = ready?.split("/") ?? [];
  const restarts = Number(nodeInfo(pod, "Restart Count") ?? 0);

  const details: ReactNode[] = [];
  if (reason && reason !== "Running") {
    details.push(
      <span key="reason" className={reason === "Completed" ? undefined : WARN}>
        {reason}
      </span>,
    );
  }
  for (const [i, img] of (pod.images ?? []).entries()) {
    details.push(<ImageName key={`img-${i}`} image={img} />);
  }
  if (nodeName) {
    details.push(
      <span key="node">
        on{" "}
        <span title={nodeName} className="text-foreground/80">
          {shortNodeName(nodeName)}
        </span>
      </span>,
    );
  }

  return (
    <TableRow className="[&>td]:py-3">
      <TableCell className="pl-5">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[status] ?? "bg-gray-400")}
          />
          {status}
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono font-medium break-all">{pod.name}</span>
          {details.length > 0 && (
            <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
              {details.map((d, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden className="opacity-50">·</span>}
                  {d}
                </Fragment>
              ))}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={cn("font-mono tabular-nums", readyNow !== readyWant && WARN)}>
        {ready ?? "-"}
      </TableCell>
      <TableCell
        className={cn("font-mono tabular-nums", restarts > 0 ? WARN : "text-muted-foreground")}
      >
        {restarts}
      </TableCell>
      <TableCell className="text-muted-foreground" title={pod.createdAt ?? ""}>
        {formatAge(pod.createdAt)}
      </TableCell>
      <TableCell className="pr-5">
        <div className="flex items-center justify-end gap-1">
          <Link
            to={logsHref}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary px-2.5 text-[0.8rem] font-medium text-secondary-foreground outline-none hover:bg-secondary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Logs
          </Link>
          {menu}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Restart pod ${pod.name}`}
                  onClick={onRestart}
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <RotateCcw className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Restart pod</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Image without its registry and repository path, the tag set apart; the
 *  full reference is in the tooltip. */
function ImageName({ image }: { image: string }) {
  const short = image.slice(image.lastIndexOf("/") + 1);
  const at = short.indexOf("@");
  const split = at >= 0 ? at : short.lastIndexOf(":");
  const name = split >= 0 ? short.slice(0, split) : short;
  const tag = split >= 0 ? short.slice(split) : "";
  return (
    <span title={image} className="font-mono">
      {name}
      {tag && <span className="text-foreground/80">{at >= 0 ? tag.slice(0, 19) : tag}</span>}
    </span>
  );
}
