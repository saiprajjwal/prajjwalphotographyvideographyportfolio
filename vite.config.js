import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev only: serves the live site's /api so photos load on localhost.
  // Has no effect on production builds.
  server: { proxy: { "/api": { target: "https://www.prajjwalarchive.com", changeOrigin: true, secure: true } } },
})
