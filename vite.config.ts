import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Setting VITE_API_PROXY (e.g. https://mine.lomokwa.com) makes the dev
  // server forward /api — including the console WebSocket — to that host.
  // The browser then only ever talks to localhost, so developing against a
  // remote server no longer trips over CORS. Leave it unset to call the API
  // directly via VITE_API_BASE (the server must then allow this origin).
  const env = loadEnv(mode, process.cwd())
  const proxyTarget = env.VITE_API_PROXY

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      allowedHosts: ['calm-octopus-heavily.ngrok-free.app'],
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              ws: true,
              // Present every proxied request to the upstream as same-origin so
              // the server's CORS and WebSocket origin checks accept the dev
              // proxy (otherwise the live console socket gets rejected).
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('origin', proxyTarget))
                proxy.on('proxyReqWs', (proxyReq) => proxyReq.setHeader('origin', proxyTarget))
              },
            },
          }
        : undefined,
    },
  }
})
