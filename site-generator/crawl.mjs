// Modulabs HU site generator.
// Runs in the Vercel build environment: crawls the live template site,
// mirrors all same-site assets locally, and applies the Hungarian
// translation dictionary to every text node and text attribute.
// Output: ./public (static site) + ./public/_report/strings.json (coverage report).

import * as cheerio from 'cheerio';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const BASE = 'https://modulabs-template.webflow.io';
const OUT = 'public';
const MAX_PAGES = 60;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const norm = (s) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dictRaw = JSON.parse(readFileSync(new URL('./dictionary.json', import.meta.url), 'utf8'));
const dict = new Map(Object.entries(dictRaw).map(([k, v]) => [norm(k), v]));

async function get(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'en' },
        signal: ctl.signal,
        redirect: 'follow',
      });
      clearTimeout(t);
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

// ---------- 1. Crawl pages (BFS over internal links) ----------
const queue = ['/', '/404', '/401'];
const seen = new Set(queue);
const pages = new Map(); // path -> raw html
const pageFailures = [];

function cleanPath(href) {
  if (!href) return null;
  let h = href.trim();
  if (h.startsWith(BASE)) h = h.slice(BASE.length) || '/';
  if (!h.startsWith('/')) return null; // external, mailto:, tel:, #…
  if (h.startsWith('//')) return null;
  h = h.split('#')[0].split('?')[0];
  if (h === '') h = '/';
  if (/\.(css|js|png|jpe?g|webp|svg|gif|ico|pdf|txt|xml|woff2?)$/i.test(h)) return null;
  return h;
}

while (queue.length && pages.size < MAX_PAGES) {
  const path = queue.shift();
  try {
    const res = await get(BASE + path);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) continue;
    const html = await res.text();
    pages.set(path, html);
    console.log(`page ${res.status} ${path} (${html.length}b)`);
    const $ = cheerio.load(html);
    $('a[href]').each((_, a) => {
      const p = cleanPath($(a).attr('href'));
      if (p && !seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    });
  } catch (e) {
    pageFailures.push({ path, error: String(e) });
    console.log(`page FAIL ${path}: ${e}`);
  }
}

// ---------- 2. Collect + download assets ----------
const ASSET_RE = /https:\/\/[a-z0-9.-]*website-files\.com\/[^\s"'<>()\\]+/g;

// A regex can swallow comma-joined source lists and trailing HTML entities
// (e.g. "a.mp4,b.webm" or "poster.jpg&quot;") — split those into real URLs.
function expandAssetMatch(m) {
  return m
    .split('&quot')[0]
    .split(',')
    .filter((u) => u.startsWith('https://'));
}

const assetUrls = new Set();
for (const html of pages.values()) {
  for (const m of html.matchAll(ASSET_RE)) {
    for (const u of expandAssetMatch(m[0])) assetUrls.add(u);
  }
}

const urlToLocal = new Map(); // absolute url -> /assets/name
const assetFailures = [];
const cssTexts = new Map(); // local name -> css text (rewritten later)

function localName(url) {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8);
  let base = decodeURIComponent(url.split('/').pop() || 'asset').replace(/[^A-Za-z0-9._-]/g, '_');
  if (base.length > 60) base = base.slice(-60);
  return `${hash}-${base}`;
}

mkdirSync(join(OUT, 'assets'), { recursive: true });

async function downloadAsset(url) {
  if (urlToLocal.has(url)) return;
  const name = localName(url);
  urlToLocal.set(url, `/assets/${name}`);
  try {
    const res = await get(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const isCss = /\.css(\?|$)/i.test(url) || (res.headers.get('content-type') || '').includes('text/css');
    if (isCss) {
      const text = await res.text();
      cssTexts.set(name, { text, url });
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(OUT, 'assets', name), buf);
    }
  } catch (e) {
    urlToLocal.delete(url);
    assetFailures.push({ url, error: String(e) });
    console.log(`asset FAIL ${url}: ${e}`);
  }
}

for (const url of assetUrls) await downloadAsset(url);

// Second wave: assets referenced from inside CSS (fonts, background images).
const cssRefRe = /url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g;
const secondWave = new Set();
for (const { text, url } of cssTexts.values()) {
  for (const m of text.matchAll(cssRefRe)) {
    try {
      const abs = new URL(m[2], url).href;
      if (/website-files\.com/.test(abs) && !urlToLocal.has(abs)) secondWave.add(abs);
    } catch {}
  }
  for (const m of text.matchAll(ASSET_RE)) {
    if (!urlToLocal.has(m[0])) secondWave.add(m[0]);
  }
}
for (const url of secondWave) await downloadAsset(url);

// Rewrite CSS contents to local asset paths and write them out.
for (const [name, { text, url }] of cssTexts.entries()) {
  let out = text;
  for (const [abs, local] of urlToLocal.entries()) {
    out = out.split(abs).join(local);
  }
  out = out.replace(cssRefRe, (full, q, ref) => {
    try {
      const abs = new URL(ref, url).href;
      const local = urlToLocal.get(abs);
      return local ? `url(${q}${local}${q})` : full;
    } catch {
      return full;
    }
  });
  writeFileSync(join(OUT, 'assets', name), out);
}

// ---------- 3. Translate + rewrite pages ----------
const missing = new Map(); // normalized text -> first page seen
let hits = 0;

