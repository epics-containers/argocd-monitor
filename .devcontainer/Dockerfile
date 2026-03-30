FROM ghcr.io/diamondlightsource/ubuntu-devcontainer:noble

# generic setup ################################################################

# Setup GitHub CLI repository and keyring
RUN (type -p wget >/dev/null || (apt-get update -y && apt-get install -y --no-install-recommends wget)) \
  && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Install just task runner, gh CLI and curl
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends just gh curl

# language specific setup ######################################################

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*
