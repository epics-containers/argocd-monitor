import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const argocdToken = env.ARGOCD_AUTH_TOKEN

  const proxyConfig = {
    target: 'https://argocd.diamond.ac.uk',
    changeOrigin: true,
    secure: true,
    ...(argocdToken && {
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          proxyReq.setHeader('Cookie', `argocd.token=${argocdToken}`);
        });
      },
    }),
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/api': proxyConfig,
        '/auth': proxyConfig,
      },
    },
  }
})
