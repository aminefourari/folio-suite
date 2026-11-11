import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 3000, strictPort: true },
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' }, inspectorPort: false }), tanstackStart(), react()],
})
