import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow local hosts for development and the HF preview host used in CI
    allowedHosts: ['localhost', '127.0.0.1', '::1', 'vijaybala-hug-qsolive-demo.hf.space'],
    // Listen on all network interfaces so the dev server is reachable from the host
    host: true
  }
})