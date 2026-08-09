import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 3000,
    },
    proxy: {
      '/api': {
        target: 'http://storesprite-be:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://storesprite-be:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

