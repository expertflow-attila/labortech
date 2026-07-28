// Business Native — a szöveges oldalak (GYIK, Garancia, Adatvédelem, ÁSZF).
//
// Mind a négy a sablon `privacy-policy.html` rich-text vázába kerül. A forrás
// szövegtörzse egységes (`main .bnx-section` alatti tartalom), a GYIK-nál
// `<details>` elemek — ezeket kérdés/válasz párrá bontjuk, hogy a nyitogatós
// viselkedés helyett minden válasz olvasható legyen.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, txt } from './shared.mjs';

const SRC = 'bn-src';

const PAGES = [
  { file: 'gyik', out: 'gyik', label: 'Gyakori kérdések' },
  { file: 'garancia', out: 'garancia', label: 'Garancia' },
  { file: 'adatvedelem', out: 'adatvedelem', label: 'Jogi információk' },
  { file: 'aszf', out: 'aszf', label: 'Jogi információk' },
];

const KEEP = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b',
  'i', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'small']);

function sanitize($, $root) {
  // A GYIK alján kapcsolatfelvételi űrlap van, ami a látogató saját
  // levelezőprogramját nyitja meg. Az űrlapot nem visszük át (nincs mögötte
  // backend), de a CTA nem maradhat zsákutca — mailto-linkre cseréljük.
  $root.find('form').each((_, el) => {
    $(el).replaceWith('<p><a href="mailto:hello@businessnative.hu">'
      + 'Írj egy üzenetet a hello@businessnative.hu címre</a> — a küldés a saját '
      + 'levelezőprogramodon keresztül történik, az adataidat az '
      + '<a href="/adatvedelem">adatvédelmi tájékoztató</a> szerint kezelem.</p>');
  });
  $root.find('script, style, noscript, button, input, svg, nav, img').remove();
  // A GYIK oldalsó kategória-navigációja és a szemöldök-címkék tag nélküli
  // szövegcsomóként ragadnának a H2-k fölé a rich-text vázban.
  $root.find('.gy-side, .gy-nav, .bnx-eyebrow, .eyebrow').remove();
  // A záró CTA-gombok tartalom is — linkké alakítjuk, nem dobjuk el.
  $root.find('a.bnx-btn, a.cta, a.bnx-cta').each((_, el) => {
    $(el).removeAttr('class');
  });
  $root.find('.bnx-btn, .cta, .bnx-cta').not('a').remove();

  // A GYIK nyitogatós elemei helyett kérdés (h3) + válasz párok
  $root.find('details').each((_, el) => {
    const q = txt($(el).find('summary').first().text());
    $(el).find('summary').remove();
    $(el).replaceWith(`<h3>${q}</h3>` + ($(el).html() || ''));
  });

  $root.find('*').each((_, el) => {
    const tag = (el.tagName || '').toLowerCase();
    if (!KEEP.has(tag)) { $(el).replaceWith($(el).contents()); return; }
    for (const name of Object.keys(el.attribs || {})) {
      if (!(tag === 'a' && name === 'href')) $(el).removeAttr(name);
    }
    if (tag === 'a') {
      // a forrás .html végű belső útvonalai a V2 tiszta URL-jeire mutatnak
      let h = ($(el).attr('href') || '').replace(/\.html$/, '');
      if (h === '/index') h = '/';
      if (h.startsWith('http')) $(el).attr('target', '_blank').attr('rel', 'noopener');
      else if (h.startsWith('#')) { $(el).replaceWith($(el).contents()); return; }
      $(el).attr('href', h);
    }
  });
  return $root.html() || '';
}

const shellFile = join(OUT, 'privacy-policy.html');
if (!existsSync(shellFile)) {
  console.log('SKIP: nincs privacy-policy váz');
} else {
  const shell = readFileSync(shellFile, 'utf8');
  let n = 0;
  for (const page of PAGES) {
    const src = join(SRC, `${page.file}.html`);
    if (!existsSync(src)) { console.log(`  hiányzik: ${page.file}.html`); continue; }

    const $s = cheerio.load(readFileSync(src, 'utf8'));
    $s('header, footer, .bnx-topbar, .bnx-mobile, .bnx-totop').remove();
    const h1 = txt($s('h1').first().text());
    const desc = txt($s('meta[name="description"]').attr('content'));
    const lead = txt($s('.bnx-lead, .bnx-page-hero p').first().text());
    $s('h1').first().remove();

    const body = $s('main .bnx-section').map((_, el) => sanitize($s, $s(el))).get().join('\n');

    const $ = cheerio.load(shell);
    const $hero = $('.hero-legal-section');
    $hero.find('h1').first().text(h1);
    $hero.find('.label-small').first().text(page.label);
    // A sablonban a bevezető a JOBB hasábban (.wrap-legal) áll, amit lentebb
    // a dátum-takarítás kiürít — ezért ott csendben elveszett. A cím alá,
    // a bal hasábba tesszük.
    $hero.find('.body-medium').remove();
    $hero.find('.headline-legal').first().find('h1').first()
      .after(`<div class="body-medium" style="margin-top:var(--spacing--16)">${lead || desc}</div>`);
    $hero.find('a.text-underline').remove();
    // a bal hasáb különben több ezer pixelen át üresen áll a hosszú jogi szöveg mellett
    $hero.find('.headline-legal').first()
      .attr('style', 'position:sticky;top:120px;align-self:start');

    // A sablon hét külön kártyára bontja a jogi szöveget; nálunk egy törzs van,
    // ezért az elsőt töltjük fel, a többit elhagyjuk (különben a sablon saját
    // adatkezelési szövege lógna a lapunk alján).
    const $wrap = $('.wrap-legal');
    const $tiles = $wrap.find('.legal-tile');
    $tiles.slice(1).remove();
    $tiles.first().html(`<div class="legal-body w-richtext">${body}</div>`);
    // A sablon „utolsó frissítés" dátuma nem a mi adatunk — a forrásban nincs
    // hatálybalépési dátum, kitalálni pedig jogi szövegen nem szabad.
    $wrap.children().not('.legal-tile').remove();

    $('title').text(`${h1} — Business Native`);
    $('meta[name="description"], meta[property="og:description"]').attr('content', desc);
    $('meta[property="og:title"]').attr('content', h1);

    writeFileSync(join(OUT, `${page.out}.html`), $.html());
    console.log(`BN ${page.out}.html: ${txt(cheerio.load(body).root().text()).length} karakter`);
    n++;
  }
  console.log(`BN szöveges oldalak: ${n} kész.`);
}
