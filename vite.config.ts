import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4191,
    cors: true,
    proxy: {
      '/api/bootstrap': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/files': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '/api/generate'),
      },
      '/api/nextcloud': {
        target: 'http://100.100.133.10:30027',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/nextcloud/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Prevent browser-native auth dialogs that loop when credentials are entered in-app.
            delete proxyRes.headers['www-authenticate'];
          });
        },
      },
    }
  },
  build: {
    chunkSizeWarningLimit: 5000,
  }
})
