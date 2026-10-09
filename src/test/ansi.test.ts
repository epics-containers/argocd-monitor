import { describe, it, expect } from "vitest";
import { parseAnsi, stripAnsi } from "@/lib/ansi";

const LINE =
  "2026-10-09 11:29:59,041 \x1b[38;2;255;176;0m WARNING\x1b[0m \x1b[32mopentelemetry.attributes\x1b[0m Invalid type";

describe("parseAnsi", () => {
  it("leaves plain lines alone", () => {
    expect(parseAnsi("plain")).toEqual({ text: "plain", segments: [] });
  });

  it("strips codes and styles 24-bit and basic colours", () => {
    const { text, segments } = parseAnsi(LINE);
    expect(text).toBe("2026-10-09 11:29:59,041  WARNING opentelemetry.attributes Invalid type");
    expect(segments.map((s) => [text.slice(s.start, s.end), s.style.color])).toEqual([
      [" WARNING", "rgb(255, 176, 0)"],
      ["opentelemetry.attributes", "#16a34a"],
    ]);
  });

  it("handles 256-colour, background, bold and partial resets", () => {
    const { text, segments } = parseAnsi("\x1b[1;38;5;196;44mA\x1b[22mB\x1b[39;49mC\x1b[mD");
    expect(text).toBe("ABCD");
    expect(segments).toEqual([
      { start: 0, end: 1, style: { bold: true, color: "rgb(255, 0, 0)", background: "#2563eb" } },
      {
        start: 1,
        end: 2,
        style: { bold: undefined, dim: undefined, color: "rgb(255, 0, 0)", background: "#2563eb" },
      },
    ]);
  });

  it("drops non-colour escapes such as erase-line", () => {
    expect(parseAnsi("a\x1b[2Kb\x1b[?25lc").text).toBe("abc");
  });

  it("ignores a malformed 24-bit colour", () => {
    expect(parseAnsi("\x1b[38;2;999;0;0mx").segments).toEqual([]);
  });
});

describe("stripAnsi", () => {
  it("returns the visible text", () => {
    expect(stripAnsi(LINE)).toBe(parseAnsi(LINE).text);
  });
});
