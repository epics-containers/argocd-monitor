import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import { ArrowUpDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthBadge, SyncBadge } from "./status-badge";
import type { Application } from "@/types/application";

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
      return (
        <Link
          to={`/apps/${encodeURIComponent(name)}`}
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
  },
  {
    accessorFn: (row) => row.spec.project,
    id: "project",
    header: "Project",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const name = row.original.metadata.name;
      return (
        <div className="flex justify-end">
          <Link
            to={`/apps/${encodeURIComponent(name)}`}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
          >
            <FileText className="h-4 w-4" />
            Details
          </Link>
        </div>
      );
    },
  },
];
