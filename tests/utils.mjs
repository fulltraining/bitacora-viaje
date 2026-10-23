import { readFileSync } from 'node:fs';
export function leerArchivo(p) { return readFileSync(p, 'utf8'); }
