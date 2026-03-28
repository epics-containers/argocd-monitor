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
    ArgoCD -->|OIDC| Keycloak
```

## Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **UI Components**: base-ui + custom components
- **Data Fetching**: TanStack React Query
- **Routing**: React Router
- **Production Server**: Nginx (reverse proxy + static files)

## Authentication

The app delegates authentication entirely to ArgoCD. When a user is not
authenticated, API calls return 401 and the app redirects to ArgoCD's
login page, which in turn uses Keycloak for OIDC authentication. The
resulting `argocd.token` cookie is used for all subsequent API requests.

## Deployment

The app is packaged as a Docker container running nginx. A Helm chart
is provided for Kubernetes deployment. The nginx config is injected via
a ConfigMap so the ArgoCD target URL can be configured per environment.
