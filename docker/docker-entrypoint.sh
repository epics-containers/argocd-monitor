#!/bin/sh
set -e

ARGOCD_URL="${ARGOCD_URL:-https://argocd.diamond.ac.uk}"
ARGOCD_HOST="${ARGOCD_URL#https://}"
ARGOCD_HOST="${ARGOCD_HOST#http://}"
export ARGOCD_URL ARGOCD_HOST

# Render config from template. If the config is mounted read-only
# (Helm ConfigMap), this fails silently and the mounted config is used.
envsubst '${ARGOCD_URL} ${ARGOCD_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf 2>/dev/null || true

exec nginx -g 'daemon off;'
