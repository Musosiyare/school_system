import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true lets the dev server accept connections from other devices on
  // the same network (e.g. testing on your phone), not just localhost.
  server: {
    host: true,
  },
})
