/**
 * Descarga y auto-aloja las tipografías (subset latin + latin-ext) para que la
 * app funcione sin conexión y en PWA.
 *   node tools/fuentes.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const URL_FUENTES =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap";

const KEEP = ["latin", "latin-ext"];
const DESTINO = new URL("../public/fonts/", import.meta.url).pathname;
const SALIDA = new URL("../src/styles/fuentes.css", import.meta.url).pathname;

const res = await fetch(URL_FUENTES, { headers: { "User-Agent": UA } });
if (!res.ok) throw new Error(`Google Fonts respondió ${res.status}`);
const css = await res.text();

await mkdir(DESTINO, { recursive: true });

// Cada bloque @font-face va precedido de un comentario /* subset */
const bloques = css.split("/*").slice(1);
const conservados = [];

for (const bloque of bloques) {
  const subconjunto = bloque.slice(0, bloque.indexOf("*/")).trim();
  if (!KEEP.includes(subconjunto)) continue;

  const cuerpo = bloque.slice(bloque.indexOf("*/") + 2);
  const familias = cuerpo.match(/font-family:\s*'([^']+)'/);
  const peso = cuerpo.match(/font-weight:\s*([^;]+);/);
  const url = cuerpo.match(/url\((https:\/\/[^)]+)\)/);
  if (!familias || !url) continue;

  const nombreArchivo = `${familias[1].toLowerCase()}-${(peso?.[1] || "400").trim().replace(/\s+/g, "-")}-${subconjunto}.woff2`;

  const binario = await fetch(url[1], { headers: { "User-Agent": UA } });
  if (!binario.ok) throw new Error(`No se pudo descargar ${nombreArchivo}`);
  await writeFile(join(DESTINO, nombreArchivo), Buffer.from(await binario.arrayBuffer()));

  conservados.push(
    cuerpo.replace(/url\(https:\/\/[^)]+\)/, `url("/fonts/${nombreArchivo}")`).trim(),
  );
  console.log(`✓ ${nombreArchivo}`);
}

const cabecera = `/* Generado por tools/fuentes.mjs · tipografías auto-alojadas */\n\n`;
await writeFile(SALIDA, cabecera + conservados.join("\n\n") + "\n");
console.log(`\nFuentes.css escrito en ${SALIDA}`);
