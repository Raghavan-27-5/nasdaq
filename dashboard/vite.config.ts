import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Relative base keeps local dev and any sub-path hosting working. Set
// BASE_PATH=/nasdaq/ for GitHub Pages, where the site is served from a
// sub-directory rather than the domain root.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2021',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
