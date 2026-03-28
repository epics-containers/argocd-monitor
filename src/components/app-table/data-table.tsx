import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Column id to use for the namespace dropdown filter. */
  namespaceColumnId?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  namespaceColumnId = "namespace",
}: DataTableProps<TData, TValue>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const globalFilter = searchParams.get("q") ?? "";
  const namespaceFilter = searchParams.get("ns") ?? "";

  const namespaces = useMemo(() => {
    const col = columns.find((c) => "id" in c && c.id === namespaceColumnId);
    if (!col || !("accessorFn" in col) || !col.accessorFn) return [];
    const values = new Set(data.map((row) => String(col.accessorFn(row, 0))));
    return [...values].sort();
  }, [data, columns, namespaceColumnId]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      namespaceFilter
        ? [{ id: namespaceColumnId, value: namespaceFilter }]
        : [],
    [namespaceFilter, namespaceColumnId],
  );

  function updateParams(updates: Record<string, string>) {
    const next: Record<string, string> = {};
    if (updates.q ?? globalFilter) next.q = updates.q ?? globalFilter;
    if (updates.ns ?? namespaceFilter) next.ns = updates.ns ?? namespaceFilter;
    for (const k of Object.keys(next)) {
      if (!next[k]) delete next[k];
    }
    setSearchParams(next, { replace: true });
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: (value: string) => updateParams({ q: value }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={globalFilter}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-9"
          />
        </div>
        {namespaces.length > 1 && (
          <Select
            value={namespaceFilter}
            onValueChange={(value) => updateParams({ ns: value ?? "" })}
          >
            <SelectTrigger size="default">
              <SelectValue placeholder="All namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All namespaces</SelectItem>
              {namespaces.map((ns) => (
                <SelectItem key={ns} value={ns}>
                  {ns}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No applications found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} application(s)
      </div>
    </div>
  );
}
