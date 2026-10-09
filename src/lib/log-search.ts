export interface LogSearchOptions {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
}

/** A compiled search: nothing to search for, an invalid regex, or a pattern. */
export type LogMatcher =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "ok"; pattern: RegExp };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileLogSearch({ query, regex, caseSensitive }: LogSearchOptions): LogMatcher {
  if (!query) return { kind: "none" };
  try {
    const source = regex ? query : escapeRegex(query);
    return { kind: "ok", pattern: new RegExp(source, caseSensitive ? "g" : "gi") };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Whether ``line`` matches. Uses a fresh lastIndex so the shared global
 *  pattern carries no state between lines. */
export function lineMatches(line: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(line);
}

/** [start, end) of every non-empty match in ``line``, for highlighting.
 *  Zero-length matches (``^``, ``a*``) still let a line pass the filter but
 *  have nothing to highlight, and are stepped over so the loop terminates. */
export function matchRanges(line: string, pattern: RegExp): [number, number][] {
  const ranges: [number, number][] = [];
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(line)) !== null) {
    if (m[0].length === 0) {
      pattern.lastIndex++;
      continue;
    }
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}
