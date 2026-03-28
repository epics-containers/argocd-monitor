FROM mcr.microsoft.com/devcontainers/typescript-node:22

# Install uv and Python tools
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install Python 3.12 via uv so it's available for docs/pre-commit
RUN uv python install 3.12

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code
