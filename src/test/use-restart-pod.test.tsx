import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRestartAllPods } from "@/hooks/use-restart-pod";

vi.mock("@/api/resources", () => ({
  deletePod: vi.fn(),
}));

import { deletePod } from "@/api/resources";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const pods = [0, 1, 2].map((i) => ({ name: `pod-${i}`, namespace: "ns" }));

describe("useRestartAllPods", () => {
  beforeEach(() => {
    vi.mocked(deletePod).mockReset();
  });

  it("deletes every pod", async () => {
    vi.mocked(deletePod).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRestartAllPods(), { wrapper });

    result.current.mutate({ appName: "svc", pods, appNamespace: "argocd" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletePod).toHaveBeenCalledTimes(3);
    expect(deletePod).toHaveBeenCalledWith("svc", "pod-2", "ns", "argocd");
  });

  it("still deletes the other pods and reports which one failed", async () => {
    vi.mocked(deletePod).mockImplementation((_app, podName) =>
      podName === "pod-1" ? Promise.reject(new Error("forbidden")) : Promise.resolve(undefined),
    );
    const { result } = renderHook(() => useRestartAllPods(), { wrapper });

    result.current.mutate({ appName: "svc", pods });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("pod-1: forbidden");
    expect(deletePod).toHaveBeenCalledTimes(3);
  });
});
