// Business Native — egységesítő záró pass.
//
// MINDEN publikált oldalra (a kézzel mappelt fő oldalakra és a generált
// projekt/esettanulmány/árak oldalakra egyaránt) ráfuttatja a globális
// brandinget: navigáció, lábléc, márkanevek, sablon-reklám eltávolítása.
// Így nem fordulhat elő, hogy egy generált oldal Modulabs-fejlécet kap.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TD_CSS, MOTION_JS } from './shared.mjs';
import { BNM_CSS, BNM_SCRIPTS, BNM_JS } from './motion.mjs';
import { SECTIONS_CSS } from './sections.mjs';
import { EF_CSS } from './ef-sections.mjs';

const OUT = 'public';
const EMAIL = 'hello@businessnative.hu';
const CAL = 'https://cal.com/attila-nagy-hjau8q/egyeni-konzultacio';
// A szegmentáló kvíz mostantól ezen az oldalon él (`/kviz`), a V2 arculatában.
// A régi külső link átirányítása egy helyen történik, hogy a forrásokból
// örökölt hivatkozások se vezessenek ki az oldalról.
const QUIZ = '/kviz';
const QUIZ_EXTERNAL = /https?:\/\/expertflow-quiz\.vercel\.app\/?(?![a-z])/g;
const YT = 'https://youtube.com/@expertflow-hu';
const LI = 'https://www.linkedin.com/in/nagy-attila-expert/';
const NAPLO = 'https://dirt-and-clouds-v2.vercel.app/';

const NAV = [
  ['/szolgaltatas', 'Szolgáltatás'],
  ['/arak', 'Árak'],
  ['/rolam', 'Rólam'],
  ['/projektek', 'Projektek'],
  ['/tudastar', 'Tudástár'],
];

const FOOTER_COLS = [
  ['Oldalak', [['/szolgaltatas', 'Szolgáltatás'], ['/arak', 'Árak'], ['/projektek', 'Projektek']]],
  ['Ismerj meg', [['/rolam', 'Rólam'], [NAPLO, 'Napló'], ['/tudastar', 'Tudástár']]],
  ['Jogi tudnivalók', [['/adatvedelem', 'Adatvédelem'], ['/aszf', 'ÁSZF'], ['/garancia', 'Garancia']]],
];

const BRAND_RE = [
  [/Modulabsszal/g, 'Business Native-val'],
  [/Modulabsnál/g, 'Business Native-nál'],
  [/Modulabshoz/g, 'Business Native-hoz'],
  [/Modulabsot/g, 'Business Native-ot'],
  [/Modulabs/g, 'Business Native'],
  [/BYQ Studio/g, 'Business Native'],
  [/Modul[áa]ris Webflow-sablon[^.]*\./gi, 'AI alapú működés szolgáltató vállalkozóknak.'],
  [/Webflow[- ]sablon/gi, ''],
  [/John Kowalski/g, 'Nagy Attila'],
  [/Vezérigazgató és társalapító/g, 'Alapító'],
  [/2025\.\s*szeptember\s*15\./gi, ''],
  [/Expert\s*Flow/g, 'Business Native'],
  [/Varsó, Lengyelország/g, 'Budapest, Magyarország'],
  [/contact@modulabs\.com/g, EMAIL],
  [/\+48\s?123\s?456\s?789/g, ''],
  [/Sablon letöltése/g, 'Konzultáció'],
  [/Foglalj hívást/g, 'Beszéljünk'],
  [/További sablonok/g, 'Tudástár'],
  [/Áttekintés/g, 'Főoldal'],
];

