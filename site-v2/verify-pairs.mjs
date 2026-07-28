// Kép–blokk párosítás ellenőrzése.
//
// A korábbi kör fő hibája: a képeket a generátor választotta, nem a forrás
// párosítása szerint kerültek a helyükre. Ez a script tételesen összeveti,
// hogy a kimeneten minden szövegblokk mellett UGYANAZ a kép áll, mint a
// forrásban — a szöveg alapján azonosítva a blokkot.

import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';

const key = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 46);
const fileOf = (src) => decodeURIComponent((src || '').split('/').pop() || '')
  .replace(/^[0-9a-f]+_/, '').replace(/^ef-/, '');

let fail = 0;

/* ---------- Főoldal ---------- */
{
  const $s = cheerio.load(readFileSync('ef-src/index.html', 'utf8'));
  const $o = cheerio.load(readFileSync('public/index.html', 'utf8'));

  // forrás: cím -> kép
  const srcPairs = new Map();
  $s('.tab-content-item-4').each((_, el) => {
    const $e = $s(el);
    srcPairs.set(key($e.find('[class*="text-h6"]').first().text()),
      fileOf($e.find('img').first().attr('src')));
  });
  $s('.tab-content-item-6').each((_, el) => {
    const $e = $s(el);
    srcPairs.set(key($e.find('[class*="text-body-bold"]').first().text()),
      fileOf($e.find('img').first().attr('src')));
  });
  // a bemutatkozó blokk
  const $sp = $s('.home-a-column-section').first();
  srcPairs.set(key($sp.find('[class*="text-h3"]').first().text()),
    fileOf($sp.find('img').first().attr('src')));

  // kimenet: cím -> kép
  const outPairs = new Map();
  $o('.tab-content-item').each((_, el) => {
    const $e = $o(el);
    outPairs.set(key($e.find('.text-body-bold').first().text()),
      fileOf($e.find('img').first().attr('src')));
  });
  const $op = $o('.ef-split').first();
  if ($op.length) {
    outPairs.set(key($op.find('[class*="text-h3"], h2').first().text()),
      fileOf($op.find('img').first().attr('src')));
  }

  console.log('### Főoldal — blokk ↔ kép');
  for (const [k, img] of srcPairs) {
    const got = outPairs.get(k);
    const ok = got === img;
    if (!ok) fail++;
    console.log(`  ${ok ? 'OK ' : 'HIBA'} "${k.slice(0, 40)}" → forrás:${img || '(nincs)'} `
      + `kimenet:${got === undefined ? '(BLOKK NEM TALÁLHATÓ)' : got || '(nincs)'}`);
  }
}

/* ---------- Szolgáltatás ---------- */
{
  const $s = cheerio.load(readFileSync('ef-src/szolgaltatas.html', 'utf8'));
  const $o = cheerio.load(readFileSync('public/szolgaltatas.html', 'utf8'));
  const S = $s('body > section');

  const srcPairs = new Map();
  [3, 4, 5].forEach((i) => {
    const $e = S.eq(i);
    srcPairs.set(key($e.find('[class*="text-h3"], h2').first().text()),
      fileOf($e.find('img').first().attr('src')));
  });
  // konzultációs blokk (portré)
  srcPairs.set(key(S.eq(8).find('h2').first().text()),
    fileOf(S.eq(8).find('img').first().attr('src')));
  // hero csapatkép
  srcPairs.set(key(S.eq(0).find('h1').first().text()),
    fileOf(S.eq(0).find('img[class*="about-image"]').first().attr('src')));

  const outPairs = new Map();
  $o('.ef-pillar-sec').each((_, el) => {
    const $e = $o(el);
    outPairs.set(key($e.find('h2').first().text()), fileOf($e.find('img').first().attr('src')));
  });
  const $tl = $o('.ef-tl-dark').first();
  if ($tl.length) {
    outPairs.set(key($tl.find('[class*="text-h3"]').first().text()),
      fileOf($tl.find('img').first().attr('src')));
  }
  const $h = $o('.ef-service-hero').first();
  outPairs.set(key($h.find('h1').first().text()), fileOf($h.find('img').first().attr('src')));

  console.log('\n### Szolgáltatás — blokk ↔ kép');
  for (const [k, img] of srcPairs) {
    const got = outPairs.get(k);
    const ok = got === img;
    if (!ok) fail++;
    console.log(`  ${ok ? 'OK ' : 'HIBA'} "${k.slice(0, 40)}" → forrás:${img || '(nincs)'} `
      + `kimenet:${got === undefined ? '(BLOKK NEM TALÁLHATÓ)' : got || '(nincs)'}`);
  }
}

/* ---------- Rólam: történet-fülek ---------- */
{
  const $s = cheerio.load(readFileSync('ef-src/rolam.html', 'utf8'));
  const $o = cheerio.load(readFileSync('public/rolam.html', 'utf8'));

  const srcPairs = new Map();
  $s('[class*="tab-accordion"]').each((i, el) => {
    const $pane = $s('[class*="tab-pane"]').eq(i);
    srcPairs.set(key($s(el).find('strong').first().text()),
      fileOf($pane.find('img').first().attr('src')));
  });
  // a hero és a „szolgálok" blokk képe
  srcPairs.set(key($s('body > section').eq(0).find('h2').first().text()),
    fileOf($s('body > section').eq(0).find('img').first().attr('src')));
  srcPairs.set(key($s('body > section').eq(2).find('[class*="text-h3"]').first().text()),
    fileOf($s('body > section').eq(2).find('img').first().attr('src')));

  const outPairs = new Map();
  $o('.ef-story .tab-pane-features').each((_, el) => {
    const $e = $o(el);
    outPairs.set(key($e.find('.text-h6').first().text()), fileOf($e.find('img').first().attr('src')));
  });
  $o('.ef-split').each((_, el) => {
    const $e = $o(el);
    outPairs.set(key($e.find('h1, h2').first().text()), fileOf($e.find('img').first().attr('src')));
  });

  console.log('\n### Rólam — blokk ↔ kép');
  for (const [k, img] of srcPairs) {
    const got = outPairs.get(k);
    const ok = got === img;
    if (!ok) fail++;
    console.log(`  ${ok ? 'OK ' : 'HIBA'} "${k.slice(0, 40)}" → forrás:${img || '(nincs)'} `
      + `kimenet:${got === undefined ? '(BLOKK NEM TALÁLHATÓ)' : got || '(nincs)'}`);
  }
}

console.log(`\n===== ${fail === 0 ? 'MINDEN PÁROSÍTÁS EGYEZIK' : fail + ' ELTÉRÉS'} =====`);
