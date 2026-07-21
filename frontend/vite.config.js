import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Target moderno — mejor tree-shaking y código más limpio
    target: 'es2020',

    // Chunk splitting manual para evitar que todo vaya en un bundle inicial gigante
    // Cada clave crea un chunk separado que se carga bajo demanda
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@coreui')) {
              return 'vendor-coreui';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('sweetalert2')) {
              return 'vendor-alerts';
            }
            return 'vendor-others';
          }
        },
      },
    },
  },

  // Optimización de dependencias en dev para arranque más rápido
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@coreui/react'],
  },
})
