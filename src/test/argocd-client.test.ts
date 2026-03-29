import { describe, it, expect, vi, beforeEach } from "vitest";
import { argocdFetch, argocdFetchStream, ApiError } from "@/api/argocd-client";

// Mock auth-token module
vi.mock("@/lib/auth-token", () => ({
  applyStoredTokens: vi.fn(),
  getStoredRefreshToken: vi.fn(() => null),
  onAuthFailure: vi.fn(),
  saveTokens: vi.fn(),
}));

import { getStoredRefreshToken, onAuthFailure, saveTokens } from "@/lib/auth-token";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

function streamResponse(status = 200): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data"));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

describe("argocdFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ version: "1.0" }));

    const result = await argocdFetch<{ version: string }>("/api/version");

    expect(result).toEqual({ version: "1.0" });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws ApiError on non-401 error", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("not found", 404));

    await expect(argocdFetch("/api/missing")).rejects.toThrow(ApiError);
  });

  it("calls onAuthFailure on 401 without refresh token", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("unauth", 401));
    vi.mocked(getStoredRefreshToken).mockReturnValue(null);

    await expect(argocdFetch("/api/test")).rejects.toThrow(ApiError);
    expect(onAuthFailure).toHaveBeenCalled();
  });

  it("retries with new token after successful refresh", async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce(textResponse("unauth", 401));
    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse({ token: "new-token" }));
    // Retry succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: "ok" }));

    vi.mocked(getStoredRefreshToken).mockReturnValue("refresh-token");

    const result = await argocdFetch<{ data: string }>("/api/test");

    expect(result).toEqual({ data: "ok" });
    expect(saveTokens).toHaveBeenCalledWith("new-token", "refresh-token");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("calls onAuthFailure when refresh fails", async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce(textResponse("unauth", 401));
    // Refresh call fails
    mockFetch.mockResolvedValueOnce(textResponse("bad", 403));
    // No retry — still 401 from original response

    vi.mocked(getStoredRefreshToken).mockReturnValue("refresh-token");

    await expect(argocdFetch("/api/test")).rejects.toThrow(ApiError);
    expect(onAuthFailure).toHaveBeenCalled();
  });

  it("returns undefined for empty response body", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 200 }));

    const result = await argocdFetch("/api/empty");

    expect(result).toBeUndefined();
  });
});

describe("argocdFetchStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns ReadableStream on success", async () => {
    mockFetch.mockResolvedValueOnce(streamResponse());

    const stream = await argocdFetchStream("/api/logs");

    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("throws ApiError on non-401 error", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("server error", 500));

    await expect(argocdFetchStream("/api/logs")).rejects.toThrow(ApiError);
  });

  it("throws when response has no body", async () => {
    // Response with null body
    const resp = new Response(null, { status: 200 });
    mockFetch.mockResolvedValueOnce(resp);

    await expect(argocdFetchStream("/api/logs")).rejects.toThrow(
      "No response body for streaming",
    );
  });

  it("retries on 401 with refresh token", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("unauth", 401));
    mockFetch.mockResolvedValueOnce(jsonResponse({ token: "new-token" }));
    mockFetch.mockResolvedValueOnce(streamResponse());

    vi.mocked(getStoredRefreshToken).mockReturnValue("refresh-token");

    const stream = await argocdFetchStream("/api/logs");

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
