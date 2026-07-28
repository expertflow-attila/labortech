// Business Native — tömeggenerátor.
//
// A `bn-src/` mappában lévő eredeti businessnative.hu HTML-fájlokból strukturáltan
// kiolvassa a tartalmat, és a Modulabs dizájn-vázakba injektálja. Így a szövegek
// mindig az igazi forrásból jönnek (nem kézzel másolva), a dizájn pedig a sabloné marad.
//
// Előállított oldalak:
//   /projektek                  <- sajat-projektek.html          (news-insights.html váz)
//   /projektek/<slug>           <- esettanulmany-*.html          (news-insights/<cikk>.html váz)
//   /arak                       <- pricing.html                  (pricing.html váz)
//   /tudastar                   <- tudastar.html                 (careers.html váz)
//   /tudastar/ai-eszkoztar      <- hasznos-oldalak.html          (careers.html váz)
//   /tudastar/claude-skillek    <- claude-skillek-pluginok.html  (careers.html váz)

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { OUT, CAL, txt, tdShell, hasShell, buildToc, TD_CSS, TD_JS } from './shared.mjs';

const SRC = 'bn-src';
const IMGSRC = 'bn-assets';

/* --------------------------------------------------------------------- */
/* Képek átemelése                                                        */
/* --------------------------------------------------------------------- */

const imgMap = {}; // /images/proj-x.jpg -> /assets/bn-proj-x.jpg
function copyImages() {
  if (!existsSync(IMGSRC)) return;
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  for (const f of readdirSync(IMGSRC)) {
    const dest = `bn-${f}`;
    copyFileSync(join(IMGSRC, f), join(OUT, 'assets', dest));
    imgMap[`/images/${f}`] = `/assets/${dest}`;
  }
  console.log(`BN képek: ${Object.keys(imgMap).length} átemelve`);
}
const mapImg = (src) => imgMap[src] || src;

/* --------------------------------------------------------------------- */
/* 1. Projektek kiolvasása                                                */
/* --------------------------------------------------------------------- */

function readProjects() {
  const $ = cheerio.load(readFileSync(join(SRC, 'sajat-projektek.html'), 'utf8'));
  const out = [];
  $('.pj-own').each((_, el) => {
    const $c = $(el);
    const links = $c.find('a').map((i, a) => ({ href: $(a).attr('href'), label: txt($(a).text()) })).get();
    const study = links.find((l) => l.href && l.href.startsWith('/'));
    const live = links.find((l) => l.href && l.href.startsWith('http'));
    if (!study) return;
    const file = study.href.replace(/^\//, '');
    out.push({
      file,
      slug: file.replace(/\.html$/, '').replace(/^esettanulmany-/, ''),
      tag: txt($c.find('.pj-own-tag').text()),
      title: txt($c.find('h3').text()),
      meta: txt($c.find('.pj-own-meta').text()),
      img: mapImg($c.find('img').attr('src')),
      alt: txt($c.find('img').attr('alt')),
      live: live ? live.href : null,
    });
  });
  return out;
}

/* --------------------------------------------------------------------- */
/* 2. Esettanulmány-törzs kiolvasása                                      */
/* --------------------------------------------------------------------- */

function readCaseStudy(file) {
  const p = join(SRC, file);
  if (!existsSync(p)) return null;
  const $ = cheerio.load(readFileSync(p, 'utf8'));
  const blocks = [];
  $('.cs-article').children().each((_, el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'h2') blocks.push({ t: 'h2', v: txt($(el).text()) });
    else if (tag === 'p') {
      // a záró gombsort nem visszük át
      if ($(el).find('a.bnx-btn').length) return;
      const v = txt($(el).text());
      if (v) blocks.push({ t: 'p', v });
    } else if ($(el).hasClass('cs-links')) {
      const pills = $(el).find('a').map((i, a) => ({ href: $(a).attr('href'), label: txt($(a).text()) })).get();
      const plain = txt($(el).find('span').text());
      if (pills.length) blocks.push({ t: 'links', v: pills });
      else if (plain) blocks.push({ t: 'p', v: plain });
    }
  });
  const desc = txt($('meta[name="description"]').attr('content'));
  const hero = mapImg($('.cs-hero-img img').attr('src'));
  return { blocks, desc, hero };
}

