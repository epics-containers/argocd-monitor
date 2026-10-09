import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { parseAnsi, type AnsiStyle, type ParsedAnsi } from "@/lib/ansi";
import { matchRanges } from "@/lib/log-search";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  lines: string[];
  follow: boolean;
  /** Pattern to highlight while a search is active; matched against the
   *  visible text, never the escape codes. */
  highlight?: RegExp;
  /** Index of the line holding the current search hit, scrolled into view. */
  currentLine?: number;
}

function css(style: AnsiStyle): CSSProperties {
  return {
    color: style.color,
    backgroundColor: style.background,
    fontWeight: style.bold ? 600 : undefined,
    opacity: style.dim ? 0.7 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
  };
}

/** The line as styled runs, with search hits wrapped in <mark>. ANSI runs and
 *  hits overlap freely, so the text is cut at every boundary of either. */
function renderLine({ text, segments }: ParsedAnsi, pattern?: RegExp): ReactNode {
  const hits = pattern ? matchRanges(text, pattern) : [];
  if (segments.length === 0 && hits.length === 0) return text;
  const cuts = new Set([0, text.length]);
  for (const s of segments) cuts.add(s.start).add(s.end);
  for (const [a, b] of hits) cuts.add(a).add(b);
  const points = [...cuts].sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]];
    const seg = segments.find((s) => s.start <= start && start < s.end);
    const chunk = text.slice(start, end);
    let node: ReactNode = seg ? <span style={css(seg.style)}>{chunk}</span> : chunk;
    if (hits.some(([a, b]) => a <= start && start < b)) {
      node = (
        <mark className="rounded-sm bg-yellow-300/70 text-foreground dark:bg-yellow-500/40">
          {node}
        </mark>
      );
    }
    parts.push(<span key={start}>{node}</span>);
  }
  return parts;
}

export function LogViewer({ lines, follow, highlight, currentLine }: LogViewerProps) {
  const containerRef = useRef<HTMLPreElement>(null);
  const parsed = useMemo(() => lines.map(parseAnsi), [lines]);

  // Following tails the log, except while searching: new lines must not pull
  // the view away from the hit being looked at.
  useEffect(() => {
    if (follow && !highlight && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, follow, highlight]);

  useEffect(() => {
    if (currentLine === undefined) return;
    // Scroll the viewer only: scrollIntoView would also scroll the page and
    // could push the search bar out of sight on a short window.
    const box = containerRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${currentLine}"]`);
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
  }, [currentLine, highlight]);

  return (
    <pre
      ref={containerRef}
      className="relative h-[calc(100vh-320px)] min-h-[400px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs leading-5 text-foreground"
    >
      {parsed.length === 0 ? (
        <span className="text-muted-foreground">Waiting for logs...</span>
      ) : (
        parsed.map((line, i) => (
          <div
            key={i}
            data-line={i}
            aria-current={i === currentLine || undefined}
            className={cn(
              "hover:bg-muted-foreground/10",
              i === currentLine && "bg-yellow-200/50 ring-1 ring-yellow-500/60 dark:bg-yellow-500/15",
            )}
          >
            <span className="mr-3 inline-block w-12 select-none text-right text-muted-foreground">
              {i + 1}
            </span>
            {renderLine(line, highlight)}
          </div>
        ))
      )}
    </pre>
  );
}
