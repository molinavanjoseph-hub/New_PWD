import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const normalizeChunkPath = (id = '') => String(id).replaceAll('\\', '/')

const resolveManualChunk = (id) => {
  const normalizedId = normalizeChunkPath(id)

  if (normalizedId.includes('/src/lib/auth.js')
    || normalizedId.includes('/src/lib/security-auth.js')
    || normalizedId.includes('/src/lib/security.js')
    || normalizedId.includes('/src/firebase.js')) {
    return 'app-security'
  }

  if (normalizedId.includes('/src/authenticator/Face_Recognition/')) {
    return 'face-verification'
  }

  if (!normalizedId.includes('/node_modules/')) return undefined

  if (
    normalizedId.includes('/@tensorflow/')
    || normalizedId.includes('/@tensorflow-models/')
    || normalizedId.includes('/tesseract.js/')
  ) {
    return 'vendor-ml'
  }

  if (normalizedId.includes('/firebase/')) {
    return 'vendor-firebase'
  }

  if (
    normalizedId.includes('/vue/')
    || normalizedId.includes('/@vue/')
    || normalizedId.includes('/vue-router/')
    || normalizedId.includes('/pinia/')
  ) {
    return 'vendor-vue'
  }

  if (
    normalizedId.includes('/bootstrap-icons/')
    || normalizedId.includes('/flag-icons/')
    || normalizedId.includes('/@fortawesome/')
    || normalizedId.includes('/@fontsource/')
  ) {
    return 'vendor-ui'
  }

  return 'vendor-misc'
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    vue(),
    ...(command === 'serve' ? [vueDevTools()] : []),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['nonstimulating-trimeric-evangeline.ngrok-free.dev'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
}))
