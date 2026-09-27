import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
    port: Number(env.VITE_PORT || 5173),
    open: false,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', error => {
            console.error(`[PathfolioApp] API proxy could not reach ${apiTarget}: ${error.message}`);
          });
        }
      }
    }
    }
  };
});
