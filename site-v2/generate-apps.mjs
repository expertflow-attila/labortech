// Business Native — a Tudástár 6 külső alkalmazásának átültetése.
//
// Bemenet: `app-src/<app>/*.html` (crawl-apps.mjs tükre) + `app-assets/<app>/`.
// Kimenet: /tudastar/<app> indexoldal + /tudastar/<app>/<slug> leckeoldalak.
//
// A leckeoldalak mind a 6 appban egységesek: <h1> a cím, a meta description a
// leírás, a morzsamenü közepe a modul/kategória, a törzs pedig egy
// `article.lesson-content` (a landoló elemzéseknél `.case-container` fülekkel).
// Ezért egy kinyerő minden appot lekezel, app-specifikus elágazás nélkül.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, CAL, txt, tdShell, hasShell, buildToc, TD_CSS } from './shared.mjs';
import { APPS } from './crawl-apps.mjs';

const SRC = 'app-src';
const ASSETS = 'app-assets';

/* --------------------------------------------------------------------- */
/* Képek                                                                  */
/* --------------------------------------------------------------------- */

function copyAppImages(key) {
  const dir = join(ASSETS, key);
  if (!existsSync(dir)) return {};
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  const map = {};
  for (const f of readdirSync(dir)) {
    const dest = `app-${key}-${f}`;
    copyFileSync(join(dir, f), join(OUT, 'assets', dest));
    map[f] = `/assets/${dest}`;
  }
  return map;
}

// A crawler a képeket az útvonalukból képzett néven mentette (`/a/b.png` ->
// `a_b.png`), ezért itt ugyanígy oldjuk fel a lecke-relatív hivatkozásokat.
function resolveImg(src, pagePath, map) {
  if (!src || src.startsWith('data:')) return null;
  let p;
  try { p = new URL(src, 'https://x' + pagePath).pathname; } catch { return null; }
  return map[decodeURIComponent(p).replace(/^\/+/, '').replace(/\//g, '_')] || null;
}

/* --------------------------------------------------------------------- */
/* Kinyerés                                                               */
/* --------------------------------------------------------------------- */

const slugToPath = (slug) => '/' + slug.replace(/__/g, '/');
const APP_NAME = Object.fromEntries(APPS.map((a) => [a.key, a.name]));

const KEEP = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'strong',
  'em', 'b', 'i', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'code', 'pre', 'br', 'hr', 'mark', 'small', 'span', 'div']);

// A sablon rich-text vázába csak tiszta, szemantikus HTML mehet: a forrás
// osztályai/adatattribútumai és interaktív elemei nélkül.
function sanitize($, $root, pagePath, imgMap) {
  $root.find('script, style, noscript, button, form, input, iframe, nav').remove();
  $root.find('.lesson-toc, .lesson-nav, .lesson-feedback, .case-tabs, .bnx-btn, .cta').remove();

  // A letöltőgombok közül csak az marad, aminek a fájlját le is tükröztük
  // (a wireframe SVG például beágyazott, külön fájl nincs hozzá).
  $root.find('a.download-btn, a[download]').each((_, el) => {
    if (!resolveImg($(el).attr('href'), pagePath, imgMap)) $(el).remove();
  });
  // A hosszú forrás-screenshot saját görgethető keretet kap, különben
  // egymaga több ezer pixelnyire nyújtaná az oldalt.
  $root.find('.screenshot-wrap').each((_, el) => {
    $(el).replaceWith(`<div class="bn-shot">${$(el).html()}</div>`);
  });

  $root.find('*').each((_, el) => {
    const tag = (el.tagName || '').toLowerCase();
    // A landoló elemzések wireframe-je beágyazott SVG — az az anyag lényege,
    // ezért a teljes SVG-fát érintetlenül hagyjuk.
    if (tag === 'svg') return false;
    if ($(el).closest('svg').length) return;
    if (!KEEP.has(tag)) { $(el).replaceWith($(el).contents()); return; }
    const keepAttrs = tag === 'a' ? ['href'] : tag === 'img' ? ['src', 'alt']
      : ($(el).attr('class') === 'bn-shot' ? ['class'] : []);
    for (const name of Object.keys(el.attribs || {})) {
      if (!keepAttrs.includes(name)) $(el).removeAttr(name);
    }
    if (tag === 'img') {
      const mapped = resolveImg($(el).attr('src'), pagePath, imgMap);
      if (!mapped) { $(el).remove(); return; }
      $(el).attr('src', mapped).attr('loading', 'lazy');
    }
    if (tag === 'a') {
      const h = $(el).attr('href') || '';
      const asset = h.startsWith('http') ? null : resolveImg(h, pagePath, imgMap);
      if (asset) $(el).attr('href', asset).attr('target', '_blank').attr('rel', 'noopener');
      else if (h.startsWith('http')) $(el).attr('target', '_blank').attr('rel', 'noopener');
      else if (h.startsWith('#') || h.startsWith('/')) $(el).replaceWith($(el).contents());
    }
  });
  return $root.html() || '';
}

