import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { LogMatcher, LogSearchOptions } from "@/lib/log-search";
import { cn } from "@/lib/utils";

interface LogSearchBarProps {
  search: LogSearchOptions;
  onSearchChange: (search: LogSearchOptions) => void;
  matcher: LogMatcher;
  /** Number of lines with a hit, and the 0-based position of the current one. */
  hitCount: number;
  current: number;
  /** The hits still describe the previous query (the search is catching up). */
  pending?: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

const iconButton =
  "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";

function Toggle({
  pressed,
  onPressedChange,
  label,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        iconButton,
        "font-mono text-xs",
        pressed
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function LogSearchBar({
  search,
  onSearchChange,
  matcher,
  hitCount,
  current,
  pending,
  onNext,
  onPrevious,
}: LogSearchBarProps) {
  const set = (patch: Partial<LogSearchOptions>) => onSearchChange({ ...search, ...patch });
  const invalid = matcher.kind === "error";
  const active = matcher.kind === "ok";
  const nav = cn(iconButton, "text-muted-foreground hover:bg-muted hover:text-foreground");

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search.query}
            onChange={(e) => set({ query: e.target.value })}
            onKeyDown={(e) => {
              // Enter / Esc confirm or cancel an IME candidate mid-composition.
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) onPrevious();
                else onNext();
              } else if (e.key === "Escape") {
                set({ query: "" });
              }
            }}
            placeholder={search.regex ? "Search logs by regex" : "Search logs"}
            aria-label="Search logs"
            aria-invalid={invalid || undefined}
            spellCheck={false}
            className="pr-24 pl-8 font-mono [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
            {search.query && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search (Esc)"
                onClick={() => set({ query: "" })}
                className={nav}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Toggle
              pressed={search.caseSensitive}
              onPressedChange={(caseSensitive) => set({ caseSensitive })}
              label="Match case"
            >
              Aa
            </Toggle>
            <Toggle
              pressed={search.regex}
              onPressedChange={(regex) => set({ regex })}
              label="Use regular expression"
            >
              .*
            </Toggle>
          </div>
        </div>
        {active && (
          <div className="flex items-center gap-1">
            <span
              className="min-w-20 text-right text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {pending
                ? "…"
                : hitCount === 0
                ? "No results"
                : `${(current + 1).toLocaleString()} of ${hitCount.toLocaleString()}`}
            </span>
            <button
              type="button"
              aria-label="Previous match"
              title="Previous match (Shift+Enter)"
              onClick={onPrevious}
              disabled={pending || hitCount === 0}
              className={nav}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next match"
              title="Next match (Enter)"
              onClick={onNext}
              disabled={pending || hitCount === 0}
              className={nav}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {invalid && (
        <p className="text-xs text-destructive" role="alert">
          Invalid regex: {matcher.message}
        </p>
      )}
    </div>
  );
}
