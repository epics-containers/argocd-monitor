import { Link } from "react-router";
import { Moon, Sun, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          to={`/${sessionStorage.getItem("tableFilters") ? `?${sessionStorage.getItem("tableFilters")}` : ""}`}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">IOC Monitor</h1>
        </Link>
        <div className="flex items-center gap-3">
          {user?.username && (
            <span className="text-sm text-muted-foreground">
              {user.username}
            </span>
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
