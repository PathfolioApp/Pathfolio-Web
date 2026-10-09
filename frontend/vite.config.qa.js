import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// QA sandbox config: isolated port + proxies to the volatile API on :5050.
// Never used in normal development (that is vite.config.js).
export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true
      }
    }
  }
}));
