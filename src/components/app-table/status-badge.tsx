import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthStatusCode, SyncStatusCode } from "@/types/application";

const healthColors: Record<HealthStatusCode, string> = {
  Healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Degraded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Progressing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Suspended: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  Missing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Unknown: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500",
};

const syncColors: Record<SyncStatusCode, string> = {
  Synced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  OutOfSync: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  Unknown: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500",
};

export function HealthBadge({ status }: { status: HealthStatusCode }) {
  return (
    <Badge variant="outline" className={healthColors[status] ?? healthColors.Unknown}>
      {status}
    </Badge>
  );
}

export function SyncBadge({ status }: { status: SyncStatusCode }) {
  return (
    <Badge variant="outline" className={syncColors[status] ?? syncColors.Unknown}>
      {status}
    </Badge>
  );
}

// Quieter dot-and-word form for page headers, where a row of tinted pills
// competes with the content. Progressing is an open ring so it differs from
// Healthy by shape as well as colour.
const healthDots: Record<HealthStatusCode, string> = {
  Healthy: "bg-emerald-500",
  Degraded: "bg-red-500",
  Progressing: "border-2 border-blue-500",
  Suspended: "bg-gray-400",
  Missing: "bg-amber-500",
  Unknown: "border-2 border-gray-400",
};

const syncDots: Record<SyncStatusCode, string> = {
  Synced: "bg-emerald-500",
  OutOfSync: "bg-amber-500",
  Unknown: "border-2 border-gray-400",
};

function StatusDot({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  );
}

export function HealthDot({ status }: { status: HealthStatusCode }) {
  return <StatusDot dot={healthDots[status] ?? healthDots.Unknown} label={status} />;
}

export function SyncDot({ status }: { status: SyncStatusCode }) {
  return <StatusDot dot={syncDots[status] ?? syncDots.Unknown} label={status} />;
}
