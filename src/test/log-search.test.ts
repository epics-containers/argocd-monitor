import { describe, it, expect } from "vitest";
import { compileLogSearch, lineMatches, matchRanges } from "@/lib/log-search";

const compile = (query: string, regex = false, caseSensitive = false) => {
  const m = compileLogSearch({ query, regex, caseSensitive });
  if (m.kind !== "ok") throw new Error(`expected a pattern, got ${m.kind}`);
  return m.pattern;
};

describe("compileLogSearch", () => {
  it("is inactive for an empty query", () => {
    expect(compileLogSearch({ query: "", regex: true, caseSensitive: false })).toEqual({
      kind: "none",
    });
  });

  it("treats plain text literally", () => {
    const p = compile("a.b(c)");
    expect(lineMatches("x a.b(c) y", p)).toBe(true);
    expect(lineMatches("aXb(c)", p)).toBe(false);
  });

  it("supports regular expressions", () => {
    const p = compile("^ERROR|WARN\\b", true);
    expect(lineMatches("ERROR boom", p)).toBe(true);
    expect(lineMatches("a WARN here", p)).toBe(true);
    expect(lineMatches("WARNING", p)).toBe(false);
  });

  it("ignores case unless asked", () => {
    expect(lineMatches("Error", compile("error"))).toBe(true);
    expect(lineMatches("Error", compile("error", false, true))).toBe(false);
  });

  it("reports an invalid regex instead of throwing", () => {
    const m = compileLogSearch({ query: "(unclosed", regex: true, caseSensitive: false });
    expect(m.kind).toBe("error");
    // The same text is fine as a plain search.
    expect(compileLogSearch({ query: "(unclosed", regex: false, caseSensitive: false }).kind).toBe(
      "ok",
    );
  });
});

describe("lineMatches", () => {
  it("carries no state between lines through the global flag", () => {
    const p = compile("x");
    expect(["x", "x", "x"].map((l) => lineMatches(l, p))).toEqual([true, true, true]);
  });
});

describe("matchRanges", () => {
  it("finds every non-overlapping match", () => {
    expect(matchRanges("abcabc", compile("bc"))).toEqual([
      [1, 3],
      [4, 6],
    ]);
  });

  it("terminates on zero-length matches and highlights nothing for them", () => {
    const p = compile("x*", true);
    expect(matchRanges("abc", p)).toEqual([]);
    expect(lineMatches("abc", p)).toBe(true);
    expect(matchRanges("axxb", p)).toEqual([[1, 3]]);
  });
});
