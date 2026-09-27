import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ollamaTarget = env.OLLAMA_URL || 'http://localhost:11434';
  const nextcloudTarget = env.NEXTCLOUD_URL || 'http://localhost:8080';
  const backendPort = env.SERVER_PORT || env.BACKEND_PORT || (env.PORT && env.PORT !== '4191' ? env.PORT : '3001');
  const serverTarget = `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 4191,
      cors: true,
      proxy: {
        '/api/bootstrap': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/health': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/files': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/arxiv': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/jira': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/google': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/calendar': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/auth': {
          target: serverTarget,
          changeOrigin: true,
        },
        '/api/ollama': {
          target: ollamaTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/ollama/, '/api/generate'),
        },
        '/api/nextcloud': {
          target: nextcloudTarget,
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
  };
})

