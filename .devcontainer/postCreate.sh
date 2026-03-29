#!/bin/bash
set -euo pipefail

# Wipe any credential helpers (including VS Code's auto-injected OAuth helper).
# An empty-string value resets the helper list so only an explicit PAT via
# `gh auth login` + `gh auth setup-git` can authenticate to remotes.
git config --global credential.helper ''

# Install Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash

# Install just task runner
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Install GitHub CLI
(type -p wget >/dev/null || (apt-get update -y && apt-get install -y --no-install-recommends wget)) \
  && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Install Node.js 22
apt-get update -y
apt-get install -y --no-install-recommends curl gh
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y --no-install-recommends nodejs
rm -rf /var/lib/apt/lists/*


# Install npm and Python dependencies
npm install
uv sync --all-extras
pre-commit install --install-hooks
