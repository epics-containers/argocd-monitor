import fs from 'node:fs'
import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return NaN
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function cidrContains(cidr: string, ip: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number.parseInt(bitsStr ?? '', 10)
  if (!base || Number.isNaN(bits) || bits < 0 || bits > 32) return false
  const baseInt = ipToInt(base)
  const ipInt = ipToInt(ip)
  if (Number.isNaN(baseInt) || Number.isNaN(ipInt)) return false
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0)
  return (baseInt & mask) === (ipInt & mask)
}

// Parse the flow-style entries in scripts/beamline-namespaces.yaml.
// Avoids pulling in a YAML dep for a dev-only file with a fixed shape.
function loadBeamlineRanges(): { cidr: string; namespace: string }[] {
  const file = path.resolve(__dirname, 'scripts/beamline-namespaces.yaml')
  if (!fs.existsSync(file)) return []
  const ranges: { cidr: string; namespace: string }[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*-\s*\{\s*cidr:\s*([\d./]+)\s*,\s*namespace:\s*([\w-]+)\s*\}/)
    if (m) ranges.push({ cidr: m[1], namespace: m[2] })
  }
  return ranges
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const argocdToken = env.ARGOCD_AUTH_TOKEN

  function createProxyConfig() {
    return {
      target: 'https://argocd.diamond.ac.uk',
      changeOrigin: true,
      secure: false,
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any, req: any) => {
          proxyReq.setHeader('Host', 'argocd.diamond.ac.uk');
          // Forward browser cookies, with env token as fallback
          const browserCookies = req.headers.cookie || '';
          const cookieHeader = argocdToken && !browserCookies.includes('argocd.token=')
            ? `argocd.token=${argocdToken};${browserCookies}`
            : browserCookies;
          if (cookieHeader) {
            proxyReq.setHeader('Cookie', cookieHeader);
          }
        });
        proxy.on('error', (err: any) => {
          console.error('[proxy error]', err.message);
        });
      },
    }
  }

  // When DEV_CLIENT_IP is set, inject it as X-Forwarded-For on the local API
  // paths that resolve a client IP. Scoped to those paths so the fake IP never
  // leaks upstream to the ArgoCD proxy. Mirrors production where nginx's
  // real_ip module recovers the client IP from XFF set by the trusted proxy.
  const spoofedIp = env.DEV_CLIENT_IP
  const devSpoofIpPlugin = {
    name: 'dev-spoof-ip',
    configureServer(server: any) {
      if (!spoofedIp) return
      const spoofedPaths = ['/api/client-ip', '/api/beamline']
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (spoofedPaths.some((p) => req.url?.startsWith(p))) {
          req.headers['x-forwarded-for'] = spoofedIp
        }
        next()
      })
    },
  }

  // When DEV_CLIENT_IP is set, resolve /api/beamline by CIDR-matching the
  // spoofed IP against scripts/beamline-namespaces.yaml — the same values
  // fragment the chart consumes. Falls through to the VITE_DEV_BEAMLINE-based
  // plugin below when no spoof IP is configured, preserving its behaviour.
  const devCidrBeamlinePlugin = {
    name: 'dev-cidr-beamline',
    configureServer(server: any) {
      if (!spoofedIp) return
      const ranges = loadBeamlineRanges()
      server.middlewares.use('/api/beamline', (req: any, res: any) => {
        const ip = (req.headers['x-forwarded-for'] as string | undefined) ?? ''
        const match = ranges.find((r) => cidrContains(r.cidr, ip))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ namespace: match?.namespace ?? '' }))
      })
    },
  }

  // Dev-only middleware that mimics the nginx /api/client-ip endpoint so the
  // header IP display works under `vite dev` (otherwise the request gets
  // proxied to ArgoCD, which 404s).
  const devClientIpPlugin = {
    name: 'dev-client-ip',
    configureServer(server: any) {
      server.middlewares.use('/api/client-ip', (req: any, res: any) => {
        const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
        const ip = (req.socket?.remoteAddress as string | undefined) ?? '';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ip, forwardedFor }));
      });
    },
  }

  // Dev-only middleware mirroring the nginx /api/beamline endpoint. The dev
  // server has no real IP→namespace mapping, so the namespace is sourced from
  // VITE_DEV_BEAMLINE (empty by default = no auto-filter).
  const devBeamlinePlugin = {
    name: 'dev-beamline',
    configureServer(server: any) {
      server.middlewares.use('/api/beamline', (_req: any, res: any) => {
        const namespace = env.VITE_DEV_BEAMLINE ?? '';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ namespace }));
      });
    },
  }

  return {
    plugins: [react(), tailwindcss(), devSpoofIpPlugin, devClientIpPlugin, devCidrBeamlinePlugin, devBeamlinePlugin],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        '/api': createProxyConfig(),
        '/auth': createProxyConfig(),
      },
    },
  }
})