function brandSweep($) {
  let hits = 0;
  $('*').each((_, el) => {
    if (!el.tagName) return;
    const t = el.tagName.toLowerCase();
    if (t === 'script' || t === 'style' || t === 'noscript') return;
    $(el).contents().each((_, n) => {
      if (n.type !== 'text') return;
      let d = n.data;
      const b = d;
      for (const [re, rep] of BRAND_RE) d = d.replace(re, rep);
      if (d !== b) { n.data = d; hits++; }
    });
  });
  // meta + attribútumok
  $('meta[content]').each((_, el) => {
    let c = $(el).attr('content') || '';
    const b = c;
    for (const [re, rep] of BRAND_RE) c = c.replace(re, rep);
    if (c !== b) $(el).attr('content', c);
  });
  const t = $('title').text();
  if (t) {
    let n = t;
    for (const [re, rep] of BRAND_RE) n = n.replace(re, rep);
    if (n !== t) $('title').text(n.replace(/\s*[–—-]\s*HTML weboldalsablon/i, ''));
  }
  return hits;
}

// Kitalált ügyfél/referencia TILOS. A sablon több oldalon hoz egy „Cégek,
// akikkel együtt dolgoztunk" logósávot kitalált cégekkel; ahol nem cseréltük
// valódi eszköz-logókra, ott az egész szekció megy.
function stripFakeClients($) {
  $('.master-logos').each((_, el) => {
    const label = ($(el).find('.label-small').first().text() || '').toLowerCase();
    if (/cégek|ügyfel|partnerein|akikkel/.test(label)) {
      // a burkoló elemek is mennek, különben üres sáv marad a helyükön
      const $wrap = $(el).closest('.wrap-marquee-logos, .master-marquee-logos');
      ($wrap.length ? $wrap : $(el)).remove();
      $(el).remove();
    }
  });
}

function cleanup($) {
  stripFakeClients($);
  $('.sales-cta-master').remove();
  $('.w-webflow-badge').remove();
  $('a[href^="tel:"]').each((_, el) => { if (!$(el).text().trim()) $(el).remove(); });
  $('a[href^="mailto:"]').attr('href', `mailto:${EMAIL}`);
  $('a[href*="byq.supply"], a[href*="webflow.io"], a[href*="webflow.com"]').each((_, el) => {
    $(el).attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');
  });
  $('a[href="https://linkedin.com"]').attr('href', LI);
  // A kvíz külső hivatkozásai a belső oldalra mutatnak (a beküldés továbbra is
  // a kvíz-app API-jára megy — azt nem írjuk át).
  $('a[href*="expertflow-quiz.vercel.app"]').each((_, el) => {
    const h = $(el).attr('href') || '';
    if (h.includes('/api/')) return;
    $(el).attr('href', QUIZ).removeAttr('target').removeAttr('rel');
  });
  // a főoldalon a régi Expert Flow-s foglalási link maradt
  $('a[href*="cal.com"]').each((_, el) => {
    const h = $(el).attr('href') || '';
    if (!h.includes('attila-nagy-hjau8q')) $(el).attr('href', CAL);
  });
  // sablonbelső útvonalak -> BN útvonalak
  const MAP = {
    '/': '/', '/about': '/rolam', '/pricing': '/arak',
    '/service/service-a': '/szolgaltatas', '/service/service-b': '/szolgaltatas',
    '/service/service-c': '/szolgaltatas', '/contact/contact-a': '/kapcsolat',
    '/contact/contact-b': '/kapcsolat', '/contact/contact-c': '/kapcsolat',
    '/news-insights': '/projektek', '/careers': '/tudastar',
    '/homepage/home-b': '/', '/homepage/home-c': '/',
  };
  $('a[href]').each((_, el) => {
    let h = ($(el).attr('href') || '').replace(/\.html$/, '');
    if (MAP[h]) $(el).attr('href', MAP[h]);
    else if (h.startsWith('/news-insights/')) $(el).attr('href', '/projektek');
  });
}

