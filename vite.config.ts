import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/msi/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // sql.js ships CommonJS. Prebundling gives the dev server a default export.
  // Excluding it serves sql-wasm-browser.js as native ESM and the app fails to load.
  optimizeDeps: {
    include: ['sql.js'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