/* --------------------------------------------------------------------- */
/* 3. Kártya-kitöltő (a lista- és „további cikkek" kártya azonos)         */
/* --------------------------------------------------------------------- */

function fillCard($, $card, p, hrefBase = '/projektek/') {
  const $a = $card.is('a') ? $card : $card.find('a.link-cms').first();
  $a.attr('href', hrefBase + p.slug);
  const $img = $card.find('img').first();
  if ($img.length && p.img) {
    $img.attr('src', p.img).removeAttr('srcset').removeAttr('sizes')
      .attr('alt', p.alt || p.tag).attr('loading', 'eager');
  }
  // a .master-label szövegét a belső címkére írjuk, különben a narancs pötty is eltűnik
  const $lbl = $card.find('.master-label .label-small').first();
  ($lbl.length ? $lbl : $card.find('.master-label').first()).text(p.tag);
  const $meta = $card.find('.label-small.label-strong');
  if ($meta.length > 1) { $meta.eq(0).remove(); $card.find('.label-small.label-strong').first().text(p.meta); }
  $card.find('.text-h6').first().text(p.title);
  const $body = $card.find('.body-medium').first();
  if ($body.length) $body.text(p.desc || p.meta);
}

/* --------------------------------------------------------------------- */
/* 4. Projektek listaoldal                                                */
/* --------------------------------------------------------------------- */

function buildProjectIndex(projects) {
  const shell = join(OUT, 'news-insights.html');
  if (!existsSync(shell)) return console.log('SKIP: nincs news-insights.html váz');
  const $ = cheerio.load(readFileSync(shell, 'utf8'));

  $('.hero-cms-section').find('h1').first().text('Projektek');
  // a lead nem <p>, hanem .body-medium — a régi szelektor sosem futott le,
  // ezért a sablon blogbevezetője maradt az oldalon
  $('.hero-cms-section').find('p, .body-medium').first()
    .text('Válogatás az ügyfélmunkáimból és saját fejlesztéseimből.');
  // a sablon kiemelt cikke és a további két kártyarácsa idegen tartalom
  $('.cms-large-top-tile').remove();
  $('.cms-listing-section').find('.w-dyn-list').slice(1).remove();

  const $items = $('.cms-listing-section').find('.w-dyn-item');
  const $tpl = $items.first();
  if (!$tpl.length) return console.log('SKIP: nincs kártya-sablon');
  const $list = $tpl.parent();
  const html = $.html($tpl);
  $list.empty();
  for (const p of projects) {
    const $new = cheerio.load(html, null, false).root().children().first();
    fillCard($, $new, p);
    $list.append($new);
  }
  $('title').text('Projektek — Business Native');
  writeFileSync(join(OUT, 'projektek.html'), $.html());
  console.log(`BN projektek.html: ${projects.length} kártya`);
}

/* --------------------------------------------------------------------- */
/* 5. Esettanulmány-oldalak                                               */
/* --------------------------------------------------------------------- */

