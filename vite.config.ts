import { fileURLToPath, URL } from 'node:url';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  root: sourceRoot,
  base: './',
  plugins: [preact()],
  resolve: {
    alias: {
      '@/app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) =>
          assetInfo.names.some((name) => name.endsWith('.css'))
            ? 'style.css'
            : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
