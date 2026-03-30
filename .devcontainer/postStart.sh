#!/bin/bash
set -euo pipefail

# Wipe any credential helpers (including VS Code's auto-injected OAuth helper).
# An empty-string value resets the helper list so only an explicit PAT via
# `gh auth login` + `gh auth setup-git` can authenticate to remotes.
git config --global credential.helper ''
