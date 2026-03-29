# Configure ArgoCD Connection

## Development

In development, the Vite dev server proxies API requests to ArgoCD.
You need an auth token from the ArgoCD instance.

1. Log in via the ArgoCD CLI:

   ```bash
   argocd login argocd.diamond.ac.uk --grpc-web --sso
   ```

2. Copy the `auth-token` from `~/.config/argocd/config`.
3. Set it in your `.env` file:

   ```bash
   ARGOCD_AUTH_TOKEN=<your-token>
   ```

4. Restart the dev server.

If your ArgoCD instance is at a different hostname, also set
`VITE_ARGOCD_HOST` in `.env` — this updates the login instructions
shown in the app's token dialog.

## Production

In production, the nginx config proxies to ArgoCD. The target URL is
configured via the Helm chart's `argocd.url` value:

```yaml
argocd:
  url: https://argocd.diamond.ac.uk
```

Users currently authenticate by pasting tokens into the app's login
dialog. OIDC authentication via Keycloak is planned — see
{doc}`/explanations/oidc-auth-plan`.