function rewriteNav($) {
  $('.navbar').find('.w-dropdown').remove();
  // A főoldal saját navigációjában maradtak árva linkek közvetlenül a
  // .nav-menu alatt (Főoldal/Szolgáltatás/Rólam/Kapcsolat) — asztali nézetben
  // nyitott lenyílóként látszottak a valódi menü alatt.
  $('.nav-menu').children('a.nav-link, .nav-link').remove();
  const $inner = $('.nav-menu-inner').first();
  if ($inner.length) {
    $inner.find('.nav-link, .w-dropdown').remove();
    for (const [href, label] of NAV) {
      $inner.append(`<a href="${href}" class="nav-link">${label}</a>`);
    }
  }
  const $m = $('.wrap-mobile-menu').first();
  if ($m.length) {
    // A sablon mobilmenüje egy komplett sablon-eladó blokkot hoz („Kezdőlap A/B/C",
    // „Rólunk", többes szám első személyű marketingszöveggel) — az egész megy.
    $m.find('.mobile-nav-top-tile, .mobile-nav-bottom-tile').remove();
    $m.find('.nav-link, .w-dropdown, .nav-right').remove();
    // fordított sorrendben prepend-elünk, hogy a menü sorrendje a desktoppal egyezzen
    for (const [href, label] of [...NAV].reverse()) {
      $m.prepend(`<a href="${href}" class="nav-link">${label}</a>`);
    }
  }
  $('.cta-small').attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener').text('Konzultáció');
}

function rewriteFooter($) {
  const $cols = $('.footer-columns');
  if (!$cols.length) return;
  $cols.children().each((i, el) => {
    const col = FOOTER_COLS[i];
    if (!col) { $(el).remove(); return; }
    const $el = $(el);
    $el.children().first().text(col[0]);
    const $links = $el.find('a');
    // A főoldal saját láblécében kevesebb link van, mint a sablonéban — ott a
    // hiányzókat pótolni kell, különben csendben elvesznek (ÁSZF, Garancia).
    const tpl = $links.length ? $.html($links.first()) : '<a class="footer-link"></a>';
    const $holder = $links.length ? $links.first().parent() : $el;
    $links.each((j, a) => { if (j >= col[1].length) $(a).remove(); });
    col[1].forEach(([href, label], j) => {
      let $a = $el.find('a').eq(j);
      if (!$a.length) {
        $holder.append(cheerio.load(tpl, null, false).root().children().first());
        $a = $el.find('a').eq(j);
      }
      $a.attr('href', href).text(label);
      if (href.startsWith('http')) $a.attr('target', '_blank').attr('rel', 'noopener');
      else $a.removeAttr('target').removeAttr('rel');
    });
  });
  // az index láblécében .body-medium van, nem <p> — a szelektornak mindkettőt kell
  $('.footer-right').find('p, .body-medium').first()
    .text('AI-alapú rendszerek szolgáltató vállalkozóknak.');
  $('.footer-socials').find('a').each((i, a) => {
    $(a).attr('href', i === 0 ? YT : LI).attr('target', '_blank').attr('rel', 'noopener');
  });

  // Jogi sor. A fordítás szóközéppen tört el a <br>-eknél („Business NativeW /
  // ebflow sablon"), ezért a teljes blokkot újraírjuk, sablonlinkek nélkül.
  $('.footer-bottom-right').find('.label-small').first()
    .html('© 2026 Business Native — Nagy Attila Ferenc e.v.<br>Minden jog fenntartva.');
  $('.footer-right').find('.label-small').each((_, el) => {
    const t = ($(el).text() || '').trim().toLowerCase();
    if (t === 'kapcsolat') $(el).text('Kapcsolat');
    if (t === 'kövess minket') $(el).text('Közösségi felületek');
  });
  const LEGAL = [['/adatvedelem', 'Adatvédelem'], ['/aszf', 'ÁSZF'], ['/garancia', 'Garancia']];
  const $legal = $('.footer-legal-column');
  if ($legal.length) {
    const sep = $legal.find('.label-small').first();
    const sepHtml = sep.length ? $.html(sep) : '<div class="label-small label-medium">·</div>';
    $legal.html(LEGAL.map(([href, label]) =>
      `<a href="${href}" class="footer-legal-link">${label}</a>`).join(sepHtml));
  }
}

