import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { columns } from "@/components/app-table/columns";
import type { Application } from "@/types/application";

function makeApp(overrides: {
  health?: { status: string } | undefined;
  sync?: { status: string } | undefined;
  name?: string;
} = {}): Application {
  return {
    metadata: {
      name: overrides.name ?? "test-app",
      namespace: "default",
      labels: {},
    },
    spec: {
      project: "default",
      destination: { namespace: "test-ns" },
    },
    status: {
      health: overrides.health,
      sync: overrides.sync,
    },
  } as Application;
}

function TestTable({ data }: { data: Application[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <MemoryRouter>
      <table>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </MemoryRouter>
  );
}

describe("columns", () => {
  it("renders with full health and sync data", () => {
    const app = makeApp({
      health: { status: "Healthy" },
      sync: { status: "Synced" },
    });

    render(<TestTable data={[app]} />);

    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("renders Unknown when health and sync are undefined", () => {
    const app = makeApp({
      health: undefined,
      sync: undefined,
    });

    render(<TestTable data={[app]} />);

    expect(screen.getAllByText("Unknown")).toHaveLength(2);
  });

  it("renders Unknown when health is Missing status", () => {
    const app = makeApp({
      health: { status: "Missing" },
      sync: { status: "OutOfSync" },
    });

    render(<TestTable data={[app]} />);

    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("OutOfSync")).toBeInTheDocument();
  });
});
