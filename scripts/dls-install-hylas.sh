#!/bin/bash
set -euo pipefail

helm upgrade --install argocd-monitor oci://ghcr.io/epics-containers/charts/argocd-monitor \
    --version 0.5.2 \
    --namespace argocd-monitor \
    --set image.tag=0.5.2 \
    --set ingress.enabled=true \
    --set ingress.host=hylas-argocd-monitor.diamond.ac.uk \
    --set argocd.url=https://argocd-controls.diamond.ac.uk \
    --set argocd.anonymous.enabled=true
