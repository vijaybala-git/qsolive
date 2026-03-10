import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inject env and git branch at build time (Vercel sets VERCEL_GIT_COMMIT_REF)
const appEnv = process.env.VITE_APP_ENV || (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')
const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || ''

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_ENV__: JSON.stringify(appEnv),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
  },
  server: {
    // Allow local hosts for development and the HF preview host used in CI
    allowedHosts: ['localhost', '127.0.0.1', '::1', 'vijaybala-hug-qsolive-demo.hf.space'],
    // Listen on all network interfaces so the dev server is reachable from the host
    host: true
  }
})