import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

/** Every file under public/, as paths like 'bibles/kjv.json'. */
function publicFiles(dir = 'public', prefix = ''): string[] {
  return readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? publicFiles(join(dir, f), `${prefix}${f}/`) : [`${prefix}${f}`]));
}

/** The offline service worker (scripts/sw-template.js) with this build's files and version filled in. */
function offlineServiceWorker(base: string): Plugin {
  return {
    name: 'offline-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const pub = publicFiles();
      const data = pub.filter(f => f.startsWith('bibles/'));
      const shell = ['', 'index.html', ...pub.filter(f => !data.includes(f)), ...Object.keys(bundle).filter(f => !f.endsWith('.map') && f !== 'version.json')];
      // The Bible files' cache only changes when the files do (they're big)
      const dataKey = createHash('sha256').update(data.map(f => readFileSync(join('public', f))).reduce((h, b) => h + createHash('sha256').update(b).digest('hex'), '')).digest('hex').slice(0, 12);
      const source = readFileSync('scripts/sw-template.js', 'utf8')
        .replace('__VERSION__', `${pkg.version}-${Date.now().toString(36)}`)
        .replace('__BASE__', base)
        .replace('__SHELL__', JSON.stringify([...new Set(shell)].map(f => base + f)))
        .replace('__DATA__', JSON.stringify(data.map(f => base + f)))
        .replace('__DATAKEY__', dataKey)
        .replace('__AUDIO__', process.env.VITE_AUDIO_BASE || '')
        .replace('__FONTS__', JSON.stringify([...readFileSync('index.html', 'utf8').matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'))));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

const BASE = process.env.BASE_PATH || '/';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set by the deploy workflow
  base: BASE,
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
    offlineServiceWorker(BASE),
  ],
  server: { host: true, port: 8080 },
});
