import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true lets the dev server accept connections from other devices on
  // the same network (e.g. testing on your phone), not just localhost.
  // open: true launches the app in your default browser automatically the
  // moment `npm run dev` finishes starting up.
  server: {
    host: true,
    open: true,
  },
  preview: {
    open: true,
  },
})
