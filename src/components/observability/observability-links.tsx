import {
  ChartLine,
  Cpu,
  Gauge,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Microchip,
  Network,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  shortNodeName,
  type LinkGroup,
  type LinkKind,
  type ObservabilityLink,
} from "@/lib/observability";

interface LinkStyle {
  icon: LucideIcon;
  /** Chip text; the group heading already names the pod/node/workload. */
  short: string;
  /** Grafana dashboard title (kube-prometheus-stack), Explore query summary
   *  or Graylog search. */
  target: string;
  /** Default time range; a link's own `range` takes precedence. */
  range?: string;
  /** Tool the link opens, for the accessible name. */
  tool: "Grafana" | "Graylog";
}

const GRAFANA = { tool: "Grafana", range: "Last 6 hours" } as const;

const LINK_STYLES: Record<LinkKind, LinkStyle> = {
  workload: {
    ...GRAFANA,
    icon: Gauge,
    short: "Resources",
    target: "Kubernetes / Compute Resources / Workload",
  },
  workloadCpu: {
    ...GRAFANA,
    icon: Cpu,
    short: "CPU",
    target: "CPU usage panel of Kubernetes / Compute Resources / Workload",
  },
  workloadMemory: {
    ...GRAFANA,
    icon: MemoryStick,
    short: "Memory",
    target: "Memory usage panel of Kubernetes / Compute Resources / Workload",
  },
  pod: { ...GRAFANA, icon: Gauge, short: "Resources", target: "Kubernetes / Compute Resources / Pod" },
  podNetwork: {
    ...GRAFANA,
    icon: Network,
    short: "Network",
    target: "Kubernetes / Networking / Pod",
  },
  volume: { ...GRAFANA, icon: HardDrive, short: "Volume", target: "Kubernetes / Persistent Volumes" },
  node: {
    ...GRAFANA,
    icon: LayoutGrid,
    short: "Pods",
    target: "Kubernetes / Compute Resources / Node (Pods)",
  },
  nodeHardware: {
    ...GRAFANA,
    icon: Microchip,
    short: "Hardware",
    target: "Node Exporter / Nodes",
    range: "Last hour",
  },
  cpu: { ...GRAFANA, icon: Cpu, short: "CPU", target: "Explore: CPU usage per pod" },
  memory: {
    ...GRAFANA,
    icon: MemoryStick,
    short: "Memory",
    target: "Explore: working-set memory per pod",
  },
  restarts: {
    ...GRAFANA,
    icon: RotateCcw,
    short: "Restarts",
    target: "Explore: container restarts per pod",
  },
  logs: { tool: "Graylog", icon: ScrollText, short: "Graylog", target: "historical logs" },
};

/** Accessible name: the link, the dashboard or search it opens, its range and tool. */
function linkAriaLabel(link: ObservabilityLink): string {
  const style = LINK_STYLES[link.kind];
  const range = link.range ?? style.range;
  return `${link.label}: ${style.target}${range ? `, ${range.toLowerCase()}` : ""} (opens ${style.tool} in a new tab)`;
}

/** "Last 6 hours" → "6h", for the compact range column in menus. */
function shortRange(range: string | undefined): string | undefined {
  const m = range && /^Last (?:(\d+) )?(second|minute|hour|day)s?$/.exec(range);
  return m ? `${m[1] ?? "1"}${m[2] === "minute" ? "m" : m[2][0]}` : range;
}

/** Links about one pod (its dashboards, and Graylog for a bare pod) and the
 *  node it runs on, behind one icon button so pod rows stay calm. */
export function PodLinksMenu({
  podName,
  links,
  pending,
  node,
}: {
  podName: string;
  links: ObservabilityLink[];
  pending: boolean;
  node?: LinkGroup;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Dashboards for pod ${podName}`}
            title="Dashboards"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <ChartLine className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Pod</DropdownMenuLabel>
          {links.map((l) => (
            <MenuLink key={l.url} link={l} />
          ))}
          {pending && (
            <p className="px-1.5 py-1 text-xs text-muted-foreground">Loading network and volume links…</p>
          )}
        </DropdownMenuGroup>
        {node && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel title={node.name}>Node {shortNodeName(node.name)}</DropdownMenuLabel>
              {node.links.map((l) => (
                <MenuLink key={l.url} link={l} />
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuLink({ link }: { link: ObservabilityLink }) {
  const style = LINK_STYLES[link.kind];
  const Icon = style.icon;
  return (
    <DropdownMenuLinkItem
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={linkAriaLabel(link)}
      title={link.query}
    >
      <Icon className="text-muted-foreground" />
      <span className="truncate">{link.subject ?? style.short}</span>
      <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">
        {shortRange(link.range ?? style.range)}
      </span>
    </DropdownMenuLinkItem>
  );
}

/** A compact external link: icon, short label and a tooltip naming the target. */
export function LinkChip({ link }: { link: ObservabilityLink }) {
  const style = LINK_STYLES[link.kind];
  const Icon = style.icon;
  // Volume chips name the claim, which can be long; the rest use short labels.
  const text = link.subject ?? style.short;
  const range = link.range ?? style.range;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={linkAriaLabel(link)}
            className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs outline-none transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          />
        }
      >
        {/* Only Graylog gets an icon: it leaves Grafana, the rest are plain labels. */}
        {style.tool === "Graylog" && (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        )}
        <span className={link.subject ? "truncate" : undefined}>{text}</span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span className="font-medium">{style.target}</span>
        {link.query && <span className="font-mono text-[11px] break-all">{link.query}</span>}
        <span className="opacity-70">
          {range ? `${range} · opens in a new tab` : "Opens in a new tab"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
