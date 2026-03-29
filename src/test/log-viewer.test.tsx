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
});
