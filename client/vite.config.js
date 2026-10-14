import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In der Entwicklung leitet Vite alle Anfragen an /api an den Node.js-Server weiter
    proxy: { '/api': 'http://localhost:3000' },
  },
});
