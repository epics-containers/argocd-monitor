import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthBadge, SyncBadge } from "./status-badge";
import type { Application } from "@/types/application";

/** Label prefixes to strip from display for brevity. */
const STRIP_PREFIXES = ["argocd.argoproj.io/"];

/** Labels to hide from the Properties column. */
const HIDDEN_LABELS = new Set(["argocd.argoproj.io/instance"]);

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
    accessorFn: (row) => row.status.health.status,
    id: "health",
    header: "Health",
    cell: ({ row }) => (
      <HealthBadge status={row.original.status.health.status} />
    ),
    filterFn: (row, _id, value: string[]) =>
      value.includes(row.original.status.health.status),
  },
  {
    accessorFn: (row) => row.status.sync.status,
    id: "sync",
    header: "Sync",
    cell: ({ row }) => (
      <SyncBadge status={row.original.status.sync.status} />
    ),
    filterFn: (row, _id, value: string[]) =>
      value.includes(row.original.status.sync.status),
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
    accessorFn: (row) =>
      Object.entries(row.metadata.labels ?? {})
        .filter(([k]) => !HIDDEN_LABELS.has(k))
        .map(([k, v]) => `${k}=${v}`)
        .join(" "),
    id: "properties",
    header: "Properties",
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
