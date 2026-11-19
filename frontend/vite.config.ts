import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: false,
      },
      '/socket.io': {
        target: 'http://localhost:3333',
        ws: true,
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
