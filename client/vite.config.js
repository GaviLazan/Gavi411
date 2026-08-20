import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-only: forward /api/* to the Express server so the frontend
    // can use plain relative fetches (e.g. fetch('/api/requests/match'))
    // without hardcoding a host. Not needed in production if front/back
    // end up same-origin; CORS (already set up in server.js) still
    // covers any deploy shape where they aren't.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
