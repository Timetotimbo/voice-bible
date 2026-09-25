import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set by the deploy workflow
  base: process.env.BASE_PATH || '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  server: { host: true, port: 8080 },
});
