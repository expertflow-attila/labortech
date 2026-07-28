// Tartalmi lefedettség: a forrásoldal MINDEN érdemi szövegblokkja megvan-e a
// kimeneten. Ez az elfogadás mércéje — a korábbi körben pont az bukott meg,
// hogy a szöveg átjött ugyan, de nem néztem meg tételesen, mi maradt ki.
//
// Az összevetés szóköz- és írásjel-toleráns, mert a sablonba illesztés közben
// a tördelés változhat. A márkanév-csere (Expert Flow -> Business Native) miatt
// mindkét oldalon normalizáljuk a márkanevet.

import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';

const norm = (s) => (s || '')
  .replace(/ /g, ' ')
  .replace(/[\u201C\u201D\u201E\u00AB\u00BB"]/g, '').replace(/[\u2018\u2019']/g, '')
  .replace(/[·•]/g, ' ')
  .replace(/[–—−]/g, '-')
  .replace(/Expert\s*Flow/gi, 'BRAND').replace(/Business\s*Native/gi, 'BRAND')
  .replace(/\s+/g, ' ')
  .replace(/[.,:;!?()]/g, '')
  .trim().toLowerCase();

// Egy dokumentum összes érdemi szövegcsomópontja (a nav/footer nélkül, mert
// azokat szándékosan a BN sajátjára cseréljük).
function textsOf(file, { skip = [] } = {}) {
  const $ = cheerio.load(readFileSync(file, 'utf8'));
  $('script, style, noscript').remove();
  skip.forEach((sel) => $(sel).remove());
  const out = new Set();
  $('body').find('*').each((_, el) => {
    if (['svg', 'path', 'script', 'style'].includes(el.tagName)) return;
    $(el).contents().each((__, n) => {
      if (n.type !== 'text') return;
      const t = norm(n.data);
      if (t.length >= 12) out.add(t);
    });
  });
  return out;
}

const CASES = [
  { name: 'Főoldal', src: 'ef-src/index.html', out: 'public/index.html' },
  { name: 'Szolgáltatás', src: 'ef-src/szolgaltatas.html', out: 'public/szolgaltatas.html' },
  { name: 'Rólam', src: 'ef-src/rolam.html', out: 'public/rolam.html' },
  // Ezt a kettőt az Expert Flow forrás nem tartalmazza, ezért a
  // businessnative.hu marad a mérce (Attila kifejezetten kérte az Árak
  // oldal felépítésének megtartását).
  { name: 'Árak', src: 'bn-src/pricing.html', out: 'public/arak.html' },
  { name: 'Kapcsolat', src: 'bn-src/contact/contact-a.html', out: 'public/kapcsolat.html' },
];

// A nav/footer/sablon-maradék tudatosan nem kerül át.
const SKIP_SRC = ['.master-footer-4', '.navbar-15', '.card-marquee-2', '.marquee-images-2 a',
  // a BN-forrás saját fejléce/lábléce/sávjai — ezeket a V2 sajátra cseréli
  '.bnx-header', '.bnx-footer', '.bnx-topbar', '.bnx-mobile', '.bnx-totop',
  '.w-form-done', '.w-form-fail', '.success-message', '.error-message'];
const SKIP_OUT = ['.navbar', 'footer', '.cta-section'];

let grandOk = 0, grandTotal = 0;
for (const c of CASES) {
  const src = textsOf(c.src, { skip: SKIP_SRC });
  const out = textsOf(c.out, { skip: SKIP_OUT });
  const outJoined = [...out].join(' || ');
  const missing = [...src].filter((t) => !out.has(t) && !outJoined.includes(t));
  const ok = src.size - missing.length;
  grandOk += ok; grandTotal += src.size;
  const pct = ((ok / src.size) * 100).toFixed(1);
  console.log(`\n### ${c.name}: ${ok}/${src.size} szövegblokk (${pct}%)`);
  if (missing.length) {
    console.log('  HIÁNYZÓ:');
    missing.forEach((m) => console.log('   -', m.slice(0, 100)));
  }
}
console.log(`\n===== ÖSSZESEN: ${grandOk}/${grandTotal} `
  + `(${((grandOk / grandTotal) * 100).toFixed(1)}%) =====`);
