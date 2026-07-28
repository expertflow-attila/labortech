// Saját assetek átmásolása a kimenetbe.
//
// MIÉRT KELL: a crawl-lépések a Modulabs sablon és a Tudástár-appok assetjeit
// töltik le, de a saját képeink (az Expert Flow forrás `ef-*` fotói, a
// projekt-képek, a GSAP ScrollTrigger) sehonnan nem jönnek — korábban kézzel
// másoltam őket a `public/assets/`-be. Egy friss klónon (pl. Vercel-build) ez
// észrevétlenül kimaradt: az oldalak felépültek, de 51 kép 404-elt.
//
// Ezért a ténylegesen hivatkozott fájlok a repóban élnek (`assets-src/`), és
// ez a lépés másolja őket a kimenetbe. Új kép felvételekor:
//   1. tedd be az `assets-src/`-be,
//   2. hivatkozz rá `/assets/<fájlnév>`-ként.

import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets-src';
const DEST = join('public', 'assets');

if (!existsSync(SRC)) {
  console.log('SKIP: nincs assets-src/');
} else {
  mkdirSync(DEST, { recursive: true });
  let copied = 0;
  let bytes = 0;
  for (const name of readdirSync(SRC)) {
    const from = join(SRC, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(DEST, name));
    copied++;
    bytes += statSync(from).size;
  }
  console.log(`BN assets: ${copied} saját fájl másolva (${(bytes / 1048576).toFixed(1)} MB)`);
}
