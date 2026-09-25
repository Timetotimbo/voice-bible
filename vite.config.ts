import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set by the deploy workflow
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { host: true, port: 8080 },
});
