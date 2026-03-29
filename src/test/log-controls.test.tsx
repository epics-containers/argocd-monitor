import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogControls } from "@/components/log-viewer/log-controls";

const defaultProps = {
  containers: [],
  selectedContainer: "",
  onContainerChange: vi.fn(),
  previous: false,
  onPreviousChange: vi.fn(),
  follow: true,
  onFollowChange: vi.fn(),
  sinceSeconds: 0,
  onSinceSecondsChange: vi.fn(),
  tailLines: 1000,
  onTailLinesChange: vi.fn(),
  isStreaming: true,
  onStop: vi.fn(),
  onRestart: vi.fn(),
};

describe("LogControls", () => {
  it("shows Stop button when streaming", () => {
    render(<LogControls {...defaultProps} isStreaming={true} />);

    expect(screen.getAllByText(/Stop/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Start button when not streaming", () => {
    render(<LogControls {...defaultProps} isStreaming={false} />);

    expect(screen.getAllByText(/Start/).length).toBeGreaterThanOrEqual(1);
  });

  it("hides container selector when only one container", () => {
    render(<LogControls {...defaultProps} containers={["main"]} />);

    expect(screen.queryByText("main")).not.toBeInTheDocument();
  });

  it("renders Follow and Previous checkboxes", () => {
    render(<LogControls {...defaultProps} />);

    expect(screen.getAllByText("Follow").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Previous").length).toBeGreaterThanOrEqual(1);
  });
});
