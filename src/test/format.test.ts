import { describe, it, expect, vi, afterEach } from "vitest";
import { formatAge } from "@/lib/format";

describe("formatAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '-' for undefined", () => {
    expect(formatAge(undefined)).toBe("-");
  });

  it("returns '-' for empty string", () => {
    expect(formatAge("")).toBe("-");
  });

  it("returns seconds for < 60s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:30Z"));

    expect(formatAge("2026-03-29T12:00:00Z")).toBe("30s");
  });

  it("returns minutes for < 60m", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:05:00Z"));

    expect(formatAge("2026-03-29T12:00:00Z")).toBe("5m");
  });

  it("returns hours for < 24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T15:00:00Z"));

    expect(formatAge("2026-03-29T12:00:00Z")).toBe("3h");
  });

  it("returns days for >= 24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));

    expect(formatAge("2026-03-29T12:00:00Z")).toBe("3d");
  });
});