// Néhány appban (funnelek) a besorolás csak az indexoldal kártyáin van meg
// („Funnel · Kezdő" / „· Haladó"), a leckeoldal morzsamenüje kétszintű. Ezt a
// térképet csak akkor használjuk, ha a morzsamenüből nem jött valódi modul.
function readIndexCats(key) {
  const p = join(SRC, key, 'index.html');
  if (!existsSync(p)) return {};
  const $ = cheerio.load(readFileSync(p, 'utf8'));
  const map = {};
  $('a.lesson-card').each((_, el) => {
    const href = $(el).attr('href') || '';
    const slug = $(el).attr('data-slug')
      || href.replace(/\.html$/, '').split('/').filter(Boolean).pop();
    const meta = $(el).find('.lesson-meta span').last();
    const label = txt(meta.text()).replace(/^[·•\s]+/, '');
    if (slug && label) map[slug] = label;
  });
  return map;
}

// Az app saját indexoldala az igazság-forrás arra, mi tartozik az apphoz. A
// crawler direkt URL-en olyan oldalakat is elér, amiket az app szándékosan
// levett a listáról (az Online jelenlétben pl. a 16 funnel-lecke, ami azóta a
// Funnelek appban él) — ezeket nem duplikáljuk.
function readIndexLinks(key) {
  const p = join(SRC, key, 'index.html');
  if (!existsSync(p)) return null;
  const $ = cheerio.load(readFileSync(p, 'utf8'));
  const set = new Set();
  $('a[href]').each((_, a) => {
    const h = $(a).attr('href') || '';
    if (!h || h.startsWith('http') || h.startsWith('#') || h.startsWith('mailto:')) return;
    const s = h.replace(/\.html$/, '').split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (s) set.add(s);
  });
  return set.size ? set : null;
}

function readLesson(key, file, imgMap, indexCats = {}) {
  const slug = file.replace(/\.html$/, '');
  const pagePath = slugToPath(slug);
  const $ = cheerio.load(readFileSync(join(SRC, key, file), 'utf8'));

  const title = txt($('h1').first().text()) || txt($('title').text()).split('·')[0].trim();
  const desc = txt($('meta[name="description"]').attr('content'));

  // Modul/kategória. A morzsamenü ott adja meg (Főoldal / <modul> / <cím>),
  // ahol három elemű; a kétszintű appokban a címet ismételné, ezért ilyenkor
  // a szemöldök-címke, végső soron az app neve a besorolás.
  const crumbs = $('.breadcrumb').first().find('a, span')
    .map((_, e) => txt($(e).text())).get().filter((s) => s && s !== '/' && s !== '›');
  const eyebrow = txt($('.eyebrow, .kicker, .lesson-kicker').first().text());
  let cat = crumbs.length >= 3 ? crumbs[crumbs.length - 2] : '';
  if (!cat || cat === title) cat = indexCats[slug.split('__').pop()] || '';
  if (!cat) cat = eyebrow || APP_NAME[key] || 'Anyagok';

  // törzs: az elemzéseknél fülekre bontva, minden más appban egy blokk
  let body = '';
  const $tabs = $('.case-tabs');
  if ($tabs.length) {
    const labels = {};
    $tabs.find('a, button').each((_, e) => {
      const id = $(e).attr('data-tab') || ($(e).attr('href') || '').replace('#', '');
      if (id) labels[id] = txt($(e).text());
    });
    $('.tab-panel').each((_, el) => {
      const id = ($(el).attr('id') || '').replace(/^tab-/, '');
      const inner = sanitize($, $(el), pagePath, imgMap);
      if (!txt(cheerio.load(inner).root().text())) return;
      const label = labels[id] || labels['tab-' + id];
      body += (label ? `<h2>${label}</h2>` : '') + inner;
    });
  } else {
    const $art = $('article.lesson-content').first();
    const $extra = $('figure.wf-diagram-fig').first();
    if ($extra.length) body += sanitize($, $extra, pagePath, imgMap);
    // Néhány oldal (pl. a minikurzus munkalapja) nem lecke-vázat használ:
    // ott a fő szekció tartalma a törzs.
    const $fallback = $('main').length ? $('main').first()
      : $('body > section, body > .bnx-page').first();
    body += $art.length ? sanitize($, $art, pagePath, imgMap)
      : sanitize($, $fallback, pagePath, imgMap);
  }

  return { slug, title, desc, cat, body, len: txt(cheerio.load(body || '<p></p>').root().text()).length };
}

