/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Set VITE_BASE_PATH when hosting under a sub-path (e.g. GitHub Pages: "/my-repo/").
  const base = env.VITE_BASE_PATH || '/'
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(version) },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // The app shows its own "update available" prompt (see PwaUpdatePrompt.tsx).
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: base,
          name: 'Personal Finance Vault',
          short_name: 'Finance Vault',
          description:
            'Offline-first personal finance tracker. Your data lives on your device and in a vault file you control.',
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          theme_color: '#0d0d0d',
          background_color: '#0d0d0d',
          categories: ['finance', 'productivity'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            {
              name: 'Add transaction',
              short_name: 'Add',
              url: `${base}#/?new=1`,
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks: app updates don't invalidate them in the SW cache,
          // and the chart library only loads with the dashboard.
          codeSplitting: {
            // Higher priority claims modules first. Shared helpers (clsx, react-is…) must land in
            // `react`/`vendor`, otherwise `charts` would pull them in and become a static
            // dependency of the entry chunk.
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 30 },
              {
                name: 'vendor',
                test: /node_modules[\\/](?!(recharts|victory-vendor|d3-[^\\/]+|internmap|@reduxjs|react-redux|redux|redux-thunk|immer|reselect|es-toolkit|decimal\.js-light|eventemitter3|tiny-invariant)[\\/])/,
                priority: 20,
              },
              { name: 'charts', test: /node_modules[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts'],
    },
  }
})