function buildCaseStudies(projects) {
  const dir = join(OUT, 'news-insights');
  if (!existsSync(dir)) return console.log('SKIP: nincs cikk-váz mappa');
  const shellFile = readdirSync(dir).find((f) => f.endsWith('.html'));
  const shell = readFileSync(join(dir, shellFile), 'utf8');
  mkdirSync(join(OUT, 'projektek'), { recursive: true });

  let n = 0;
  for (const p of projects) {
    const cs = readCaseStudy(p.file);
    if (!cs) { console.log(`  hiányzik: ${p.file}`); continue; }
    const $ = cheerio.load(shell);

    // hero
    $('h1').first().text(p.title);
    $('.left-cms-hero').find('.master-label, .label-small').first().text(p.tag);
    // a sablon dátum-elválasztója („·") és üres dátuma nélkülünk árván maradna
    $('.left-cms-hero').find('.cms-info-tile .label-small.label-strong').remove();
    const $hero = $('.image-wrap-cms-thumbnail').find('img').first();
    if ($hero.length && (cs.hero || p.img)) {
      $hero.attr('src', cs.hero || p.img).removeAttr('srcset').removeAttr('sizes')
        .attr('alt', p.alt || p.tag).attr('loading', 'eager');
    }

    // törzs
    const body = cs.blocks.map((b) => {
      if (b.t === 'h2') return `<h2>${b.v}</h2>`;
      if (b.t === 'p') return `<p>${b.v}</p>`;
      if (b.t === 'links') {
        return '<p>' + b.v.map((l) =>
          `<a href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join(' · ') + '</p>';
      }
      return '';
    }).join('\n');
    // A .button-primary/.button-secondary osztály NINCS a sablon CSS-ében, ezért
    // a Webflow alap kék, szögletes gombja jelent meg a sötét, 8px-es rendszerben.
    const cta = [
      p.live ? `<a class="label-small label-strong bn-card-link" href="${p.live}" `
        + `target="_blank" rel="noopener">Élő oldal megtekintése →</a>` : '',
      `<a class="label-small label-strong bn-card-link" href="/projektek">Vissza a projektekhez →</a>`,
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');

    const $rt = $('.cms-body-left').find('.w-richtext, .rich-text').first();
    const $target = $rt.length ? $rt : $('.cms-body-left').first();
    $target.html(body + `<p style="margin-top:2rem">${cta}</p>`);

    buildToc($, $target);

    // további esettanulmányok — 3 másik projekt
    const others = projects.filter((x) => x.slug !== p.slug);
    const picks = [0, 1, 2].map((i) => others[(projects.indexOf(p) + i + 1) % others.length]);
    const $more = $('.cms-more-articles').find('.w-dyn-item');
    $more.each((i, el) => {
      if (i < picks.length && picks[i]) fillCard($, $(el), picks[i]);
      else $(el).remove();
    });

    $('title').text(`${p.meta.split('·')[0].trim()} — Business Native`);
    $('meta[name="description"], meta[property="og:description"]').attr('content', cs.desc);
    $('meta[property="og:title"]').attr('content', p.title);

    writeFileSync(join(OUT, 'projektek', `${p.slug}.html`), $.html());
    n++;
  }
  console.log(`BN esettanulmányok: ${n} oldal`);
}

/* --------------------------------------------------------------------- */
/* 6. Árak oldal                                                          */
/* --------------------------------------------------------------------- */

function readPricing() {
  const $ = cheerio.load(readFileSync(join(SRC, 'pricing.html'), 'utf8'));
  const plans = $('.plan').map((_, el) => {
    const $p = $(el);
    const $info = $p.find('.plan_info-tile').first();
    const unit = txt($info.find('.tone-subtle').text());
    const $cta = $p.find('a').first();
    return {
      name: txt($p.find('h2').first().text()),
      lead: txt($p.find('.tone-subtle').eq(0).text()),
      forWhom: txt($p.find('.tone-subtle').eq(1).text()),
      items: $p.find('.plan_item').map((i, x) => txt($(x).text())).get().filter(Boolean),
      // az ár és a mellette álló feltétel külön mezőben („400 000 Ft" + „· egyedi ár")
      price: txt($info.text()).replace(unit, '').trim(),
      unit,
      cta: txt($cta.find('.text-button').text()) || txt($cta.text()),
      href: $cta.attr('href'),
    };
  }).get();

  const faq = $('.expandable-single').map((_, el) => ({
    q: txt($(el).find('.expandable-top').text()),
    a: txt($(el).find('.faq-paragraph').text()),
  })).get().filter((f) => f.q && f.a);

  const promises = [];
  const seen = new Set();
  $('.card_testimonial-small').each((_, el) => {
    const label = txt($(el).find('.label-small').first().text());
    const quote = txt($(el).find('.text-size-large').first().text());
    if (!label || seen.has(label)) return;
    seen.add(label);
    promises.push({ label, quote });
  });

  return {
    plans, faq, promises,
    h1: txt($('h1').first().text()),
    promiseTitle: txt($('.section_testimonials').find('h2, [class*="heading"]').first().text()),
    faqTitle: txt($('.section_faq-halves').find('h2, [class*="heading"]').first().text()),
    divider: txt($('.wrap_divider-label').first().text()),
  };
}

function buildPricing() {
  const shell = join(OUT, 'pricing.html');
  if (!existsSync(shell)) return console.log('SKIP: nincs pricing váz');
  const { plans, faq, promises, h1, promiseTitle, faqTitle, divider } = readPricing();
  const $ = cheerio.load(readFileSync(shell, 'utf8'));

  $('.hero-pricing-section').find('h1').first().text(h1 || 'Egyéni programcsomagok');

  // csomagkártyák — a sablon háromból kettő marad
  const $cards = $('.card-plan');
  $cards.each((i, el) => {
    const plan = plans[i];
    const $c = $(el);
    if (!plan) { $c.remove(); return; }
    $c.removeAttr('id');
    $c.find('[id]').removeAttr('id');   // a belső árelem is duplikált id-t vitt
    $c.find('.plan-top-tile .text-body-bold').first().text(plan.name);
    $c.find('.plan-tag .label-small').first().text(i === 0 ? 'Projekt' : 'Folyamatos');
    $c.find('.price-wrap .text-h3').first().text(plan.price);
    $c.find('.price-wrap .body-medium').first().text(plan.unit);
    // a forrás két kérdésre bontja a csomag leírását — a címkéket megtartjuk
    $c.find('.plan-price-tile').children().last()
      .html(`<div class="label-small">Miben segít?</div>${plan.lead}`);

    const $cta = $c.find('a.cta-main').first();
    $cta.attr('href', plan.href).removeAttr('aria-current').removeClass('w--current')
      .attr('target', '_blank').attr('rel', 'noopener');
    $cta.find('.button-text').first().text(plan.cta);

    $c.find('.plan-bottom-tile .label-large').first().text('Tartalmazza');
    const $list = $c.find('ul.plan-list');
    const $li = $list.children().first();
    const liHtml = $.html($li);
    $list.empty();
    for (const item of plan.items) {
      const $new = cheerio.load(liHtml, null, false).root().children().first();
      $new.children().last().text(item);
      $list.append($new);
    }
    // a kártya záró sora a forrás „Kinek javaslom?" válasza
    $c.children().last().html(`<div class="label-small">Kinek javaslom?</div>${plan.forWhom}`);
  });

  // a csomagok alatti „nincs rejtett költség" felirat
  if (divider) {
    $('.pricing-thirds').after(
      `<div class="body-medium" style="margin-top:var(--spacing--32);text-align:center">${divider}</div>`);
  }

  // „Ezt vállalom minden együttműködésben" — a sablon árazó oldalán nincs ilyen
  // szekció, ezért a kapcsolat-kártyák rácsából építjük meg.
  if (promises.length) {
    const cards = promises.map((p) =>
      `<div class="card-contact bn-reveal"><div class="text-wrap-contact-card">`
      + `<div class="text-large text-body-bold">${p.label}</div>`
      + `<div class="body-medium">${p.quote}</div></div></div>`).join('');
    $('.faq-section').before(
      `<section class="section"><div class="w-layout-blockcontainer main-container w-container">`
      + `<div class="headline-positions"><h2 class="no-margins">${promiseTitle}</h2></div>`
      + `<div class="w-layout-grid contact-grid bn-tools" style="margin-top:2rem">${cards}</div>`
      + `</div></section>`);
  }

  // GYIK — a sablonban `.expandable-single`, NEM `.faq-item`/`.accordion`
  const $faqItems = $('.faq-section').find('.expandable-single');
  $faqItems.each((i, el) => {
    if (i >= faq.length) { $(el).remove(); return; }
    $(el).find('.expandable-top .text-body-bold').first().text(faq[i].q);
    $(el).find('.faq-paragraph').first().text(faq[i].a);
  });
  // a sablon GYIK-címe nem h2, hanem `.text-h3`
  const $faqHead = $('.faq-section').find('h1, h2, .text-h3').first();
  if ($faqHead.length && faqTitle) $faqHead.text(faqTitle);

  $('a[href]').each((_, a) => {
    const h = $(a).attr('href') || '';
    if (h.includes('byq.supply') || h.includes('webflow')) $(a).attr('href', CAL);
  });

  $('title').text('Árak — Business Native');
  $('head').append(TD_CSS);
  writeFileSync(join(OUT, 'arak.html'), $.html());
  console.log(`BN arak.html: ${plans.length} csomag, ${promises.length} vállalás, ${faq.length} GYIK`);
}

/* --------------------------------------------------------------------- */
/* 7. Tudástár — hub, AI eszköztár, Claude skill-ek                       */
/* --------------------------------------------------------------------- */

// A V2-ben a Tudástár minden anyaga belső oldal: az 5 külső app tartalma is
// ide került (generate-apps.mjs), ezért a hub kártyái befelé mutatnak.
const TD_URL = {
  '/hasznos-oldalak.html': '/tudastar/ai-eszkoztar',
  '/claude-skillek-pluginok.html': '/tudastar/claude-skillek',
  'https://esettanulmanyok-bn.vercel.app/': '/tudastar/landolo-oldalak',
  'https://copywriting-bn.vercel.app/': '/tudastar/copywriting',
  'https://meek-mooncake-31c92f.netlify.app/': '/tudastar/online-jelenlet',
  'https://kurzusepites-alapok.vercel.app/': '/tudastar/kurzusepites',
  'https://minikurzus-alapok.vercel.app/': '/tudastar/minikurzus',
};

// A Funnelek app a főoldal Tudástár-menüjéből még hiányzik, de él és a Tudástár
// része. A leírás az app saját meta description-jéből jön, nem kézzel írva.
function readExtra() {
  const p = join('app-src', 'funnelek', 'index.html');
  const desc = existsSync(p)
    ? txt(cheerio.load(readFileSync(p, 'utf8'))('meta[name="description"]').attr('content'))
    : '';
  return desc ? [{ title: 'Funnelek', desc, href: '/tudastar/funnelek', external: false }] : [];
}

// Kártya-címkék. Csak ellenőrizhető adat kerül rájuk (elemszám a forrásból,
// illetve hogy külső appot nyit-e meg vagy ezen az oldalon marad).
const TD_TAGS = {
  'Landing oldal elemzések': 'Elemzések',
  'Értékesítési szöveg sablonok': 'Sablonok',
  'Online jelenlét alapok': 'Alapok',
  'AI eszköztár': 'Eszközök',
  'Kurzusépítés alapok': 'Kurzus',
  Minikurzus: 'Kurzus',
  Funnelek: 'Funnelek',
  'Claude skill-ek és plugin-ok': 'Skillek',
};

function readTudastar() {
  const $ = cheerio.load(readFileSync(join(SRC, 'tudastar.html'), 'utf8'));
  const items = [];
  $('.td-row').each((_, el) => {
    const $c = $(el).find('.td-row-copy');
    const href = $c.find('.td-row-link').attr('href') || '';
    items.push({
      title: txt($c.find('h2').first().text()),
      desc: txt($c.find('p').first().text()),
      href: TD_URL[href] || href,
      external: href.startsWith('http'),
    });
  });
  // A hub 5 sora nem fedi le a menü mind a 7 elemét — a hiányzókat
  // (Minikurzus, Claude skill-ek) a legördülő menüből egészítjük ki.
  // A menüben más a felirat, ezért cél-URL alapján egyeztetünk.
  const known = new Set(items.map((i) => i.href));
  $('.bnx-item .bnx-drop-link').each((_, a) => {
    const raw = $(a).attr('href') || '';
    const href = TD_URL[raw] || raw;
    if (known.has(href)) return;
    known.add(href);
    items.push({
      title: txt($(a).find('span').first().text()),
      desc: txt($(a).find('.bnx-drop-sub').text()),
      href,
      external: raw.startsWith('http'),
    });
  });
  for (const e of readExtra()) if (!known.has(e.href)) items.push(e);
  return { lead: txt($('.td-lead').first().text()), items };
}

function readTools() {
  const $ = cheerio.load(readFileSync(join(SRC, 'hasznos-oldalak.html'), 'utf8'));
  const cats = $('.ho-tab').map((_, el) => ({
    key: $(el).attr('data-cat'),
    label: txt($(el).text()),
  })).get();
  const tools = $('.ho-card').map((_, el) => ({
    cat: $(el).attr('data-cat'),
    name: txt($(el).find('h3').first().text()),
    desc: txt($(el).find('p').first().text()),
    href: $(el).find('a').first().attr('href'),
  })).get();
  return {
    cats,
    tools,
    title: txt($('.ho-head h1').first().text()),
    lead: txt($('.ho-head .bnx-lead').first().text()),
  };
}


function buildTudastarHub() {
  const shellFile = join(OUT, 'careers.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs careers.html váz');
  const { lead, items } = readTudastar();
  const $ = tdShell('Tudástár', lead);

  $('.hero-careers-section').find('.button-text-mask').text('Anyagok megtekintése');
  $('.hero-careers-section').find('a.cta-main').attr('href', '#anyagok');
  $('.careers-positions-section').attr('id', 'anyagok');
  $('.headline-positions').find('h2').first().text('Anyagok a Tudástárban');

  const $tpl = $('.career-item').first();
  if (!$tpl.length) return console.log('SKIP: nincs kártya-sablon a careers vázban');
  const $list = $tpl.parent();
  const html = $.html($tpl);
  $list.empty();

  for (const it of items) {
    const $c = cheerio.load(html, null, false).root().children().first();
    const $a = $c.find('a.card-job');
    $a.removeAttr('id').attr('href', it.href).addClass('is-static');
    $c.addClass('bn-reveal');
    if (it.external) $a.attr('target', '_blank').attr('rel', 'noopener');
    else $a.removeAttr('target').removeAttr('rel');

    $c.find('.job-card-top-tile .text-small').first().text(TD_TAGS[it.title] || 'Tudástár');
    $c.find('.job-card-top-tile .label-small').last()
      .text(it.external ? 'Új lapon nyílik' : 'Ezen az oldalon');

    const $tags = $c.find('.job-card-info-tags');
    $tags.children().slice(1).remove();
    $tags.find('.label-small').first().text(it.external ? 'Külső anyag' : 'Belső oldal');

    $c.find('.text-h5').first().text(it.title);
    // A sablon hover-flip hátlapja helyett a leírás elöl látszik — mobilon
    // nincs hover, és a leírás a hub legfontosabb információja.
    $c.find('.job-back-view').remove();
    $c.find('.job-info-tile').append(`<div class="body-medium">${it.desc}</div>`);
    $list.append($c);
  }

  const $tile = $('.positions-bottom-tile');
  $tile.find('.text-body-bold').first().text('Új anyag kerül be rendszeresen');
  $tile.find('.text-small').first()
    .text('Ha valamelyik témában konkrét kérdésed van, beszéljük át.');
  $tile.find('.button-text-mask').text('Beszéljünk');
  $tile.find('a').attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');

  $('title').text('Tudástár — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', lead);
  $('meta[property="og:title"]').attr('content', 'Tudástár — Business Native');
  $('head').append(TD_CSS);

  writeFileSync(join(OUT, 'tudastar.html'), $.html());
  console.log(`BN tudastar.html: ${items.length} kártya`);
}

function buildToolbox() {
  if (!existsSync(join(OUT, 'careers.html'))) return;
  const { cats, tools, title, lead } = readTools();
  const $ = tdShell(title, lead);

  $('.hero-careers-section').find('.button-text-mask').text('Eszközök megtekintése');
  $('.hero-careers-section').find('a.cta-main').attr('href', '#eszkozok');
  $('.careers-positions-section').attr('id', 'eszkozok');
  $('.headline-positions').find('h2').first().text('Eszközök kategóriánként');

  // fülsor
  const tabs = cats.map((c, i) =>
    `<button type="button" class="bn-tab label-small${i === 0 ? ' is-active' : ''}" ` +
    `data-cat="${c.key}">${c.label}</button>`).join('');

  // kártyák — a sablon .card-contact eleme, ikon nélkül
  const cards = tools.map((t) => {
    const hidden = t.cat === cats[0].key ? '' : ' bn-hidden';
    const mid = ''; // az oszlopkeretet a nth-child szabály adja
    return `<div class="card-contact bn-reveal${mid}${hidden}" data-cat="${t.cat}">` +
      `<div class="text-wrap-contact-card">` +
      `<div class="text-large text-body-bold">${t.name}</div>` +
      `<div class="body-medium">${t.desc}</div></div>` +
      (t.href ? `<a class="label-small label-strong bn-card-link" href="${t.href}" ` +
        `target="_blank" rel="noopener">Tovább →</a>` : '') +
      `</div>`;
  }).join('');

  const $list = $('.careers.w-dyn-list');
  $list.replaceWith(
    `<div class="bn-tabs">${tabs}</div>` +
    `<div class="w-layout-grid contact-grid bn-tools bn-filtered">${cards}</div>`);

  const $tile = $('.positions-bottom-tile');
  $tile.find('.text-body-bold').first().text('Nem tudod, melyik kell neked?');
  $tile.find('.text-small').first()
    .text('Mondd el, mit szeretnél megoldani, és megmondom, mivel érdemes kezdeni.');
  $tile.find('.button-text-mask').text('Beszéljünk');
  $tile.find('a').attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');

  $('title').text('AI eszköztár — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', lead);
  $('meta[property="og:title"]').attr('content', 'AI eszköztár — Business Native');
  $('head').append(TD_CSS);
  $('body').append(TD_JS);

  mkdirSync(join(OUT, 'tudastar'), { recursive: true });
  writeFileSync(join(OUT, 'tudastar', 'ai-eszkoztar.html'), $.html());
  console.log(`BN ai-eszkoztar.html: ${tools.length} eszköz, ${cats.length} kategória`);
}

function buildSkillsPlaceholder() {
  const src = join(SRC, 'claude-skillek-pluginok.html');
  if (!existsSync(src) || !existsSync(join(OUT, 'careers.html'))) return;
  const $s = cheerio.load(readFileSync(src, 'utf8'));
  const h1 = txt($s('h1').first().text());
  const lead = txt($s('.bnx-lead').first().text());

  const $ = tdShell(h1, lead);
  $('.careers-positions-section').remove();
  $('.hero-careers-section').find('.button-text-mask').text('Vissza a Tudástárba');
  $('.hero-careers-section').find('a.cta-main')
    .attr('href', '/tudastar').removeAttr('target').removeAttr('rel');
  $('.heading-cta').first().text('Ez az oldal még fejlesztés alatt áll');

  $('title').text('Claude skill-ek és plugin-ok — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', lead);
  $('meta[property="og:title"]').attr('content', h1);
  $('head').append(TD_CSS);

  mkdirSync(join(OUT, 'tudastar'), { recursive: true });
  writeFileSync(join(OUT, 'tudastar', 'claude-skillek.html'), $.html());
  console.log('BN claude-skillek.html: fejlesztés alatt oldal');
}

/* --------------------------------------------------------------------- */

copyImages();
const projects = readProjects();
console.log(`BN projektek beolvasva: ${projects.length}`);
buildProjectIndex(projects);
buildCaseStudies(projects);
buildPricing();
buildTudastarHub();
buildToolbox();
buildSkillsPlaceholder();
console.log('BN generálás kész.');
