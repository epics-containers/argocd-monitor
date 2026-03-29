# Run all checks before committing (lint, test, docs in parallel)
check:
    #!/bin/bash
    set -euo pipefail
    just lint & pid_lint=$!
    just test & pid_test=$!
    just docs & pid_docs=$!
    fail=0
    wait $pid_lint  || fail=1
    wait $pid_test  || fail=1
    wait $pid_docs  || fail=1
    exit $fail

# ESLint + TypeScript type check
lint:
    npm run lint
    npx tsc --noEmit

# Run vitest with coverage
test:
    npm run test:coverage

# Run vitest in watch mode
test-watch:
    npm run test:watch

# Build Sphinx documentation
docs:
    uv run sphinx-build --fresh-env --show-traceback --fail-on-warning --keep-going docs build/html

# Auto-rebuild docs on change
docs-watch:
    uv run sphinx-autobuild --show-traceback --watch README.md docs build/html

# Run Playwright E2E smoke tests (requires dev server or starts one)
e2e:
    npx playwright install --with-deps chromium
    npm run test:e2e

# Run pre-commit hooks on all files
pre-commit:
    uv run pre-commit run --all-files --show-diff-on-failure

# Start Vite dev server
dev:
    npm run dev

# Production build
build:
    npm run build
