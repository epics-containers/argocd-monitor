import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStoppableWorkload } from "@/api/resources";

vi.mock("@/lib/auth-token", () => ({
  applyStoredTokens: vi.fn(),
  getStoredRefreshToken: vi.fn(() => null),
  getAuthModeSnapshot: vi.fn(() => "manual"),
  onAuthFailure: vi.fn(),
  redirectToLogin: vi.fn(() => true),
  saveTokens: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function manifestResponse(manifest: object): Response {
  return jsonResponse({ manifest: JSON.stringify(manifest) });
}

describe("getStoppableWorkload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the resource tree contains no StatefulSet/Deployment", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          { kind: "Pod", group: "", version: "v1", name: "p", namespace: "ns" },
        ],
      }),
    );

    const result = await getStoppableWorkload("svc-a", "argocd");

    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when the workload manifest has no `enabled` label", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          {
            kind: "StatefulSet",
            group: "apps",
            version: "v1",
            name: "svc-a",
            namespace: "ns",
          },
        ],
      }),
    );
    mockFetch.mockResolvedValueOnce(
      manifestResponse({
        metadata: { name: "svc-a", labels: { app: "svc-a" } },
      }),
    );

    const result = await getStoppableWorkload("svc-a", "argocd");

    expect(result).toBeNull();
  });

  it("returns the workload identity when the manifest carries an `enabled` label", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          {
            kind: "StatefulSet",
            group: "apps",
            version: "v1",
            name: "svc-a",
            namespace: "ns",
          },
        ],
      }),
    );
    mockFetch.mockResolvedValueOnce(
      manifestResponse({
        metadata: { name: "svc-a", labels: { enabled: "true", app: "svc-a" } },
      }),
    );

    const result = await getStoppableWorkload("svc-a", "argocd");

    expect(result).toEqual({
      kind: "StatefulSet",
      name: "svc-a",
      namespace: "ns",
      group: "apps",
      version: "v1",
    });
  });

  it("works for a Deployment as well as a StatefulSet", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          {
            kind: "Deployment",
            group: "apps",
            version: "v1",
            name: "svc-a",
            namespace: "ns",
          },
        ],
      }),
    );
    mockFetch.mockResolvedValueOnce(
      manifestResponse({
        metadata: { name: "svc-a", labels: { enabled: "false" } },
      }),
    );

    const result = await getStoppableWorkload("svc-a", "argocd");

    expect(result?.kind).toBe("Deployment");
  });

  it("returns the `domain` label as the parent app name when present", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        nodes: [
          {
            kind: "StatefulSet",
            group: "apps",
            version: "v1",
            name: "svc-a",
            namespace: "ns",
          },
        ],
      }),
    );
    mockFetch.mockResolvedValueOnce(
      manifestResponse({
        metadata: { name: "svc-a", labels: { enabled: "true", domain: "p47" } },
      }),
    );

    const result = await getStoppableWorkload("svc-a", "argocd");

    expect(result?.domain).toBe("p47");
  });
});
