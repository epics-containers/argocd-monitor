import { useEffect, useRef, type ReactNode } from "react";
import { matchRanges } from "@/lib/log-search";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  lines: string[];
  follow: boolean;
  /** Pattern to highlight while a search is active. */
  highlight?: RegExp;
  /** Index of the line holding the current search hit, scrolled into view. */
  currentLine?: number;
}

function highlighted(text: string, pattern: RegExp): ReactNode {
  const ranges = matchRanges(text, pattern);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-yellow-300/70 text-foreground dark:bg-yellow-500/40">
        {text.slice(start, end)}
      </mark>,
    );
    pos = end;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return parts;
}

export function LogViewer({ lines, follow, highlight, currentLine }: LogViewerProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  // Following tails the log, except while searching: new lines must not pull
  // the view away from the hit being looked at.
  useEffect(() => {
    if (follow && !highlight && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, follow, highlight]);

  useEffect(() => {
    if (currentLine === undefined) return;
    const el = containerRef.current?.querySelector(`[data-line="${currentLine}"]`);
    el?.scrollIntoView?.({ block: "center" });
  }, [currentLine, highlight]);

  return (
    <pre
      ref={containerRef}
      className="h-[calc(100vh-320px)] min-h-[400px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs leading-5 text-foreground"
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground">Waiting for logs...</span>
      ) : (
        lines.map((line, i) => (
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
            {highlight ? highlighted(line, highlight) : line}
          </div>
        ))
      )}
    </pre>
  );
}