const ATTR_TARGETS = ['alt', 'placeholder', 'aria-label', 'data-wait'];

function translateHtml(html, pagePath) {
  const $ = cheerio.load(html);
  $('html').attr('lang', 'hu');

  // A lokálisra átírt (és a bennük lévő URL-csere miatt módosult) fájlokra a
  // Webflow-tól örökölt SRI-hash már nem stimmel, ezért a böngésző eldobná a
  // stíluslapot — az integrity/crossorigin attribútumokat el kell távolítani.
  $('link[integrity], script[integrity]').each((_, el) => {
    $(el).removeAttr('integrity');
    $(el).removeAttr('crossorigin');
  });

  $('*').each((_, el) => {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;

    // text nodes
    $(el)
      .contents()
      .each((_, node) => {
        if (node.type !== 'text') return;
        const raw = node.data;
        const key = norm(raw);
        if (!key || !/[A-Za-z]/.test(key)) return;
        if (dict.has(key)) {
          const lead = raw.match(/^\s*/)[0];
          const trail = raw.match(/\s*$/)[0];
          node.data = lead + dict.get(key) + trail;
          hits++;
        } else if (!missing.has(key)) {
          missing.set(key, pagePath);
        }
      });

    // attributes
    for (const attr of ATTR_TARGETS) {
      const v = $(el).attr(attr);
      if (v === undefined) continue;
      const key = norm(v);
      if (!key || !/[A-Za-z]/.test(key)) continue;
      if (dict.has(key)) {
        $(el).attr(attr, dict.get(key));
        hits++;
      } else if (!missing.has(key)) {
        missing.set(key, `${pagePath} [@${attr}]`);
      }
    }
  });

  // submit button labels
  $('input[type="submit"]').each((_, el) => {
    const v = $(el).attr('value');
    if (!v) return;
    const key = norm(v);
    if (dict.has(key)) {
      $(el).attr('value', dict.get(key));
      hits++;
    } else if (key && /[A-Za-z]/.test(key) && !missing.has(key)) {
      missing.set(key, `${pagePath} [@value]`);
    }
  });

  // meta tags
  $(
    'meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]'
  ).each((_, el) => {
    const v = $(el).attr('content');
    if (!v) return;
    const key = norm(v);
    if (dict.has(key)) {
      $(el).attr('content', dict.get(key));
      hits++;
    } else if (key && /[A-Za-z]/.test(key) && !missing.has(key)) {
      missing.set(key, `${pagePath} [@meta]`);
    }
  });

  return $.html();
}

function outFile(path) {
  if (path === '/') return 'index.html';
  let p = path.replace(/^\//, '').replace(/\/$/, '');
  if (!/\.[a-z0-9]+$/i.test(p)) p += '.html';
  return p;
}

for (const [path, html] of pages.entries()) {
  let out = translateHtml(html, path);
  for (const [abs, local] of urlToLocal.entries()) {
    out = out.split(abs).join(local);
  }
  const file = join(OUT, outFile(path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out);
}

// ---------- 4. Report ----------
mkdirSync(join(OUT, '_report'), { recursive: true });
const report = {
  generatedFrom: BASE,
  pages: [...pages.keys()],
  pageFailures,
  assets: { downloaded: urlToLocal.size, failed: assetFailures },
  translation: {
    dictionaryEntries: dict.size,
    hits,
    missingCount: missing.size,
    missing: [...missing.entries()].map(([text, where]) => ({ text, where })),
  },
};
writeFileSync(join(OUT, '_report', 'strings.json'), JSON.stringify(report, null, 2));

// ---------- 5. Self-diagnostics for the build log ----------
// The deployed pages cannot be fetched from the dev container (SSO), so the
// build prints everything needed to debug styling/asset issues.
try {
  const idx = readFileSync(join(OUT, 'index.html'), 'utf8');
  console.log('HEAD_SNIPPET_BEGIN');
  console.log(idx.slice(0, 3000));
  console.log('HEAD_SNIPPET_END');
} catch (e) {
  console.log('HEAD_SNIPPET_FAIL ' + e);
}
for (const [name] of cssTexts.entries()) {
  const p = join(OUT, 'assets', name);
  console.log(`CSS_FILE ${name} ${existsSync(p) ? statSync(p).size + 'b' : 'MISSING'}`);
}
// Verify that every local stylesheet/script reference in the built pages exists.
const refRe = /(?:href|src)="(\/assets\/[^"]+)"/g;
const badRefs = new Set();
for (const path of pages.keys()) {
  const f = join(OUT, outFile(path));
  if (!existsSync(f)) continue;
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(refRe)) {
    const local = decodeURIComponent(m[1]);
    if (!existsSync(join(OUT, local))) badRefs.add(`${path} -> ${m[1]}`);
  }
}
for (const r of badRefs) console.log('BROKEN_REF ' + r);
console.log(`REF_CHECK done, ${badRefs.size} broken local refs`);

// Preview deployments sit behind Vercel SSO, so the report is also emitted
// into the build log where it can always be read.
console.log('MISSING_BEGIN');
for (const [text, where] of missing.entries()) {
  console.log('MISS ' + JSON.stringify({ t: text, w: where }));
}
console.log('MISSING_END');

console.log(
  `DONE: ${pages.size} pages, ${urlToLocal.size} assets (${assetFailures.length} failed), ` +
    `${hits} translation hits, ${missing.size} missing strings`
);
