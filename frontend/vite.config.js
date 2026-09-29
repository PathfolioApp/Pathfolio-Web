import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

  // The API being unreachable is a normal dev state (still starting, crashed,
  // or simply not running). Log it as a short, friendly notice — once per
  // outage window — instead of dumping an AggregateError stack per request.
  let apiDown = false;
  let lastNoticeAt = 0;
  const NOTICE_INTERVAL_MS = 30_000; // re-remind every 30s while down

  const friendlyError = error => {
    const code = error?.code || '';
    if (code === 'ECONNREFUSED') return 'nothing is listening on that port yet';
    if (code === 'ETIMEDOUT') return 'connection timed out';
    if (code === 'ECONNRESET') return 'connection was reset';
    return error?.message || 'unknown proxy error';
  };

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
            proxy.on('error', (error, req) => {
              if (!apiDown) {
                apiDown = true;
                lastNoticeAt = Date.now();
                const route = req?.url ? ` (${req.url})` : '';
                console.warn(
                  `\n[vite] API not reachable at ${apiTarget}${route} — ${friendlyError(error)}.\n` +
                  `[vite] Requests to /api/* will fail until the backend starts.\n` +
                  `[vite] Start it with: npm run dev:api   (this notice repeats every 30s while down)\n`
                );
                return;
              }
              if (Date.now() - lastNoticeAt > NOTICE_INTERVAL_MS) {
                lastNoticeAt = Date.now();
                console.warn(`[vite] API still not reachable at ${apiTarget} — ${friendlyError(error)}`);
              }
              // Remaining errors in the window are silenced: one is enough.
            });

            proxy.on('proxyRes', () => {
              if (apiDown) {
                apiDown = false;
                console.log(`[vite] API back online at ${apiTarget}`);
              }
            });
          }
        }
      }
    }
  };
});
