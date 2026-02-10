
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://34.176.225.161:3000',
        changeOrigin: true
        // Rewrite: default no-rewrite (/api/v1 -> /api/v1)
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      manifest: {
        name: 'YMH Operasyon',
        short_name: 'YMH',
        description: 'YMH Saha Operasyon Yönetimi',
        theme_color: '#FFD600',
        background_color: '#18181B',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png', // Geçici olarak logo.png (48x48 yetersiz ama idare eder)
            sizes: '192x192', // Tarayıcı resize eder veya pikselleşir
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
