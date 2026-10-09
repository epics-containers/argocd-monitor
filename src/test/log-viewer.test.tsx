import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogViewer } from "@/components/log-viewer/log-viewer";

describe("LogViewer", () => {
  it("shows waiting message when no lines", () => {
    render(<LogViewer lines={[]} follow={true} />);

    expect(screen.getByText("Waiting for logs...")).toBeInTheDocument();
  });

  it("renders log lines with line numbers", () => {
    render(<LogViewer lines={["first line", "second line"]} follow={false} />);

    expect(screen.getByText("first line")).toBeInTheDocument();
    expect(screen.getByText("second line")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show waiting message when lines are present", () => {
    const { container } = render(<LogViewer lines={["data"]} follow={false} />);

    expect(container.textContent).not.toContain("Waiting for logs...");
    expect(screen.getByText("data")).toBeInTheDocument();
  });

  it("highlights every match without hiding other lines", () => {
    const { container } = render(
      <LogViewer lines={["error: disk error", "all fine"]} follow={false} highlight={/error/gi} />,
    );

    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(["error", "error"]);
    expect(screen.getByText("all fine")).toBeInTheDocument();
  });

  it("marks the line holding the current hit", () => {
    const { container } = render(
      <LogViewer lines={["a", "b", "c"]} follow={false} highlight={/b/g} currentLine={1} />,
    );

    expect(container.querySelector('[aria-current="true"]')).toHaveAttribute("data-line", "1");
  });

  it("renders ANSI colours instead of escape codes", () => {
    const { container } = render(
      <LogViewer lines={["\x1b[38;2;255;176;0mWARNING\x1b[0m done"]} follow={false} />,
    );

    expect(container.textContent).not.toContain("\x1b");
    expect(screen.getByText("WARNING")).toHaveStyle({ color: "rgb(255, 176, 0)" });
  });

  it("highlights search hits across colour boundaries", () => {
    const { container } = render(
      <LogViewer lines={["\x1b[32mWAR\x1b[0mNING"]} follow={false} highlight={/warning/gi} />,
    );

    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks.join("")).toBe("WARNING");
  });
});

