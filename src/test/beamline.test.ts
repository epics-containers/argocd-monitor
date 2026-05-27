import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBeamlineNamespace } from "@/api/beamline";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getBeamlineNamespace", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns the namespace from /api/beamline", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ namespace: "i16-beamline" }));
    await expect(getBeamlineNamespace()).resolves.toBe("i16-beamline");
    expect(mockFetch).toHaveBeenCalledWith("/api/beamline");
  });

  it("returns empty string when the server reports no match", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ namespace: "" }));
    await expect(getBeamlineNamespace()).resolves.toBe("");
  });

  it("treats a missing namespace field as empty", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await expect(getBeamlineNamespace()).resolves.toBe("");
  });

  it("throws when the endpoint returns an error status", async () => {
    mockFetch.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    await expect(getBeamlineNamespace()).rejects.toThrow(/500/);
  });
});
