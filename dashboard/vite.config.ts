import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prioriza variantes .web.* (módulos compartilhados com o app Expo, ex.: utils/photoToBase64.web.ts)
    extensions: ['.web.tsx', '.web.ts', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
  // O web worker do maplibre-gl v6 não sobrevive ao dep optimizer do dev
  // server (maplibre-gl-worker.mjs ausente no cache), quebrando os testes
  // visuais com servidor frio. O build de produção empacota normalmente.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/maplibre-gl')) {
            return 'vendor-map';
          }
        },
      },
    },
  },
});
