import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Build straight into the API's wwwroot, which is what actually gets published.
  // This replaces the old manual "copy dist/ -> wwwroot" step. emptyOutDir wipes the
  // folder first, so stale hashed bundles from previous builds can't pile up (they
  // had accumulated into the hundreds).
  build: {
    outDir: '../api-dotnet/wwwroot',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5178',
      '/swagger': 'http://localhost:5178'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}']
  }
})
