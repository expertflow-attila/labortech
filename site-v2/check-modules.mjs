// Előellenőrzés a build elé.
//
// A CSS/JS blokkok template literalban (backtick-ben) élnek, ezért egyetlen
// backtick egy magyar kommentben — pl. a .expandable-single köré téve —
// lezárja a stringet, és a build szintaktikai hibával áll meg. Ez a körben
// négyszer megtörtént, ezért itt egy olcsó őrszem:
//   1. MINDEN .mjs szintaxisa (mellékhatás nélkül, `node --check`),
//   2. a CSS-t exportáló modulok tényleges betölthetősége.

import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('.').filter((f) => f.endsWith('.mjs'));
let bad = 0;

for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    bad++;
    const msg = (e.stderr || '').toString().split('\n').slice(0, 3).join(' ').trim();
    console.error(`  SZINTAXIS  ${f}: ${msg}`);
  }
}

for (const m of ['./shared.mjs', './motion.mjs', './sections.mjs', './ef-sections.mjs']) {
  try { await import(m); } catch (e) { bad++; console.error(`  BETÖLTÉS   ${m}: ${e.message}`); }
}

if (bad) { console.error(`\n${bad} hiba — a build leáll.`); process.exit(1); }
console.log(`modulok rendben (${files.length} fájl ellenőrizve)`);
