import { useEffect, useRef } from "react";

interface LogViewerProps {
  lines: string[];
  follow: boolean;
}

export function LogViewer({ lines, follow }: LogViewerProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (follow && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, follow]);

  return (
    <pre
      ref={containerRef}
      className="h-[calc(100vh-280px)] min-h-[400px] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-200"
    >
      {lines.length === 0 ? (
        <span className="text-zinc-500">Waiting for logs...</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="hover:bg-zinc-800/50">
            <span className="mr-3 inline-block w-12 select-none text-right text-zinc-600">
              {i + 1}
            </span>
            {line}
          </div>
        ))
      )}
    </pre>
  );
}