/* --------------------------------------------------------------------- */
/* Indexoldal                                                             */
/* --------------------------------------------------------------------- */

// Az indexeken lehet olyan kártya is, ami nem oldalra, hanem külső anyagra
// mutat (az Online jelenlétnél pl. a 46 skicc-diagram ZIP a Drive-on).
function readIndexExternals(key) {
  const p = join(SRC, key, 'index.html');
  if (!existsSync(p)) return [];
  const $ = cheerio.load(readFileSync(p, 'utf8'));
  return $('a.lesson-card, a.case-card')
    .filter((_, a) => ($(a).attr('href') || '').startsWith('http'))
    .map((_, a) => ({
      title: txt($(a).find('h3').first().text()),
      desc: txt($(a).find('p').first().text()),
      href: $(a).attr('href'),
      cat: txt($(a).find('.lesson-tag').first().text()) || 'Letöltés',
      external: true,
    })).get();
}

function buildAppIndex(app, lessons) {
  const $ = tdShell(app.name, app.lead);
  $('.hero-careers-section').find('.button-text-mask').text('Anyagok megtekintése');
  $('.hero-careers-section').find('a.cta-main').attr('href', '#anyagok');
  $('.careers-positions-section').attr('id', 'anyagok');
  $('.headline-positions').find('h2').first()
    .text(`${lessons.length + readIndexExternals(app.key).length} anyag ebben a témában`);

  // modulonként külön blokk, a forrás sorrendjét megtartva
  const groups = [];
  for (const l of [...lessons, ...readIndexExternals(app.key)]) {
    let g = groups.find((x) => x.cat === l.cat);
    if (!g) groups.push((g = { cat: l.cat, items: [] }));
    g.items.push(l);
  }

  const html = groups.map((g) => {
    const cards = g.items.map((l) =>
      `<div class="card-contact bn-reveal"><div class="text-wrap-contact-card">` +
      `<div class="text-large text-body-bold">${l.title}</div>` +
      `<div class="body-medium">${l.desc}</div></div>` +
      (l.external
        ? `<a class="label-small label-strong bn-card-link" href="${l.href}" target="_blank" rel="noopener">Megnyitom →</a>`
        : `<a class="label-small label-strong bn-card-link" href="/tudastar/${app.key}/${l.slug}">Megnyitom →</a>`) +
      `</div>`).join('');
    return `<div class="bn-group"><h3 class="text-h5 bn-group-title">${g.cat}</h3>` +
      `<div class="w-layout-grid contact-grid bn-tools">${cards}</div></div>`;
  }).join('');

  $('.careers.w-dyn-list').replaceWith(html);

  const $tile = $('.positions-bottom-tile');
  $tile.find('.text-body-bold').first().text('Kérdésed van valamelyik anyaghoz?');
  $tile.find('.text-small').first()
    .text('Ha elakadtál valahol, beszéljük át a saját helyzetedet.');
  $tile.find('.button-text-mask').text('Beszéljünk');
  $tile.find('a').attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');

  $('title').text(`${app.name} — Business Native`);
  $('meta[name="description"], meta[property="og:description"]').attr('content', app.lead);
  $('meta[property="og:title"]').attr('content', `${app.name} — Business Native`);
  $('head').append(TD_CSS);

  mkdirSync(join(OUT, 'tudastar'), { recursive: true });
  writeFileSync(join(OUT, 'tudastar', `${app.key}.html`), $.html());
  return groups.length;
}

/* --------------------------------------------------------------------- */
/* Leckeoldalak                                                           */
/* --------------------------------------------------------------------- */

