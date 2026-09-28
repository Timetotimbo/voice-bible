import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set by the deploy workflow
  base: process.env.BASE_PATH || '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      // The app fetches this to notice when a newer version is live
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version }) });
      },
    },
  ],
  server: { host: true, port: 8080 },
});
