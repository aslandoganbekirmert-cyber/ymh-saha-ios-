import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://34.76.183.133:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  plugins: [
    react(),
    /* 
    PWA Eklentisi klasör dizinindeki (') karakterinden dolayı build hatası veriyor.
    Build sırasında geçici olarak devre dışı bırakıyorum ki .ipa derlemesini yapabilelim.
    */
    /* VitePWA({ 
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'YMH Saha',
        short_name: 'YMH Saha',
        description: 'YMH Saha Operasyon Yönetimi',
        theme_color: '#FFD600',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }) */
  ]
})
