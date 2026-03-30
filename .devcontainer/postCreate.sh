#!/bin/bash
set -euo pipefail

# Install Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash

# Install npm and Python dependencies
npm install
uv sync --all-extras
pre-commit install --install-hooks
