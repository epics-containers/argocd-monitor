import { useNavigate } from "react-router";
import { Moon, Sun, Activity, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { clearStoredToken } from "@/lib/auth-token";

export function Header() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function handleLogout() {
    clearStoredToken();
    void queryClient.invalidateQueries({ queryKey: ["auth"] });
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <button
          type="button"
          onClick={() => {
            const filters = sessionStorage.getItem("tableFilters");
            void navigate(filters ? `/?${filters}` : "/");
          }}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">
            ArgoCD Monitor{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {(import.meta.env.VITE_APP_VERSION as string) || "dev"}
            </span>
          </h1>
        </button>
        <div className="flex items-center gap-3">
          {user?.username && (
            <span className="text-sm text-muted-foreground">
              {user.username}
            </span>
          )}
          {user?.username && (
            <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
