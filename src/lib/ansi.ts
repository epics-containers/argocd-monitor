// ANSI escape handling for container logs. Loggers that think they write to a
// terminal colour their output with SGR sequences (ESC [ ... m); `kubectl logs`
// passes them through untouched.

export interface AnsiStyle {
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** A run of the visible text, [start, end), with one style. */
export interface AnsiSegment {
  start: number;
  end: number;
  style: AnsiStyle;
}

export interface ParsedAnsi {
  /** The line with every escape sequence removed: what is shown and searched. */
  text: string;
  segments: AnsiSegment[];
}

// Any CSI sequence (colours, cursor moves, erase-line), plus bare OSC titles.
// eslint-disable-next-line no-control-regex
const ESCAPE = /\x1b\[([0-9;?]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// The 16 standard colours, mid-tone so they read on both the light and the
// dark log background.
const BASIC = [
  "#4b5563", // black (grey, or it vanishes in dark mode)
  "#dc2626", // red
  "#16a34a", // green
  "#ca8a04", // yellow
  "#2563eb", // blue
  "#c026d3", // magenta
  "#0891b2", // cyan
  "#9ca3af", // white (grey, or it vanishes in light mode)
];
const BRIGHT = ["#6b7280", "#ef4444", "#22c55e", "#eab308", "#3b82f6", "#d946ef", "#06b6d4", "#d1d5db"];

function color256(n: number): string | undefined {
  if (n < 8) return BASIC[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n < 232) {
    const c = n - 16;
    const level = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return `rgb(${level(Math.floor(c / 36))}, ${level(Math.floor(c / 6) % 6)}, ${level(c % 6)})`;
  }
  if (n < 256) {
    const g = 8 + (n - 232) * 10;
    return `rgb(${g}, ${g}, ${g})`;
  }
  return undefined;
}

/** Apply one SGR parameter list to ``style``, returning the new style. */
function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params === "" ? [0] : params.split(";").map((p) => (p === "" ? 0 : Number(p)));
  let s = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) s = {};
    else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 3) s.italic = true;
    else if (c === 4) s.underline = true;
    else if (c === 22) s.bold = s.dim = undefined;
    else if (c === 23) s.italic = undefined;
    else if (c === 24) s.underline = undefined;
    else if (c >= 30 && c <= 37) s.color = BASIC[c - 30];
    else if (c >= 90 && c <= 97) s.color = BRIGHT[c - 90];
    else if (c === 39) s.color = undefined;
    else if (c >= 40 && c <= 47) s.background = BASIC[c - 40];
    else if (c >= 100 && c <= 107) s.background = BRIGHT[c - 100];
    else if (c === 49) s.background = undefined;
    else if (c === 38 || c === 48) {
      // Extended colour: 5;n (256-colour) or 2;r;g;b (24-bit).
      let value: string | undefined;
      if (codes[i + 1] === 5) {
        value = color256(codes[i + 2]);
        i += 2;
      } else if (codes[i + 1] === 2) {
        const [r, g, b] = codes.slice(i + 2, i + 5);
        if ([r, g, b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
          value = `rgb(${r}, ${g}, ${b})`;
        }
        i += 4;
      }
      if (c === 38) s.color = value;
      else s.background = value;
    }
  }
  return s;
}

const isPlain = (s: AnsiStyle) => Object.values(s).every((v) => v === undefined);

/** Split ``line`` into its visible text and styled runs. */
export function parseAnsi(line: string): ParsedAnsi {
  if (!line.includes("\x1b")) return { text: line, segments: [] };
  const segments: AnsiSegment[] = [];
  let text = "";
  let style: AnsiStyle = {};
  let pos = 0;
  const emit = (chunk: string) => {
    if (!chunk) return;
    if (!isPlain(style)) segments.push({ start: text.length, end: text.length + chunk.length, style });
    text += chunk;
  };
  ESCAPE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ESCAPE.exec(line)) !== null) {
    emit(line.slice(pos, m.index));
    if (m[2] === "m") style = applySgr(style, m[1]);
    pos = ESCAPE.lastIndex;
  }
  emit(line.slice(pos));
  return { text, segments };
}

/** ``line`` without escape sequences. */
export function stripAnsi(line: string): string {
  return line.includes("\x1b") ? line.replace(ESCAPE, "") : line;
}
