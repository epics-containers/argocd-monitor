import { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LogViewer } from "@/components/log-viewer/log-viewer";
import { LogControls } from "@/components/log-viewer/log-controls";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useResourceTree } from "@/hooks/use-application";
import { useLogs } from "@/hooks/use-logs";

export function LogsPage() {
  const { name, podName } = useParams<{ name: string; podName: string }>();
  const [searchParams] = useSearchParams();
  const namespace = searchParams.get("namespace") ?? "";
  const appNamespace = searchParams.get("appNamespace") ?? undefined;

  const { data: tree } = useResourceTree(name!, appNamespace);

  const containers = useMemo(() => {
    if (!tree) return [];
    const pod = tree.nodes.find(
      (n) => n.kind === "Pod" && n.name === podName,
    );
    const containerInfos =
      pod?.info?.filter((i) => i.name === "Containers") ?? [];
    if (containerInfos.length > 0) {
      return containerInfos[0].value.split(",").map((c) => c.trim());
    }
    return [];
  }, [tree, podName]);

  const [container, setContainer] = useState("");
  const [previous, setPrevious] = useState(false);
  const [follow, setFollow] = useState(true);
  const [sinceSeconds, setSinceSeconds] = useState(0);
  const [tailLines, setTailLines] = useState(1000);

  const logParams = useMemo(
    () => ({
      podName: podName!,
      namespace,
      container: container || undefined,
      sinceSeconds: sinceSeconds || undefined,
      tailLines: tailLines || undefined,
      follow,
      previous,
    }),
    [podName, namespace, container, sinceSeconds, tailLines, follow, previous],
  );

  const { lines, isStreaming, error, stop, restart } = useLogs({
    appName: name!,
    params: logParams,
    enabled: !!podName && !!namespace,
    appNamespace,
  });

  if (!podName || !namespace) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to={`/apps/${encodeURIComponent(name!)}${appNamespace ? `?appNamespace=${encodeURIComponent(appNamespace)}` : ""}`}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h2 className="text-lg font-semibold">{podName}</h2>
      </div>

      <LogControls
        containers={containers}
        selectedContainer={container}
        onContainerChange={setContainer}
        previous={previous}
        onPreviousChange={setPrevious}
        follow={follow}
        onFollowChange={setFollow}
        sinceSeconds={sinceSeconds}
        onSinceSecondsChange={setSinceSeconds}
        tailLines={tailLines}
        onTailLinesChange={setTailLines}
        isStreaming={isStreaming}
        onStop={stop}
        onRestart={() => void restart()}
      />

      {error && (
        <p className="text-sm text-destructive">Error: {error.message}</p>
      )}

      <LogViewer lines={lines} follow={follow} />
    </div>
  );
}
