import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationsPage } from "@/pages/applications";

vi.mock("@/hooks/use-applications", () => ({
  useApplications: vi.fn(),
}));

vi.mock("@/hooks/use-beamline-namespace", () => ({
  useBeamlineNamespace: vi.fn(),
}));

import { useApplications } from "@/hooks/use-applications";
import { useBeamlineNamespace } from "@/hooks/use-beamline-namespace";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-search">{location.search}</div>
  );
}

function renderAt(initial: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <ApplicationsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockApplications() {
  vi.mocked(useApplications).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    dataUpdatedAt: 0,
  } as unknown as ReturnType<typeof useApplications>);
}

function mockBeamline(namespace: string | undefined) {
  vi.mocked(useBeamlineNamespace).mockReturnValue({
    data: namespace,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useBeamlineNamespace>);
}

describe("ApplicationsPage namespace auto-filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockApplications();
  });

  it("auto-sets ?ns= when URL has no ns and beamline resolves", async () => {
    mockBeamline("i16-beamline");
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe(
        "?ns=i16-beamline",
      );
    });
  });

  it("leaves an existing ?ns= untouched", async () => {
    mockBeamline("i16-beamline");
    renderAt("/?ns=b07-beamline");
    // Allow effects to flush; verify the URL did not change.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("location-search").textContent).toBe(
      "?ns=b07-beamline",
    );
  });

  it("does nothing when beamline namespace is empty", async () => {
    mockBeamline("");
    renderAt("/");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("location-search").textContent).toBe("");
  });

  it("does nothing when the hook has not yet resolved", async () => {
    mockBeamline(undefined);
    renderAt("/");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("location-search").textContent).toBe("");
  });
});
