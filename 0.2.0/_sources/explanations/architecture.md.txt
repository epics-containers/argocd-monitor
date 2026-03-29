# Architecture

## Overview

ArgoCD IOC Monitor is a React single-page application that provides a
dashboard for monitoring ArgoCD-managed IOC (Input/Output Controller)
applications.

```{mermaid}
graph LR
    Browser --> Nginx
    Nginx -->|/api/| ArgoCD
    Nginx -->|/auth/| ArgoCD
    Nginx -->|/*| SPA[React SPA]
    ArgoCD -.->|OIDC planned| Keycloak
```

## Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **UI Components**: base-ui + custom components
- **Data Fetching**: TanStack React Query
- **Routing**: React Router
- **Production Server**: Nginx (reverse proxy + static files)

## Authentication

Currently the app uses manually-pasted ArgoCD tokens. Users run
`argocd login --sso` to authenticate via Keycloak, then copy the
`auth-token` and `refresh-token` from `~/.config/argocd/config` into
the app's login dialog. Tokens are stored in localStorage and synced
to cookies for API requests.

**Planned:** Direct OIDC authentication via Keycloak so users log in
through the browser without manual token handling. See
{doc}`oidc-auth-plan` for details.

## Deployment

The app is packaged as a Docker container running nginx. A Helm chart
is provided for Kubernetes deployment. The nginx config is injected via
a ConfigMap so the ArgoCD target URL can be configured per environment.
