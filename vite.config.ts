import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_BASE_URL controls where assets are served from:
  //   Developer GitHub Pages: https://mmoutawe.github.io/pdplReviewer/
  //   Customer Power Pages (pac pages upload-code-site): leave empty → relative paths
  const base = env.VITE_BASE_URL ?? ''

  return {
    plugins: [react()],
    base,
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-msal': ['@azure/msal-browser'],
            'seed-data': ['./src/data/seed', './src/data/pdpl'],
          },
        },
      },
    },
  }
})
