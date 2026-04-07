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

  if (normalizedId.includes('/tesseract.js/')) {
    return 'vendor-ocr'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-core/')) {
    return 'vendor-tfjs-core'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-converter/')) {
    return 'vendor-tfjs-converter'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-layers/')) {
    return 'vendor-tfjs-layers'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-data/')) {
    return 'vendor-tfjs-data'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-backend-cpu/')) {
    return 'vendor-tfjs-cpu'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-backend-webgl/')) {
    return 'vendor-tfjs-webgl'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-backend-wasm/')) {
    return 'vendor-tfjs-wasm'
  }

  if (normalizedId.includes('/@tensorflow/tfjs-backend-webgpu/')) {
    return 'vendor-tfjs-webgpu'
  }

  if (normalizedId.includes('/@mediapipe/')) {
    return 'vendor-mediapipe'
  }

  if (normalizedId.includes('/@tensorflow-models/')) {
    return 'vendor-face-models'
  }

  if (
    normalizedId.includes('/@tensorflow/')
  ) {
    return 'vendor-tfjs'
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
    allowedHosts: ['brachydactylous-eliz-destructive.ngrok-free.dev'],
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
