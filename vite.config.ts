import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy all /api routes to the Express backend
      '/api/proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/markets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/bulk': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Direct proxies to Polymarket APIs (fallback, less recommended)
      '/api/gamma': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gamma/, ''),
      },
      '/api/clob': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/clob/, ''),
      },
      '/api/data': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data/, ''),
      },
    },
  },
  esbuild: {
    target: 'ES2021',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