// A sablon `twitter:*` metái a Webflow-sablon reklámszövegét vitték tovább, és
// a régi sablon-oldalcímeket („Karrier | …", „Adatkezelési tájékoztató") —
// megosztáskor ez látszott. A valódi címből és leírásból írjuk felül.
function fixSocialMeta($) {
  const title = ($('title').text() || '').trim();
  const desc = ($('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content') || '').trim();
  if (title) {
    $('meta[name="twitter:title"], meta[property="og:title"]').attr('content', title);
  }
  if (desc) {
    $('meta[name="twitter:description"], meta[property="og:description"]').attr('content', desc);
  }
}

// A sablon záró CTA-ja többes szám első személyű („Építjük a holnap üzletét"),
// a BN viszont egyszemélyes márka.
function fixClosingCta($) {
  $('.heading-cta').each((_, el) => {
    const t = ($(el).text() || '').trim();
    if (/Építjük a holnap üzletét/i.test(t)) {
      $(el).text('Nézzük meg, mit érdemes elsőként rendbe tenni');
    }
  });
}

const CSS = `<style id="bn-polish">
  .bn-tool-logo{filter:brightness(0) invert(1);opacity:.82}
  .w-webflow-badge{display:none !important}
</style>`;

/* ------------------------------------------------------------------ */

function pages(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (['assets', '_report'].includes(f)) continue;
      pages(p, acc);
    } else if (f.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// csak a BN-oldalakra futtatjuk (a megmaradt sablonoldalakat nem bántjuk)
const TARGETS = [
  'index.html', 'szolgaltatas.html', 'rolam.html', 'kapcsolat.html',
  'arak.html', 'projektek.html', 'tudastar.html',
  'gyik.html', 'garancia.html', 'adatvedelem.html', 'aszf.html',
  'kviz.html',
];

let n = 0;
const all = pages(OUT);
for (const p of all) {
  const rel = p.replace(OUT + '/', '');
  const isTarget = TARGETS.includes(rel)
    || rel.startsWith('projektek/') || rel.startsWith('tudastar/');
  if (!isTarget) continue;
  const $ = cheerio.load(readFileSync(p, 'utf8'));
  cleanup($);
  fixSocialMeta($);
  fixClosingCta($);
  rewriteNav($);
  rewriteFooter($);
  brandSweep($);
  // A beszúrt blokkokat mindig FRISSÍTJÜK, nem csak hiányzáskor pótoljuk —
  // különben egy CSS-módosítás után a régi blokk maradna az oldalakon.
  $('#bn-polish').remove();
  $('head').append(CSS);
  // A cikk-/leckeoldalak törzs-stílusa (tartalomjegyzék-link, kódblokk,
  // screenshot-keret) minden BN-oldalra kell, nem csak a Tudástárra.
  $('#bn-tudastar').remove();
  $('head').append(TD_CSS);
  $('#bn-motion').remove();
  if ($('.bn-reveal').length) {
    $('body').append(MOTION_JS.replace('<script>', '<script id="bn-motion">'));
  }
  // Az újratervezett szekciók saját mozgás-rétege. Külön a régi `.bn-reveal`
  // rendszertől, mert az oldalak fokozatosan állnak át — amíg egy oldal a régi
  // úton megy, ne kelljen kétféle animációt egymásra tenni.
  $('#bn-motion-css, #bn-sections, #ef-sections, #bn-motion-js, script[src*="bn-scrolltrigger"]').remove();
  if ($('[data-bnm]').length) {
    $('head').append(BNM_CSS).append(SECTIONS_CSS).append(EF_CSS);
    $('body').append(BNM_SCRIPTS).append(BNM_JS);
  }
  writeFileSync(p, $.html());
  n++;
}
console.log(`BN polish: ${n} oldal egységesítve`);
