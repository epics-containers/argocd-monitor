# Configure ArgoCD Connection

## Development

In development, the Vite dev server proxies API requests to ArgoCD.
You need an auth token from the ArgoCD instance.

1. Log in to your ArgoCD instance in the browser.
2. Open DevTools > Application > Cookies.
3. Copy the `argocd.token` cookie value.
4. Set it in your `.env` file:

   ```bash
   ARGOCD_AUTH_TOKEN=<your-token>
   ```

5. Restart the dev server.

## Production

In production, the nginx config proxies to ArgoCD. The target URL is
configured via the Helm chart's `argocd.url` value:

```yaml
argocd:
  url: https://argocd.diamond.ac.uk
```

Authentication flows through ArgoCD's OIDC/Keycloak integration
automatically via cookie-based sessions.
