import { useMemo, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Box,
  Cpu,
  Gauge,
  HardDrive,
  LayoutGrid,
  Layers,
  MemoryStick,
  Microchip,
  Network,
  RotateCcw,
  ScrollText,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useObservabilityConfig } from "@/hooks/use-observability-config";
import { usePodManifests } from "@/hooks/use-pod-manifests";
import { buildGrafanaLinks, resolveGrafanaBaseUrl } from "@/lib/grafana";
import { buildGraylogLinks, resolveGraylogTemplate } from "@/lib/graylog";
import {
  mergeLinkGroups,
  type LinkGroup,
  type LinkKind,
  type ObservabilityLink,
} from "@/lib/observability";
import type { ApplicationDestination } from "@/types/application";
import type { ResourceNode } from "@/types/resource";

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
  logs: { tool: "Graylog", icon: ScrollText, short: "History", target: "Graylog" },
};

interface ObservabilityLinksSectionProps {
  appName: string;
  appNamespace?: string;
  destination: ApplicationDestination;
  nodes: ResourceNode[];
}

interface LinkView {
  app: ObservabilityLink[];
  workloads: LinkGroup[];
  pods: LinkGroup[];
  nodes: LinkGroup[];
}

/** Observability links for an Application: dashboards in the destination
 *  cluster's Grafana and historical logs in the global Graylog. Each source is
 *  configured independently; renders nothing when neither applies. */
export function ObservabilityLinksSection({
  appName,
  appNamespace,
  destination,
  nodes,
}: ObservabilityLinksSectionProps) {
  const { data: config } = useObservabilityConfig();
  const baseUrl = resolveGrafanaBaseUrl(destination, config?.grafana);
  const graylogTemplate = resolveGraylogTemplate(config?.graylog);
  const graylogPodField = config?.graylog.podField;
  const datasourceUid = config?.grafana.datasourceUid;
  const pods = useMemo(() => nodes.filter((n) => n.kind === "Pod"), [nodes]);
  // Pod manifests only feed Grafana links (network, volumes, nodes).
  const {
    manifests,
    pending: pendingPods,
    isLoading: grafanaLoading,
  } = usePodManifests(appName, pods, appNamespace, !!baseUrl);
  const manifestsLoading = !!baseUrl && grafanaLoading;

  const links = useMemo((): LinkView | null => {
    if (!baseUrl && !graylogTemplate) return null;
    const grafana = baseUrl
      ? buildGrafanaLinks({
          baseUrl,
          datasourceUid,
          nodes,
          podManifests: manifests,
          pendingPods,
        })
      : { app: [], workloads: [], pods: [], nodes: [] };
    const graylog = graylogTemplate
      ? buildGraylogLinks({ urlTemplate: graylogTemplate, podField: graylogPodField, nodes })
      : { workloads: [], pods: [] };
    return {
      app: grafana.app,
      workloads: mergeLinkGroups(grafana.workloads, graylog.workloads),
      pods: mergeLinkGroups(grafana.pods, graylog.pods),
      nodes: grafana.nodes,
    };
  }, [baseUrl, graylogTemplate, graylogPodField, datasourceUid, nodes, manifests, pendingPods]);

  if (!links) return null;
  const empty =
    links.app.length === 0 &&
    links.workloads.length === 0 &&
    links.pods.length === 0 &&
    links.nodes.length === 0;
  // Node rows only appear once pod manifests arrive; hold their space meanwhile.
  const nodesPending = manifestsLoading && links.nodes.length === 0 && pods.length > 0;
  const sources = [
    baseUrl && `Grafana dashboards · ${hostOf(baseUrl)}`,
    graylogTemplate && `Graylog logs · ${hostOf(graylogTemplate)}`,
  ].filter((s): s is string => Boolean(s));

  return (
    <section aria-labelledby="observability-heading" aria-busy={manifestsLoading}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 id="observability-heading" className="text-lg font-medium">
            Observability
          </h3>
          {sources.map((source) => (
            <span key={source} className="truncate text-xs text-muted-foreground">
              {source}
            </span>
          ))}
        </div>
        {baseUrl && (
          <a
            href={baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Open Grafana
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
          </a>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">No workloads or pods to link to.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {links.app.length > 0 && (
            <LinkSection icon={Activity} title="Application">
              <LinkRow links={links.app} />
            </LinkSection>
          )}
          {links.workloads.length > 0 && (
            <LinkSection icon={Layers} title="Workloads">
              <LinkGroups groups={links.workloads} />
            </LinkSection>
          )}
          {links.pods.length > 0 && (
            <LinkSection icon={Box} title="Pods">
              <LinkGroups groups={links.pods} />
            </LinkSection>
          )}
          {links.nodes.length > 0 ? (
            <LinkSection icon={Server} title={links.nodes.length > 1 ? "Nodes" : "Node"}>
              <LinkGroups groups={links.nodes} shortNames />
            </LinkSection>
          ) : (
            nodesPending && (
              <LinkSection icon={Server} title="Node">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <Skeleton className="h-4 w-56 max-w-full sm:shrink-0" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                </div>
              </LinkSection>
            )
          )}
        </div>
      )}
    </section>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function LinkSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-4 md:flex-row md:gap-6">
      <h4 className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground md:h-7 md:w-32">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Node names are FQDNs; the first label is what people call the machine, and
// the full name stays in the tooltip.
function LinkGroups({ groups, shortNames }: { groups: LinkGroup[]; shortNames?: boolean }) {
  return (
    <ul className="space-y-3 sm:space-y-2">
      {groups.map((g) => (
        <li
          key={`${g.detail ?? ""}/${g.name}`}
          className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="flex min-w-0 items-baseline gap-2 sm:h-7 sm:w-72 sm:shrink-0 sm:items-center">
            <span className="truncate text-sm font-medium" title={g.name}>
              {shortNames ? g.name.split(".")[0] : g.name}
            </span>
            {g.detail && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {g.detail}
              </span>
            )}
          </div>
          <LinkRow links={g.links} pending={g.pending} />
        </li>
      ))}
    </ul>
  );
}

function LinkRow({ links, pending }: { links: ObservabilityLink[]; pending?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {links.map((l) => (
        <LinkChip key={l.url} link={l} />
      ))}
      {/* Network/volume chips depend on the pod manifest; hold their space. */}
      {pending && <Skeleton className="h-7 w-20" />}
    </div>
  );
}

function LinkChip({ link }: { link: ObservabilityLink }) {
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
            aria-label={`${link.label}: ${style.target}${range ? `, ${range.toLowerCase()}` : ""} (opens ${style.tool} in a new tab)`}
            className="group inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium shadow-xs outline-none transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          />
        }
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        <span className={link.subject ? "truncate font-mono text-[11px]" : undefined}>
          {text}
        </span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
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
