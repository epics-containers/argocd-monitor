import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenDialog } from "@/components/shared/token-dialog";

vi.mock("@/lib/auth-token", () => ({
  getStoredToken: vi.fn(() => null),
  getStoredRefreshToken: vi.fn(() => null),
  saveTokens: vi.fn(),
}));

import { getStoredToken, getStoredRefreshToken } from "@/lib/auth-token";

describe("TokenDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredToken).mockReturnValue(null);
    vi.mocked(getStoredRefreshToken).mockReturnValue(null);
  });

  it("renders dialog title and instructions when open", () => {
    render(<TokenDialog open={true} onTokenSubmit={vi.fn()} />);

    expect(screen.getAllByText("ArgoCD Authentication").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Connect").length).toBeGreaterThanOrEqual(1);
  });

  it("renders auth and refresh token inputs", () => {
    render(<TokenDialog open={true} onTokenSubmit={vi.fn()} />);

    expect(screen.getAllByPlaceholderText("auth-token").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByPlaceholderText("refresh-token (optional)").length).toBeGreaterThanOrEqual(1);
  });

  it("connect button is disabled when auth token is empty", () => {
    render(<TokenDialog open={true} onTokenSubmit={vi.fn()} />);

    const buttons = screen.getAllByRole("button", { name: "Connect" });
    // At least one Connect button should be disabled
    expect(buttons.some((b) => b.hasAttribute("disabled"))).toBe(true);
  });

  it("renders login instructions", () => {
    render(<TokenDialog open={true} onTokenSubmit={vi.fn()} />);

    expect(screen.getAllByText(/argocd login/).length).toBeGreaterThanOrEqual(1);
  });
});
