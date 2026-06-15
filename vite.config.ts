import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-msal': ['@azure/msal-browser'],
          'seed-data': ['./src/data/seed', './src/data/pdpl'],
        },
      },
    },
  },
})
