import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    lib: {
      entry: resolve(__dirname, 'src/content/injected-interceptor.ts'),
      name: 'NetworkInterceptor',
      formats: ['iife'],
      fileName: () => 'src/content/injected-interceptor.js',
    },
  },
});
