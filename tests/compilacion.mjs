import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

try {
  console.log('Ejecutando npm run build...');
  execSync('npm run build', { stdio: 'inherit' });
  if (!existsSync('dist/index.html')) throw new Error('Falta dist/index.html');
  if (!existsSync('dist/assets')) throw new Error('Falta dist/assets');
  const html = statSync('dist/index.html');
  if (html.size < 1000) throw new Error('dist/index.html demasiado pequeño');
  console.log('OK - Compilación correcta');
  process.exit(0);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
