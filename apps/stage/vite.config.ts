import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: '../../packages/ui/public', // sw.js, shared by every app
  server: { port: 3003, strictPort: true },
  // Pre-bundle up front; discovering it mid-request reloads the server once and can mix two React copies in SSR.
  optimizeDeps: { include: ['better-auth/react'] },
  environments: { ssr: { optimizeDeps: { include: ['better-auth/react'] } } },
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' }, inspectorPort: false, persistState: { path: '../../.wrangler/state' } }), tanstackStart(), react()],
})
