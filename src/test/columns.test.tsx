import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { columns, DESCRIPTION_ANNOTATION } from "@/components/app-table/columns";
import type { Application } from "@/types/application";

function makeApp(overrides: {
  health?: { status: string } | undefined;
  sync?: { status: string } | undefined;
  name?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
} = {}): Application {
  return {
    metadata: {
      name: overrides.name ?? "test-app",
      namespace: "default",
      labels: overrides.labels ?? {},
      annotations: overrides.annotations,
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
  // eslint-disable-next-line react-hooks/incompatible-library
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

  it("renders Stopped badge when STOPPED label is set", () => {
    const app = makeApp({
      health: { status: "Healthy" },
      sync: { status: "Synced" },
      labels: { STOPPED: "1" },
    });

    render(<TestTable data={[app]} />);

    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  it("does not render Stopped badge without STOPPED label", () => {
    const app = makeApp({
      health: { status: "Healthy" },
      sync: { status: "Synced" },
    });

    render(<TestTable data={[app]} />);

    expect(screen.queryByText("Stopped")).not.toBeInTheDocument();
  });
});

describe("description column", () => {
  it("shows an empty cell when the description annotation is absent", () => {
    const app = makeApp({});

    render(<TestTable data={[app]} />);

    // The description cell falls back to "-", matching the other empty
    // text columns (namespace, revision, properties).
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("renders a short description in full", () => {
    const app = makeApp({
      annotations: { [DESCRIPTION_ANNOTATION]: "Short description" },
    });

    render(<TestTable data={[app]} />);

    expect(screen.getByText("Short description")).toBeInTheDocument();
  });

  it("renders a long description with CSS clipping classes, full text intact in the DOM and tooltip", async () => {
    const longDescription =
      "This is a very long free-text description that should be clipped in the table cell so it does not skew the column width, well past sixty characters.";
    const app = makeApp({
      annotations: { [DESCRIPTION_ANNOTATION]: longDescription },
    });

    render(<TestTable data={[app]} />);

    // jsdom does no layout, so we can't assert visual clipping - assert the
    // classes that produce it are applied instead: a block element with a
    // fixed max width plus Tailwind's truncate (overflow-hidden,
    // text-ellipsis, whitespace-nowrap).
    const trigger = screen.getByText(longDescription);
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("truncate");
    expect(trigger.className).toContain("max-w-48");
    expect(trigger.className).toContain("block");

    // The full text is reachable through the tooltip on hover/focus.
    trigger.focus();
    const tooltip = await screen.findByText(
      (_, element) =>
        element?.getAttribute("data-slot") === "tooltip-content" &&
        element.textContent === longDescription,
    );
    expect(tooltip).toBeInTheDocument();
  });
});
