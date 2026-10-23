import { existsSync } from 'node:fs';
import { leerArchivo } from './utils.mjs';

const checks = [
  ['src/lib/gpx.js existe', () => existsSync('src/lib/gpx.js')],
  ['src/lib/almacen.js existe', () => existsSync('src/lib/almacen.js')],
  ['src/store/audio.js existe', () => existsSync('src/store/audio.js')],
  ['src/views/_audio.js existe', () => existsSync('src/views/_audio.js')],
  ['vite.config.js con base relativa', () => leerArchivo('vite.config.js').includes('base: "./"')],
  ['GPX usa DOMParser', () => leerArchivo('src/lib/gpx.js').includes('DOMParser')],
  ['Altitud preservada en GeoJSON', () => leerArchivo('src/lib/gpx.js').includes('coordinates: s.map')],
  ['Categorías sin duplicados', () => {
    const txt = leerArchivo('src/views/_audio.js');
    const dup = (txt.match(/for \(const categoria of CATEGORIAS_AUDIO\)[\s\S]*?for \(const categoria of CATEGORIAS_AUDIO\)/g) || []).length;
    return dup === 0;
  }],
  ['Workflows presentes', () => existsSync('.github/workflows/ci.yml') && existsSync('.github/workflows/deploy-pages.yml')],
  ['README documenta variables', () => leerArchivo('README.md').includes('VITE_SUPABASE_URL') && leerArchivo('README.md').includes('VITE_SUPABASE_ANON_KEY')],
];

let ok = 0;
for (const [name, fn] of checks) {
  try {
    if (fn()) { console.log('OK:', name); ok++; } else { console.log('FALLO:', name); }
  } catch (e) { console.log('FALLO:', name, e.message); }
}
console.log();
process.exit(ok === checks.length ? 0 : 1);
