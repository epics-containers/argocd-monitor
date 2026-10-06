import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HealthBadge, SyncBadge } from "./status-badge";
import type { Application } from "@/types/application";

/** Label prefixes to strip from display for brevity. */
const STRIP_PREFIXES = ["argocd.argoproj.io/"];

/** Labels to hide from the Properties column (rendered elsewhere or noise). */
const HIDDEN_LABELS = new Set(["argocd.argoproj.io/instance", "STOPPED"]);

/**
 * Annotation key an Application carries its free-text description under.
 * Fixed contract shared with ec-helm-charts (renders it) and
 * edge-containers-cli (writes it) - do not rename.
 */
export const DESCRIPTION_ANNOTATION = "epics-containers.github.io/description";

/**
 * Max width of the Description cell before it clips with an ellipsis
 * (CSS `truncate`, not a character count - tune this one class to adjust).
 */
const DESCRIPTION_MAX_WIDTH_CLASS = "max-w-48";

function formatLabelKey(key: string): string {
  for (const prefix of STRIP_PREFIXES) {
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  return key;
}

export const columns: ColumnDef<Application>[] = [
  {
    accessorFn: (row) => row.metadata.name,
    id: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const name = row.original.metadata.name;
      const appNamespace = row.original.metadata.namespace;
      return (
        <Link
          to={`/apps/${encodeURIComponent(name)}?appNamespace=${encodeURIComponent(appNamespace)}`}
          className="font-medium text-primary hover:underline"
        >
          {name}
        </Link>
      );
    },
  },
  {
    accessorFn: (row) =>
      row.metadata.annotations?.[DESCRIPTION_ANNOTATION] ?? "",
    id: "description",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Description
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => {
      const description = getValue<string>();
      if (!description) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className={`block ${DESCRIPTION_MAX_WIDTH_CLASS} truncate text-left text-muted-foreground`}
              />
            }
          >
            {description}
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-wrap">
            {description}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorFn: (row) => row.status.health?.status ?? "Unknown",
    id: "health",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Health
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <HealthBadge status={row.original.status.health?.status ?? "Unknown"} />
        {row.original.metadata.labels?.STOPPED === "1" && (
          <Badge variant="destructive">Stopped</Badge>
        )}
      </div>
    ),
    filterFn: (row, _id, value: string[]) =>
      value.includes(row.original.status.health?.status ?? "Unknown"),
  },
  {
    accessorFn: (row) => row.status.sync?.status ?? "Unknown",
    id: "sync",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Sync
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <SyncBadge status={row.original.status.sync?.status ?? "Unknown"} />
    ),
    filterFn: (row, _id, value: string[]) =>
      value.includes(row.original.status.sync?.status ?? "Unknown"),
  },
  {
    accessorFn: (row) => row.spec.destination.namespace ?? "",
    id: "namespace",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Namespace
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue() as string}</span>
    ),
    filterFn: (row, id, value: string) =>
      row.getValue<string>(id) === value,
  },
  {
    accessorFn: (row) => row.spec.source?.targetRevision ?? "",
    id: "revision",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Target Revision
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {(getValue() as string) || "-"}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.status.operationState?.finishedAt ?? "",
    id: "lastSync",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Last Sync
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const op = row.original.status.operationState;
      if (!op?.finishedAt) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <span className="text-xs text-muted-foreground">
          {new Date(op.finishedAt).toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorFn: (row) =>
      Object.entries(row.metadata.labels ?? {})
        .filter(([k]) => !HIDDEN_LABELS.has(k))
        .map(([k, v]) => `${k}=${v}`)
        .join(" "),
    id: "properties",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-4"
      >
        Properties
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const labels = row.original.metadata.labels;
      const entries = Object.entries(labels ?? {}).filter(
        ([k]) => !HIDDEN_LABELS.has(k),
      );
      if (entries.length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {entries.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              title={`${key}=${value}`}
            >
              {formatLabelKey(key)}={value}
            </span>
          ))}
        </div>
      );
    },
  },
];
