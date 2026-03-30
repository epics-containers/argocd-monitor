# OIDC Authentication via Keycloak

**Status: Planned Feature** — This document outlines a proposed enhancement. Currently, the app uses manual token-paste authentication. This OIDC flow is not yet implemented.

Replace the manual token-paste login with a standard OAuth2 Authorization Code
flow so users authenticate via the same SSO they use for ArgoCD.

## Prerequisites

- Access to the Keycloak admin console for the realm that ArgoCD uses
- The OIDC issuer URL and realm name (check ArgoCD's `argocd-cm` ConfigMap,
  key `oidc.config`)

## Keycloak setup

1. **Create a new public client** in the same realm ArgoCD uses:
   - Client ID: e.g. `argocd-monitor`
   - Client type: **OpenID Connect**
   - Client authentication: **Off** (public client — SPA has no secret)
2. **Set allowed redirect URIs** to where the app is deployed, e.g.:
   - `https://argocd-monitor.diamond.ac.uk/*`
   - `http://localhost:5173/*` (for dev)
3. **Set allowed web origins** to the same origins (for CORS on the token
   endpoint)
4. **Note the discovery URL** — typically
   `https://<keycloak-host>/realms/<realm>/.well-known/openid-configuration`

## Frontend changes

### Dependencies

Add `oidc-client-ts` (or similar lightweight OIDC library):

```bash
npm install oidc-client-ts
```

### Auth flow

1. Create an OIDC `UserManager` instance configured with:
   - `authority`: the Keycloak issuer URL
   - `client_id`: the client ID registered above
   - `redirect_uri`: your app's callback URL (e.g. `/callback`)
   - `scope`: `"openid profile email"` (or whatever ArgoCD requires)
   - `response_type`: `"code"` (Authorization Code flow with PKCE)
2. When the user clicks **Login**, call `userManager.signinRedirect()` — this
   redirects the browser to Keycloak
3. Add a `/callback` route that calls `userManager.signinCallback()` — this
   exchanges the authorization code for tokens
4. Store the resulting `id_token` (or `access_token`, depending on ArgoCD's
   config) the same way the current manual flow stores the auth token
5. Use the `refresh_token` from the OIDC response for silent renewal via
   `userManager.signinSilent()`

### ArgoCD token compatibility

ArgoCD validates OIDC tokens by checking the JWT signature against the
issuer's JWKS. The token your app obtains from Keycloak is the same kind
of token the CLI gets — ArgoCD doesn't care which client obtained it, only
that:

- The issuer matches the configured OIDC provider
- The JWT signature is valid
- The required claims/groups are present

Note: The token *scope* and *claims* may differ between clients (web SPA vs CLI).
Ensure the web client is configured to request the same scopes and groups that
ArgoCD expects (typically `groups` claim for RBAC). Check ArgoCD's
`argocd-rbac-cm` ConfigMap to see which claims grant access (usually group
membership via a `groups` scope/claim).

### What to remove

Once OIDC login works:

- Remove `TokenDialog` component and the manual token input
- Remove `AuthGate` logic that checks for a stored token on load (replace
  with OIDC session check)
- Simplify `auth-token.ts` — tokens come from the OIDC library instead of
  localStorage
- The `argocd.token` cookie can be set from the OIDC token for nginx proxy
  auth, or the `Authorization: Bearer <token>` header can be used instead

## Verifying ArgoCD accepts the token

Before writing any code, verify the approach with curl:

```bash
# 1. Get a token from Keycloak using the new client
#    (use the browser flow, or for testing, the direct-access grant if enabled)

# 2. Call ArgoCD API with the token
curl -sk -H "Authorization: Bearer <keycloak-token>" \
  https://argocd.diamond.ac.uk/api/v1/applications
```

If ArgoCD returns applications, the token is accepted and the plan works.
