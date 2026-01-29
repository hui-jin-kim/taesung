import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

const cacheDir = path.join(os.tmpdir(), "vite-cache-rj-realestate");

function httpsOption() {
  try {
    const certPath = path.join(process.cwd(), "cert", "localhost.pem");
    const keyPath = path.join(process.cwd(), "cert", "localhost-key.pem");
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      };
    }
  } catch {}
  return undefined;
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const enablePwa = env.VITE_ENABLE_PWA === "true";

  let pwaPlugin: any = null;
  if (enablePwa) {
    try {
      // Use non-literal to avoid TS module resolution when disabled
      const pwaPkg: string = 'vite-plugin-pwa';
      const mod: any = await import(pwaPkg).catch(() => null);
      const VitePWA = mod?.VitePWA;
      if (VitePWA) {
        pwaPlugin = VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          manifest: {
            name: 'RJ Real Estate',
            short_name: 'RJ',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#111827',
            icons: [
              { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' },
              { src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml' }
            ]
          },
          workbox: {
            runtimeCaching: [
              {
                urlPattern: ({ url }: any) => url.pathname.startsWith('/api/viewer'),
                handler: 'NetworkFirst',
                options: { cacheName: 'api-viewer', networkTimeoutSeconds: 3 }
              }
            ]
          },
          srcDir: 'src',
          filename: 'sw.ts',
        });
      } else {
        console.warn('vite-plugin-pwa is not installed; skipping PWA.');
      }
    } catch {
      // remain silent if plugin not available
    }
  }

  return {
    plugins: [react(), ...(pwaPlugin ? [pwaPlugin] : [])],
    cacheDir,
    resolve: {
      alias: {
        recharts: 'recharts/es6',
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      https: httpsOption(),
      // Proxy API calls during local dev to Firebase Hosting (which rewrites to Cloud Functions)
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'https://rj-realestate-1dae8.web.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: { outDir: 'dist', sourcemap: false, emptyOutDir: false },
  };
});
