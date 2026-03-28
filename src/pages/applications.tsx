import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app-table/data-table";
import { columns } from "@/components/app-table/columns";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useApplications } from "@/hooks/use-applications";

export function ApplicationsPage() {
  const project = import.meta.env.VITE_ARGOCD_PROJECT || undefined;
  const { data: applications, isLoading, error, dataUpdatedAt } = useApplications(project);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    sessionStorage.setItem("tableFilters", searchParams.toString());
  }, [searchParams]);

  if (isLoading) {
    return <LoadingSpinner message="Loading applications..." />;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">
          Failed to load applications: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["applications"] })
            }
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={applications ?? []} />
    </div>
  );
}
