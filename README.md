# ArgoCD IOC Monitor

A React + TypeScript + Vite dashboard for monitoring ArgoCD application state.

<!-- README only content -->

## Getting Started with Dev Containers

The easiest way to run this project is using a [Dev Container](https://containers.dev/), which provides a fully configured development environment.

### Prerequisites

- [Docker](https://www.docker.com/get-started/) installed and running
- One of:
  - [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
  - [GitHub Codespaces](https://github.com/features/codespaces)
  - Any [supporting tool](https://containers.dev/supporting) (JetBrains, DevPod, etc.)

### Launch in VS Code

1. Clone the repository and open it in VS Code:
   ```sh
   git clone <repo-url> && code argocd-ioc-monitor
   ```
2. VS Code will detect the Dev Container configuration and prompt **"Reopen in Container"** — click it.
   Alternatively, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Dev Containers: Reopen in Container**.
3. Wait for the container to build and `npm install` to finish (runs automatically via `postCreateCommand`).
4. Copy `.env.example` to `.env` and fill in the required values:
   ```sh
   cp .env.example .env
   ```
   At minimum, set `ARGOCD_AUTH_TOKEN` (see `.env.example` for instructions).
5. Start the dev server:
   ```sh
   npm run dev
   ```
6. The app is available at **http://localhost:5173** (port forwarded automatically).

### Launch in GitHub Codespaces

1. From the repository on GitHub, click **Code → Codespaces → Create codespace on main**.
2. Once the environment is ready, copy `.env.example` to `.env`, fill in values, and run `npm run dev`.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
