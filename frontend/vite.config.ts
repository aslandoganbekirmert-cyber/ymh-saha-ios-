
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { VitePWA } from 'vite-plugin-pwa' // PATH sorunu yüzünden devre dışı

export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  plugins: [
    react(),
    /* 
    VitePWA({ 
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'YMH Saha',
        short_name: 'YMH Saha',
        description: 'YMH Saha Yönetim Sistemi',
        theme_color: '#FFD600',
        background_color: '#ffffff',
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
    }) 
    */
  ]
})
