// Business Native — a Tudástár külső alkalmazásainak letükrözése.
//
// Mind a 6 app statikus HTML, ezért elég egy azonos-origin BFS bejárás: a
// nyers oldalakat `app-src/<app>/<slug>.html` alá menti, a képeket pedig
// `app-assets/<app>/` alá. A generálás ebből dolgozik (generate-apps.mjs),
// így az újrafuttatás nem terheli feleslegesen az appokat.

import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

export const APPS = [
  { key: 'copywriting', name: 'Értékesítési szöveg sablonok', base: 'https://copywriting-bn.vercel.app/' },
  { key: 'landolo-oldalak', name: 'Landing oldal elemzések', base: 'https://esettanulmanyok-bn.vercel.app/' },
  { key: 'online-jelenlet', name: 'Online jelenlét alapok', base: 'https://meek-mooncake-31c92f.netlify.app/' },
  { key: 'kurzusepites', name: 'Kurzusépítés alapok', base: 'https://kurzusepites-alapok.vercel.app/' },
  { key: 'minikurzus', name: 'Minikurzus alapok', base: 'https://minikurzus-alapok.vercel.app/' },
  { key: 'funnelek', name: 'Funnelek', base: 'https://funnelek-bn.vercel.app/' },
];

const SRC = 'app-src';
const ASSETS = 'app-assets';
const MAX = 300;

const slugOf = (path) => {
  const s = path.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  return s === '' ? 'index' : s.replace(/\//g, '__');
};

async function crawlApp(app) {
  const origin = new URL(app.base).origin;
  const dir = join(SRC, app.key);
  mkdirSync(dir, { recursive: true });

  const seen = new Set(['/']);
  const queue = ['/'];
  const images = new Set();
  let saved = 0;

  while (queue.length && saved < MAX) {
    const path = queue.shift();
    let html;
    try {
      const res = await fetch(origin + path, { redirect: 'follow' });
      if (!res.ok) { console.log(`  ${res.status} ${path}`); continue; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) continue;
      html = await res.text();
    } catch (e) {
      console.log(`  HIBA ${path}: ${e.message}`);
      continue;
    }
    writeFileSync(join(dir, `${slugOf(path)}.html`), html);
    saved++;

    const $ = cheerio.load(html);
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:')) images.add(new URL(src, origin + path).href);
    });
    $('a[href]').each((_, el) => {
      const raw = $(el).attr('href') || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      let u;
      try { u = new URL(raw, origin + path); } catch { return; }
      if (u.origin !== origin) return;
      const p = u.pathname;
      if (/\.(png|jpe?g|webp|avif|svg|pdf|zip|css|js|xml|txt|ico)$/i.test(p)) return;
      if (seen.has(p)) return;
      seen.add(p);
      queue.push(p);
    });
  }

  // képek
  const adir = join(ASSETS, app.key);
  mkdirSync(adir, { recursive: true });
  let imgN = 0;
  for (const url of images) {
    const name = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '').replace(/\//g, '_');
    if (existsSync(join(adir, name))) { imgN++; continue; }
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      writeFileSync(join(adir, name), Buffer.from(await r.arrayBuffer()));
      imgN++;
    } catch { /* kihagyjuk */ }
  }

  console.log(`${app.key}: ${saved} oldal, ${imgN} kép`);
  return saved;
}

if (process.argv[1].endsWith('crawl-apps.mjs')) {
  const only = process.argv[2];
  let total = 0;
  for (const app of APPS) {
    if (only && app.key !== only) continue;
    if (!only && existsSync(join(SRC, app.key)) &&
        readdirSync(join(SRC, app.key)).length) {
      console.log(`${app.key}: már letükrözve, kihagyva (törölj app-src/${app.key}-t az újrahúzáshoz)`);
      continue;
    }
    total += await crawlApp(app);
  }
  console.log(`Tudástár appok letükrözve: ${total} új oldal.`);
}
