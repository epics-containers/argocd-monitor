#!/bin/bash
set -euo pipefail

helm upgrade --install argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor \
    --version 0.5.2 \
    --namespace argocd-monitor \
    --set image.tag=0.5.2 \
    --set oauth2Proxy.enabled=true \
    --set oauth2Proxy.clientId=argocd-monitor \
    --set oauth2Proxy.issuerUrl=https://argocd.diamond.ac.uk/api/dex \
    --set oauth2Proxy.existingSecret=argocd-monitor-oauth2 \
    --set ingress.enabled=true \
    --set ingress.host=argocd-monitor.diamond.ac.uk \
    --set argocd.url=https://argocd.diamond.ac.uk \
    --set 'oauth2Proxy.extraArgs[0]=--scope=openid profile email audience:server:client_id:argocd' \
    --set 'oauth2Proxy.extraArgs[1]=--redirect-url=https://argocd-monitor.diamond.ac.uk/oauth2/callback' \
    --set 'oauth2Proxy.extraArgs[2]=--cookie-name=_oauth2_proxy_monitor' \
    --set 'oauth2Proxy.extraArgs[3]=--api-route=/api/' \
    --set 'oauth2Proxy.extraArgs[4]=--prompt=login'
