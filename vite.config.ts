import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.VITE_BACKEND_HTTP || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@services': '/src/services',
      '@utils': '/src/utils'
    }
  },
  server: {
      proxy: {
      // Proxy API requests to the backend to avoid CORS in development
      '/api': {
        target: backend,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
