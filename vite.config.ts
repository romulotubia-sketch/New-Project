import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const DEV_SW_INLINE_SCRIPT = `<script id="vite-plugin-pwa:register-dev-sw" type="module">
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/' }).catch(() => {});
}
</script>`;

function pwaDisableHmrPreGuard(): Plugin {
  const virtualId = '\0pwa-disable-hmr-noop';
  return {
    name: 'pwa-disable-hmr-pre-guard',
    enforce: 'pre',
    apply: 'serve',
    resolveId(id) {
      if (
        process.env.DISABLE_HMR === 'true' &&
        (id === '/@vite-plugin-pwa/pwa-entry-point-loaded' ||
          id === '@vite-plugin-pwa/pwa-entry-point-loaded')
      ) {
        return virtualId;
      }
      return undefined;
    },
    load(id) {
      if (id === virtualId) {
        return `export default function registerDevSW() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/' }).catch(() => {});
  }
}`;
      }
      return undefined;
    },
  };
}

function pwaDisableHmrHtmlGuard(): Plugin {
  return {
    name: 'pwa-disable-hmr-html-guard',
    enforce: 'post',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (process.env.DISABLE_HMR !== 'true') return html;
        return html.replace(
          /<script id="vite-plugin-pwa:register-dev-sw"[\s\S]*?<\/script>/,
          DEV_SW_INLINE_SCRIPT,
        );
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      pwaDisableHmrPreGuard(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        useCredentials: true,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: "Soul Rogue: Knight's Ascendancy",
          short_name: 'Soul Rogue',
          description:
            'Pixel art roguelike dungeon crawler inspired by Soul Knight with multi-skill heroes, procedural rooms, and talent skill tree progression.',
          theme_color: '#090a10',
          background_color: '#090a10',
          display: 'standalone',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'landscape',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/Soul-Rogue.html', '**/assets/aistudio/**'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          suppressWarnings: true,
        },
      }),
      pwaDisableHmrHtmlGuard(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
