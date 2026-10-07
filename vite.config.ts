import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': applying an update reloads the page, and reloading a
      // buyer mid-payment to swap a service worker is a bad trade. `UpdateToast` offers
      // it instead, and an ignored update still lands on the next cold start.
      registerType: 'prompt',
      // Our own worker (`src/sw.ts`), so it can receive push. The generated one cannot.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Dev-mode service worker, so PWA behaviour can be exercised without a build.
      devOptions: { enabled: false, type: 'module' },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Recommend',
        short_name: 'Recommend',
        description:
          'Buy from vendors near you, just by chatting — food, gadgets, anything.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf6e1',
        theme_color: '#faf6e1',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android crops non-maskable icons into a circle and clips the artwork.
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Only the shell is precached. The `/api` navigation rule and the storefront cache
        // live in `src/sw.ts` now.
        // mp3: the notification sound (public/sounds) — cached so it plays offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'],
      },
    }),
  ],
  server: {
    port: 5173,
    // The backend allowlists this origin explicitly — see recommend-be/src/config/cors.ts
    strictPort: true,
  },
});
