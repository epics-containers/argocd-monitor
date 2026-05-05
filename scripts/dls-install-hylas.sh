#!/bin/bash
set -euo pipefail

helm upgrade --install hylas-argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor \
    --version 0.5.3-beta.1 \
    --namespace argocd-monitor \
    --set ingress.enabled=true \
    --set ingress.host=hylas-argocd-monitor.diamond.ac.uk \
    --set argocd.url=https://argocd-controls.diamond.ac.uk \
    --set argocd.anonymous.enabled=true
