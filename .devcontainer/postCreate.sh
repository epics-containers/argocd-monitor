#!/bin/bash
set -euo pipefail

# Install Node.js 22
apt-get update -y
apt-get install -y --no-install-recommends curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y --no-install-recommends nodejs
rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash

# Install npm and Python dependencies
npm install
uv sync --all-extras
pre-commit install --install-hooks
