import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredToken, getStoredRefreshToken, saveTokens } from "@/lib/auth-token";

interface TokenDialogProps {
  open: boolean;
  onTokenSubmit: () => void;
}

export function TokenDialog({ open, onTokenSubmit }: TokenDialogProps) {
  const [authToken, setAuthToken] = useState(() => getStoredToken() ?? "");
  const [refreshToken, setRefreshToken] = useState(() => getStoredRefreshToken() ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const auth = authToken.trim();
    if (!auth) return;
    saveTokens(auth, refreshToken.trim() || undefined);
    onTokenSubmit();
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>ArgoCD Authentication</DialogTitle>
            <DialogDescription>
              Paste your ArgoCD tokens. You can get them by running:
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex flex-col gap-3">
            <pre className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
{`module load ec
argocd login argocd.diamond.ac.uk --grpc-web --sso
cat ~/.config/argocd/config`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Copy the <code className="rounded bg-muted px-1">auth-token</code> and{" "}
              <code className="rounded bg-muted px-1">refresh-token</code> values from the config file.
            </p>
            <Input
              type="password"
              placeholder="auth-token"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              autoFocus
            />
            <Input
              type="password"
              placeholder="refresh-token (optional)"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!authToken.trim()}>
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
