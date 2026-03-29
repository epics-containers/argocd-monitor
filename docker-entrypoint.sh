#!/bin/sh
set -e

# When deployed via Helm, the ConfigMap is mounted read-only over
# /etc/nginx/conf.d/default.conf — envsubst is not needed.
# Only run envsubst for standalone Docker where we need to template
# the ArgoCD URL into the config.
if touch /etc/nginx/conf.d/.writetest 2>/dev/null; then
    rm -f /etc/nginx/conf.d/.writetest

    ARGOCD_URL="${ARGOCD_URL:-https://argocd.diamond.ac.uk}"
    ARGOCD_HOST="${ARGOCD_URL#https://}"
    ARGOCD_HOST="${ARGOCD_HOST#http://}"
    export ARGOCD_URL ARGOCD_HOST

    envsubst '${ARGOCD_URL} ${ARGOCD_HOST}' \
      < /etc/nginx/templates/default.conf.template \
      > /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
