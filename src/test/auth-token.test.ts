import { describe, it, expect, beforeEach } from "vitest";
import {
  saveTokens,
  getStoredToken,
  getStoredRefreshToken,
  clearStoredToken,
  onAuthFailure,
} from "@/lib/auth-token";

describe("auth-token", () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
  });

  it("saves and retrieves auth token", () => {
    saveTokens("my-auth-token");

    expect(getStoredToken()).toBe("my-auth-token");
  });

  it("saves and retrieves refresh token", () => {
    saveTokens("auth", "my-refresh-token");

    expect(getStoredRefreshToken()).toBe("my-refresh-token");
  });

  it("clearStoredToken removes both tokens", () => {
    saveTokens("auth", "refresh");

    clearStoredToken();

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it("onAuthFailure clears auth token but preserves refresh token", () => {
    saveTokens("auth", "refresh");

    onAuthFailure();

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBe("refresh");
  });
});