function buildLessons(app, lessons, shell) {
  const dir = join(OUT, 'tudastar', app.key);
  mkdirSync(dir, { recursive: true });
  let n = 0;

  lessons.forEach((l, i) => {
    const $ = cheerio.load(shell);
    $('h1').first().text(l.title);
    $('.left-cms-hero').find('.master-label, .label-small').first().text(l.cat);
    // a sablon dátum-elválasztója („·") és üres dátuma nélkülünk árván maradna
    $('.left-cms-hero').find('.cms-info-tile .label-small.label-strong').remove();
    $('.image-wrap-cms-thumbnail').remove();
    // a hero kétoszlopos rácsa különben üres jobb felet hagyna 992px felett
    $('.cms-hero-halves').addClass('bn-single');

    const prev = lessons[i - 1];
    const next = lessons[i + 1];
    const nav = [
      prev ? `<a href="/tudastar/${app.key}/${prev.slug}">← ${prev.title}</a>` : '',
      `<a href="/tudastar/${app.key}">${app.name}</a>`,
      next ? `<a href="/tudastar/${app.key}/${next.slug}">${next.title} →</a>` : '',
    ].filter(Boolean).join(' · ');

    const $rt = $('.cms-body-left').find('.w-richtext, .rich-text').first();
    const $target = $rt.length ? $rt : $('.cms-body-left').first();
    $target.html(l.body + `<p style="margin-top:2rem">${nav}</p>`);

    buildToc($, $target);

    // „további anyagok" — a következő 3 lecke ugyanebből az appból
    const $more = $('.cms-more-articles').find('.w-dyn-item');
    $more.each((j, el) => {
      const pick = lessons[(i + j + 1) % lessons.length];
      if (!pick || pick.slug === l.slug || lessons.length < 2) { $(el).remove(); return; }
      const $c = $(el);
      const $a = $c.is('a') ? $c : $c.find('a').first();
      $a.attr('href', `/tudastar/${app.key}/${pick.slug}`);
      $c.find('.image-wrap-cms, .image-wrap-cms-thumbnail').remove();
      $c.find('.master-label').first().text(pick.cat);
      $c.find('.text-h6').first().text(pick.title);
      $c.find('.body-medium').first().text(pick.desc);
      const $meta = $c.find('.label-small.label-strong');
      if ($meta.length > 1) $meta.eq(1).text(app.name);
    });

    $('title').text(`${l.title} — ${app.name} — Business Native`);
    $('meta[name="description"], meta[property="og:description"]').attr('content', l.desc);
    $('meta[property="og:title"]').attr('content', l.title);
    $('head').append(TD_CSS);

    writeFileSync(join(dir, `${l.slug}.html`), $.html());
    n++;
  });
  return n;
}

/* --------------------------------------------------------------------- */

if (!hasShell()) {
  console.log('SKIP: nincs careers.html váz — előbb crawl.mjs');
} else {
  const artDir = join(OUT, 'news-insights');
  const shellFile = readdirSync(artDir).find((f) => f.endsWith('.html'));
  const shell = readFileSync(join(artDir, shellFile), 'utf8');

  let total = 0;
  for (const app of APPS) {
    const dir = join(SRC, app.key);
    if (!existsSync(dir)) { console.log(`  ${app.key}: nincs letükrözve`); continue; }

    const imgMap = copyAppImages(app.key);
    const $idx = cheerio.load(readFileSync(join(dir, 'index.html'), 'utf8'));
    app.lead = txt($idx('meta[name="description"]').attr('content'))
      || txt($idx('.hero-lede, .lede, .starter-lede, p').first().text());

    const indexCats = readIndexCats(app.key);
    const linked = readIndexLinks(app.key);
    const all = readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html').sort();
    const files = linked
      ? all.filter((f) => linked.has(f.replace(/\.html$/, '').split('__').pop()))
      : all;
    const delisted = all.length - files.length;
    const lessons = files.map((f) => readLesson(app.key, f, imgMap, indexCats))
      .filter((l) => l.title && l.len > 200);
    const skipped = files.length - lessons.length;
    if (delisted) console.log(`  ${app.key}: ${delisted} listázatlan oldal kihagyva`);

    const groups = buildAppIndex(app, lessons);
    const n = buildLessons(app, lessons, shell);
    total += n;
    console.log(`BN ${app.key}: ${n} lecke, ${groups} modul` +
      (skipped ? `, ${skipped} üres oldal kihagyva` : ''));
  }
  console.log(`BN Tudástár-appok kész: ${total} leckeoldal.`);
}
