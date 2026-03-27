import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

interface LogControlsProps {
  containers: string[];
  selectedContainer: string;
  onContainerChange: (container: string) => void;
  previous: boolean;
  onPreviousChange: (previous: boolean) => void;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  sinceSeconds: number;
  onSinceSecondsChange: (seconds: number) => void;
  isStreaming: boolean;
  onStop: () => void;
  onRestart: () => void;
}

const timeRanges = [
  { label: "Last 5m", value: 300 },
  { label: "Last 15m", value: 900 },
  { label: "Last 1h", value: 3600 },
  { label: "Last 6h", value: 21600 },
  { label: "All", value: 0 },
];

export function LogControls({
  containers,
  selectedContainer,
  onContainerChange,
  previous,
  onPreviousChange,
  follow,
  onFollowChange,
  sinceSeconds,
  onSinceSecondsChange,
  isStreaming,
  onStop,
  onRestart,
}: LogControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {containers.length > 1 && (
        <Select value={selectedContainer} onValueChange={(v) => { if (v !== null) onContainerChange(v); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Container" />
          </SelectTrigger>
          <SelectContent>
            {containers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={String(sinceSeconds)}
        onValueChange={(v) => { if (v !== null) onSinceSecondsChange(Number(v)); }}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timeRanges.map((r) => (
            <SelectItem key={r.value} value={String(r.value)}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={previous}
          onCheckedChange={(checked) => onPreviousChange(checked === true)}
        />
        Previous
      </label>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={follow}
          onCheckedChange={(checked) => onFollowChange(checked === true)}
        />
        Follow
      </label>

      <Button
        variant="outline"
        size="sm"
        onClick={isStreaming ? onStop : onRestart}
      >
        {isStreaming ? (
          <>
            <Pause className="mr-1 h-4 w-4" /> Stop
          </>
        ) : (
          <>
            <Play className="mr-1 h-4 w-4" /> Start
          </>
        )}
      </Button>
    </div>
  );
}
