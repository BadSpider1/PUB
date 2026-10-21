import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PNG/ICO icons in /public from public/logo.svg.
// Run `npm run generate-pwa-assets` after changing the logo; the output is committed.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#6250d6' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#6250d6' } },
  },
  images: ['public/logo.svg'],
})
