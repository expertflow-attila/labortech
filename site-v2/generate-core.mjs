// Business Native — a fő oldalak újraépítése a valódi forrásból.
//
// A korábbi változat kézzel írt szótárból dolgozott, és a forrás szekcióinak
// nagy része kimaradt (Szolgáltatás 4/22, Rólam 1/14, Kapcsolat 0/3). Itt a
// tartalom programozottan jön a `bn-src/`-ből, ugyanúgy, ahogy a Tudástárnál.
//
// A sablonvázak fix számú slotot kínálnak, a BN-oldalak viszont több
// szekcióból állnak, ezért a hero és a záró CTA a sablonból marad, a köztes
// szekciókat pedig a sablon saját komponenseiből (kártyarács, idővonal,
// lenyíló GYIK) építjük össze.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, txt, TD_CSS } from './shared.mjs';
import { stackRow, syncSplit, usecaseGrid, numberBand, duoCards } from './sections.mjs';

const SRC = 'bn-src';
const QUIZ = 'https://expertflow-quiz.vercel.app/';

// a forrás .html végű útvonalai a V2 tiszta URL-jeire mutatnak
const URLMAP = {
  '/pricing': '/arak', '/sajat-projektek': '/projektek', '/szolgaltatas': '/szolgaltatas',
  '/rolam': '/rolam', '/tudastar': '/tudastar', '/gyik': '/gyik', '/index': '/',
  '/contact/contact-a': '/kapcsolat', '/hasznos-oldalak': '/tudastar/ai-eszkoztar',
};
export function mapHref(h) {
  if (!h) return h;
  if (h.startsWith('http') || h.startsWith('mailto:') || h.startsWith('#')) return h;
  let p = h.replace(/\.html$/, '').split(/[?#]/)[0];
  if (p.startsWith('/esettanulmany-')) return '/projektek/' + p.replace('/esettanulmany-', '');
  return URLMAP[p] || p;
}

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A forrás címeiben <br> tördel; .text()-tel a két sor összeragadna
// („Bizalom, jelenlét,felelősségvállalás"). A törést megtartjuk.
const headingHtml = ($, $el) => ($el.html() || '')
  .replace(/<br\s*\/?>/gi, '\u0001').replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ').trim().split('\u0001')
  .map((x) => esc(x.trim())).filter(Boolean).join('<br>');

/* --------------------------------------------------------------------- */
/* Újrahasznosítható szekció-blokkok, a sablon saját osztályaival         */
/* --------------------------------------------------------------------- */

const section = (inner) =>
  `<section class="section bn-reveal"><div class="w-layout-blockcontainer main-container w-container">${inner}</div></section>`;

// A .master-label önmagában `justify-content:center` — burkoló nélkül középre
// csúszik a balra igazított cím fölött, és 0px térköz marad köztük. A sablon
// `headline-legal` burkolója pont a kellő flex-column + 24px gap + balra igazítás.
const headline = (eyebrow, title, lead) => {
  if (!eyebrow && !title && !lead) return '';
  return `<div class="headline-legal" style="max-width:var(--max-width--8-columns)">`
    + (eyebrow ? `<div class="master-label"><div class="circle-label"></div>`
      + `<div class="label-small">${esc(eyebrow)}</div></div>` : '')
    + (title ? `<h2 class="no-margins">${esc(title)}</h2>` : '')
    + (lead ? `<div class="body-medium" style="max-width:var(--max-width--7-columns)">${esc(lead)}</div>` : '')
    + `</div>`;
};

// cím + leírás kártyák rácsban (fájdalompontok, területek, csomagok, példák)
// Az oszlopszám az elemszámhoz igazodik: 2 és 4 elemnél 2 oszlop, különben 3 —
// így nem marad sötét, üres cella a keretezett panel utolsó sorában.
const gridCols = (n) => (n === 2 || n === 4 ? 2 : 3);
const cardGrid = (items, hasHead = true) =>
  `<div class="w-layout-grid contact-grid bn-tools bn-cols-${gridCols(items.length)}"`
  + (hasHead ? ` style="margin-top:var(--spacing--48)"` : '') + `>`
  + items.map((it) =>
    `<div class="card-contact bn-reveal">`
    + (it.img ? `<img src="${it.img}" alt="${esc(it.title)}" loading="lazy" `
      + `style="width:100%;border-radius:8px;margin-bottom:1rem">` : '')
    + `<div class="text-wrap-contact-card">`
    + `<div class="text-large text-body-bold">${esc(it.title)}</div>`
    + (it.label ? `<div class="label-small">${esc(it.label)}</div>` : '')
    + (it.desc ? `<div class="body-medium">${esc(it.desc)}</div>` : '')
    + (it.items && it.items.length ? `<ul role="list" class="plan-list w-list-unstyled">`
      + it.items.map((x) => `<li class="plan-list-item"><div>${esc(x)}</div></li>`).join('')
      + `</ul>` : '')
    + `</div>`
    + (it.links || []).map((l) =>
      `<a class="label-small label-strong bn-card-link" href="${mapHref(l.href)}"`
      + `${l.href && l.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>`
      + `${esc(l.label)} →</a>`).join(' ')
    + `</div>`).join('')
  + `</div>`;

// egyszerű felsorolás (a projekt végén ez van a kezedben)
const bulletList = (items) =>
  `<ul role="list" class="plan-list w-list-unstyled"`
  + ` style="margin-top:var(--spacing--48);max-width:var(--max-width--8-columns)">`
  + items.map((x) => `<li class="plan-list-item"><div>${esc(x)}</div></li>`).join('')
  + `</ul>`;

// lenyíló GYIK a sablon `.expandable-single` komponenséből
function faqBlock(shell$, faq) {
  const $tpl = shell$('.expandable-single').first();
  if (!$tpl.length || !faq.length) return '';
  const tplHtml = shell$.html($tpl);
  return `<div class="tabs-faq" style="margin-top:var(--spacing--48)">` + faq.map((f) => {
    const $i = cheerio.load(tplHtml, null, false).root().children().first();
    $i.find('.text-body-bold').first().text(f.q);
    $i.find('.faq-paragraph').first().text(f.a);
    return cheerio.load('<x></x>', null, false).html($i);
  }).join('') + `</div>`;
}

/* --------------------------------------------------------------------- */
/* Szolgáltatás                                                           */
/* --------------------------------------------------------------------- */

function readService() {
  const $ = cheerio.load(readFileSync(join(SRC, 'szolgaltatas.html'), 'utf8'));
  $('script, style, noscript, svg').remove();
  const S = $('main').children();

  const sec = (i) => S.eq(i);
  const headOf = (i) => ({
    eyebrow: txt(sec(i).find('.bnx-eyebrow').first().text()),
    title: txt(sec(i).find('h2').first().text()),
    lead: txt(sec(i).find('.bnx-p, .sv-lede, .tone-medium').first().text()),
  });
  // h3 + a rá következő szöveg párokban
  const pairs = (i) => sec(i).find('h3').map((_, e) => ({
    title: txt($(e).text()),
    desc: txt($(e).nextAll('p, .tone-subtle, .tone-medium, div').first().text()),
    // a területeknél a cím alatt pipás felsorolás is áll
    items: $(e).nextAll('ul').first().find('li').map((i2, x) => txt($(x).text())).get(),
  })).get();

  const hero = {
    h1: txt(sec(0).find('h1').first().text()),
    lead: txt(sec(0).find('.bnx-lead, p').first().text()),
    ctas: sec(0).find('a').map((_, a) => ({ label: txt($(a).text()), href: $(a).attr('href') })).get(),
  };

  const steps = [];
  sec(4).find('.label-large').each((_, e) => {
    steps.push({
      title: txt($(e).text()),
      desc: txt($(e).parent().find('.text-size-small').first().text()),
      tag: txt($(e).parent().find('.label-small').first().text()),
    });
  });

  const plans = sec(5).find('.plan').map((_, el) => ({
    title: txt($(el).find('h3').first().text()),
    q: txt($(el).find('.plan-q').first().text()),
    desc: txt($(el).find('.tone-subtle').first().text()),
    items: $(el).find('.plan_item').map((i, x) => txt($(x).text())).get().filter(Boolean),
    note: txt($(el).find('.plan_bottom-tile, [class*="price"], .tone-subtle').last().text()),
  })).get();

  // a „Így néz ki, amikor elkészül" két példája: cím + meta + linkek
  const examples = [];
  sec(6).find('h3').each((_, e) => {
    const $wrap = $(e).parent();
    examples.push({
      title: txt($(e).text()),
      desc: txt($wrap.find('.tone-subtle, .text-size-small, p').first().text()),
      // a projektképek a kártyán belül állnak — nélkülük a szekció csupasz
      img: mapBnImg($wrap.find('img').attr('src')),
      alt: txt($wrap.find('img').attr('alt')),
      links: $wrap.find('a').map((i, a) => ({ label: txt($(a).text()), href: $(a).attr('href') })).get(),
    });
  });

  const faq = sec(7).find('details').map((_, e) => ({
    q: txt($(e).find('summary').text()),
    a: txt($(e).find('p').text()),
  })).get().filter((f) => f.q && f.a);

  const closing = {
    title: txt(sec(8).find('h2').first().text()),
    options: sec(8).find('h3').map((_, e) => {
      const $w = $(e).parent();
      return {
        title: txt($(e).text()),
        desc: txt($w.find('p, .tone-subtle').first().text()),
        links: $w.find('a').map((i, a) => ({ label: txt($(a).text()), href: $(a).attr('href') })).get(),
      };
    }).get(),
  };

  return {
    hero,
    pain: { ...headOf(1), items: pairs(1) },
    areas: { ...headOf(2), items: pairs(2) },
    deliver: {
      ...headOf(3),
      // a záró mondat nem listaelem, hanem bekezdés — az is a leszállítandóhoz tartozik
      items: sec(3).find('li').map((_, e) => txt($(e).text())).get().filter(Boolean),
      note: txt(sec(3).find('li').last().parent().nextAll('p').first().text())
        || txt(sec(3).find('p').last().text()),
    },
    process: { ...headOf(4), steps },
    packages: { ...headOf(5), plans, note: txt(sec(5).find('p').last().text()) },
    examples: { ...headOf(6), items: examples },
    faqHead: headOf(7),
    faq,
    closing,
  };
}

function buildService() {
  const shellFile = join(OUT, 'service/service-a.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs service váz');
  const d = readService();
  const $ = cheerio.load(readFileSync(shellFile, 'utf8'));
  const pricing$ = cheerio.load(readFileSync(join(OUT, 'pricing.html'), 'utf8'));

  // hero
  const $hero = $('.hero-service-a-section');
  $hero.find('h1').first().text(d.hero.h1);
  const $heroCtas = $hero.find('a.cta-main, a[class*="cta"]');
  $heroCtas.each((i, a) => {
    const cta = d.hero.ctas[i];
    if (!cta) { $(a).remove(); return; }
    $(a).attr('href', mapHref(cta.href)).removeAttr('aria-current').removeClass('w--current');
    if ((cta.href || '').startsWith('http')) $(a).attr('target', '_blank').attr('rel', 'noopener');
    const $bt = $(a).find('.button-text').first();
    if ($bt.length) $bt.text(cta.label); else $(a).text(cta.label);
  });
  $hero.find('.w-dyn-item, [class*="card"]').remove();
  // a bevezető CSAK a sablonkártyák törlése után kerülhet be, különben velük együtt tűnne el
  const $lead = $hero.find('.body-medium').first();
  if ($lead.length) $lead.text(d.hero.lead);
  else $hero.find('h1').first()
    .after(`<div class="body-medium" style="margin-top:var(--spacing--20);max-width:var(--max-width--7-columns)">${esc(d.hero.lead)}</div>`);

  // a sablon köztes szekciói helyére a BN szekciói kerülnek
  const blocks = [
    section(headline(d.pain.eyebrow, d.pain.title, d.pain.lead) + cardGrid(d.pain.items)),
    section(headline(d.areas.eyebrow, d.areas.title, d.areas.lead) + cardGrid(d.areas.items)),
    section(headline(d.deliver.eyebrow, d.deliver.title, d.deliver.lead) + bulletList(d.deliver.items)
      + (d.deliver.note && !d.deliver.items.includes(d.deliver.note)
        ? `<p class="body-medium" style="margin-top:var(--spacing--24)">${esc(d.deliver.note)}</p>` : '')),
    section(headline(d.process.eyebrow, d.process.title, d.process.lead)
      + cardGrid(d.process.steps.map((s) => ({
        title: s.title,
        desc: s.tag && !s.desc.toLowerCase().includes(s.tag.toLowerCase())
          ? `${s.desc} (${s.tag})` : s.desc,
      })))),
    section(headline(d.packages.eyebrow, d.packages.title, d.packages.lead)
      + cardGrid(d.packages.plans.map((p) => ({
        title: p.title,
        label: p.q,
        desc: [p.desc, p.note !== p.desc ? p.note.replace(/^[·•\s]+/, '') : '']
          .filter(Boolean).join(' '),
        items: p.items,
      })))
      + (d.packages.note ? `<p class="body-medium" style="margin-top:var(--spacing--32)">${esc(d.packages.note)}</p>` : '')
      + `<p style="margin-top:var(--spacing--16)"><a class="label-small label-strong bn-card-link" href="/arak">`
      + `Árak és csomagtartalmak →</a></p>`),
    section(headline(d.examples.eyebrow, d.examples.title, d.examples.lead)
      + cardGrid(d.examples.items)
      + `<p style="margin-top:var(--spacing--32)"><a class="label-small label-strong bn-card-link" href="/projektek">`
      + `Összes projekt megtekintése →</a></p>`),
    section(headline(d.faqHead.eyebrow, d.faqHead.title, d.faqHead.lead) + faqBlock(pricing$, d.faq)),
    section(headline('', d.closing.title, '') + cardGrid(d.closing.options)),
  ].join('');

  $('.service-a-approach-section, .service-a-tabs-section, .timeline-section, .service-a-contact-section')
    .remove();
  // a maradék, cím nélküli sablonszekciókat is kivesszük a hero és a CTA közül
  $('body > section').each((_, el) => {
    const c = $(el).attr('class') || '';
    if (/hero-service-a-section|cta-section|footer/.test(c)) return;
    if (!$(el).text().trim()) $(el).remove();
  });
  $('.cta-section').before(blocks);

  $('title').text('Szolgáltatás — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.lead);
  $('meta[property="og:title"]').attr('content', d.hero.h1);
  $('head').append(TD_CSS);

  writeFileSync(join(OUT, 'szolgaltatas.html'), $.html());
  console.log(`BN szolgaltatas.html: ${d.pain.items.length} fájdalompont, ${d.areas.items.length} terület, `
    + `${d.deliver.items.length} leszállítandó, ${d.process.steps.length} lépés, ${d.packages.plans.length} csomag, `
    + `${d.examples.items.length} példa, ${d.faq.length} GYIK`);
}

/* --------------------------------------------------------------------- */
/* Kapcsolat                                                              */
/* --------------------------------------------------------------------- */

const CAL_LINK = 'https://cal.com/attila-nagy-hjau8q/egyeni-konzultacio';

function readContact() {
  const $ = cheerio.load(readFileSync(join(SRC, 'contact/contact-a.html'), 'utf8'));
  $('script, style, noscript, svg').remove();
  const S = $('main').children();

  // a hero csatorna-kártyái: mailto, AI recepció, LinkedIn
  const seen = new Set();
  const channels = [];
  S.eq(0).find('a[href^="mailto:"], a[href^="http"]').each((_, a) => {
    const href = $(a).attr('href');
    if (seen.has(href)) return;
    seen.add(href);
    // A szerkezet: <a><div>Cím <span class="tone-subtle">leírás</span></div></a>
    const full = txt($(a).text());
    const desc = txt($(a).find('.tone-subtle').first().text());
    const title = desc && full.endsWith(desc) ? txt(full.slice(0, full.length - desc.length)) : full;
    channels.push({ title, desc, links: [{ label: 'Megnyitom', href }] });
  });

  // GYIK fülekre bontva — a füleket egymás utáni blokként visszük át
  const groups = [];
  const tabNames = S.eq(2).find('.tab-link').map((_, e) => txt($(e).text())).get();
  S.eq(2).find('.tab-pane').each((i, el) => {
    const items = $(el).find('.expandable-single').map((_, x) => ({
      q: txt($(x).find('.expandable-top').text()),
      a: txt($(x).find('.faq-paragraph').text()),
    })).get().filter((f) => f.q && f.a);
    if (items.length) groups.push({ name: tabNames[i] || `Kérdések ${i + 1}`, items });
  });

  const formNote = S.eq(0).find('p').map((_, e) => txt($(e).text()))
    .get().find((t) => /levelez/.test(t)) || '';

  return {
    h1: txt(S.eq(0).find('h1').first().text()),
    h1Html: headingHtml($, S.eq(0).find('h1').first()),
    lead: txt(S.eq(0).find('.bnx-lead, p').first().text()),
    formNote,
    channels,
    booking: {
      title: txt(S.eq(1).find('h2').first().text()),
      lead: txt(S.eq(1).find('p').first().text()),
    },
    faqTitle: txt(S.eq(2).find('h2').first().text()),
    groups,
  };
}

function buildContact() {
  const shellFile = join(OUT, 'contact/contact-a.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs contact váz');
  const d = readContact();
  const $ = cheerio.load(readFileSync(shellFile, 'utf8'));
  const pricing$ = cheerio.load(readFileSync(join(OUT, 'pricing.html'), 'utf8'));

  const $hero = $('.hero-contact-a-section');
  // A sablon hero két sorból áll — a .text() összeragasztaná („Kérdésed van?Írj bátran")
  $hero.find('h1').first().html(d.h1Html || esc(d.h1));
  // A sablon záró idézete kitalált szerzőt hoz („Jessy Mercedes — Alapító") — TILOS
  $('.contact-a-bottom-tile').remove();
  // a form törlése után a kétoszlopos rács jobb fele üresen maradna
  $('.contact-a-halves').css('grid-template-columns', '1fr');
  // a sablon űrlapja mögött nincs backend — a valódi oldal is levelezőprogramot nyit
  // A sablon űrlapja mögött nincs backend; a valódi oldal is a levelezőprogramot
  // nyitja meg, ezért az űrlap helyett a mailto-link és az apró betűje marad.
  $hero.find('form, .w-form, .form-block').remove();
  // a sablon második, osztály nélküli bevezetője a saját leadünk alatt maradna
  $hero.find('.contact-a-top-tile > div, .left-contact-a > div, .headline-contact-a > div')
    .filter((_, el) => {
      const c = $(el).attr('class');
      return !c && $(el).children().length === 0 && $(el).text().trim().length > 20;
    }).remove();
  $hero.find('h1').first()
    .after(`<div class="body-medium" style="margin-top:var(--spacing--20);max-width:var(--max-width--7-columns)">${esc(d.lead)}</div>`);

  const blocks = [
    section(headline('Elérhetőségek', 'Így éred el a leggyorsabban', '') + cardGrid(d.channels)
      + (d.formNote ? `<p class="body-medium" style="margin-top:var(--spacing--24)">${esc(d.formNote)}</p>` : '')),
    section(headline('Időpontfoglalás', d.booking.title, d.booking.lead)
      + `<div style="margin-top:var(--spacing--32)"><a class="cta-main w-inline-block" href="${CAL_LINK}" `
      + `target="_blank" rel="noopener"><div class="button-circle"></div>`
      + `<div class="button-text-mask"><div class="button-text">Időpontot foglalok</div></div>`
      + `<div class="button-bg"></div></a></div>`),
    // egy szekció, azon belül csoportok — különben 160px választaná el az
    // összetartozó kérdésblokkokat, miközben a csoporton belül 0px van
    section(headline('GYIK', d.faqTitle, '')
      + d.groups.map((g) => `<div class="bn-group">`
        + `<h3 class="text-h5 bn-group-title" style="margin-top:var(--spacing--48)">`
        + `${esc(g.name)}</h3>${faqBlock(pricing$, g.items)}</div>`).join('')),
  ].join('');

  // a sablon irodái, vezetői és értékesítési blokkjai nem a mi tartalmunk
  $('.contact-a-logo-section, .contact-seciton, .leadership-section').remove();
  $('body > section').each((_, el) => {
    const c = $(el).attr('class') || '';
    if (/hero-contact-a-section|cta-section|footer/.test(c)) return;
    $(el).remove();
  });
  $('.cta-section').before(blocks);

  $('title').text('Kapcsolat — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.lead);
  $('meta[property="og:title"]').attr('content', d.h1);
  $('head').append(TD_CSS);

  writeFileSync(join(OUT, 'kapcsolat.html'), $.html());
  console.log(`BN kapcsolat.html: ${d.channels.length} csatorna, `
    + `${d.groups.length} GYIK-csoport, ${d.groups.reduce((n, g) => n + g.items.length, 0)} kérdés`);
}

/* --------------------------------------------------------------------- */
/* Rólam                                                                  */
/* --------------------------------------------------------------------- */

// a BN képek a `bn-assets`-ből `/assets/bn-*` néven kerültek át (generate.mjs)
const mapBnImg = (src) => (src || '').replace(/^\/images\//, '/assets/bn-');

// A kép is szekcióba kell, különben a .main-container paddingján kívülre kerül
// és teljes szélességben, tengelyen kívül lóg.
const figure = (src, alt) => src
  ? section(`<img src="${mapBnImg(src)}" alt="${esc(alt || '')}" loading="lazy" `
    + `style="width:100%;height:auto;display:block;`
    + `border-radius:var(--_🔘-radius---general--default)">`)
  : '';

function readAbout() {
  const raw = readFileSync(join(SRC, 'rolam.html'), 'utf8');
  const $ = cheerio.load(raw);
  $('script, style, noscript, svg').remove();
  const S = $('main').children();

  const headOf = (i) => ({
    eyebrow: txt(S.eq(i).find('.bnx-eyebrow').first().text()),
    title: txt(S.eq(i).find('h2').first().text()),
    lead: txt(S.eq(i).find('.tone-subtle, .bnx-p').first().text()),
  });
  const pairs = (i) => S.eq(i).find('h3').map((_, e) => ({
    title: txt($(e).text()),
    desc: txt($(e).nextAll('p, .tone-subtle, div').first().text()),
  })).get();

  // A történet négy szakasza a forrásban JS-adattömbben él (a lapon fülek
  // váltják), ezért onnan olvassuk ki — különben csak az első szakasz jönne át.
  const story = [...raw.matchAll(/\{img:"([^"]+)",\s*t:"([^"]+)",\s*p:"([^"]+)"\}/g)]
    .map((m) => ({ img: m[1], title: m[2], desc: m[3] }));

  const extras = S.eq(5).find('details').map((_, e) => ({
    q: txt($(e).find('summary').text()),
    a: txt($(e).find('p').text()),
  })).get().filter((f) => f.q && f.a);

  return {
    hero: {
      eyebrow: txt(S.eq(0).find('.bnx-eyebrow').first().text()),
      h1: txt(S.eq(0).find('h1').first().text()),
      h1Html: headingHtml($, S.eq(0).find('h1').first()),
      lead: txt(S.eq(0).find('p').first().text()),
      img: S.eq(0).find('img').attr('src'),
    },
    values: {
      items: pairs(1),
      // a link körüli teljes sor is tartalom („16 év élsport · 15 projekt …")
      link: {
        label: txt(S.eq(1).find('a').parent().text()) || txt(S.eq(1).find('a').text()),
        href: S.eq(1).find('a').attr('href'),
      },
    },
    philosophy: {
      eyebrow: txt(S.eq(2).find('.bnx-eyebrow').first().text()),
      quote: txt(S.eq(2).find('p').first().text()),
      author: txt(S.eq(2).find('p').last().text()),
    },
    story: { ...headOf(3), steps: story },
    sport: { ...headOf(4), items: pairs(4) },
    extras: {
      ...headOf(5),
      items: extras,
      notes: S.eq(5).find('> .bnx-container > p, p').map((_, e) => txt($(e).text()))
        .get().filter((t) => t.length > 40 && !extras.some((x) => x.a === t)),
      link: { label: txt(S.eq(5).find('a').text()), href: S.eq(5).find('a').attr('href') },
    },
    closing: {
      title: txt(S.eq(6).find('h2').first().text()),
      options: S.eq(6).find('h3').map((_, e) => {
        const $w = $(e).parent();
        return {
          title: txt($(e).text()),
          desc: txt($w.find('p, .tone-subtle').first().text()),
          links: $w.find('a').map((i, a) => ({ label: txt($(a).text()), href: $(a).attr('href') })).get(),
        };
      }).get(),
    },
  };
}

function buildAbout() {
  const shellFile = join(OUT, 'about.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs about váz');
  const d = readAbout();
  const $ = cheerio.load(readFileSync(shellFile, 'utf8'));
  const pricing$ = cheerio.load(readFileSync(join(OUT, 'pricing.html'), 'utf8'));

  const $hero = $('.hero-about-section');
  $hero.find('h1').first().html(d.hero.h1Html || esc(d.hero.h1));
  $hero.find('.body-medium').first().text(d.hero.lead);
  if (!$hero.find('.body-medium').length) {
    $hero.find('h1').first()
      .after(`<div class="body-medium" style="margin-top:var(--spacing--20);max-width:var(--max-width--7-columns)">${esc(d.hero.lead)}</div>`);
  }

  const blocks = [
    figure(d.hero.img, d.hero.h1),
    section(headline('', '', '') + cardGrid(d.values.items)
      + (d.values.link.href
        ? `<p style="margin-top:var(--spacing--32)"><a class="label-small label-strong bn-card-link" `
          + `href="${mapHref(d.values.link.href)}">${esc(d.values.link.label)}</a></p>` : '')),
    section(headline(d.philosophy.eyebrow, '', '')
      + `<blockquote class="text-h4" style="margin-top:var(--spacing--24);max-width:var(--max-width--7-columns)">`
      + `${esc(d.philosophy.quote)}</blockquote>`
      + `<div class="label-small" style="margin-top:var(--spacing--16)">${esc(d.philosophy.author)}</div>`),
    section(headline(d.story.eyebrow, d.story.title, d.story.lead)
      + cardGrid(d.story.steps.map((s, i) => ({
        title: `0${i + 1} · ${s.title}`, desc: s.desc, img: mapBnImg(s.img),
      })))),
    section(headline(d.sport.eyebrow, d.sport.title, d.sport.lead) + cardGrid(d.sport.items)),
    section(headline(d.extras.eyebrow, d.extras.title, d.extras.lead)
      + faqBlock(pricing$, d.extras.items)
      + d.extras.notes.map((n) =>
        `<p class="body-medium" style="margin-top:var(--spacing--24);max-width:var(--max-width--7-columns)">${esc(n)}</p>`).join('')
      + (d.extras.link.href
        ? `<p style="margin-top:var(--spacing--16)"><a class="label-small label-strong bn-card-link" `
          + `href="${mapHref(d.extras.link.href)}" target="_blank" rel="noopener">`
          + `${esc(d.extras.link.label)}</a></p>` : '')),
    section(headline('', d.closing.title, '') + cardGrid(d.closing.options)),
  ].join('');

  $('.about-logos-section, .about-marquee-section, .about-numbers-section, '
    + '.leadership-section, .about-careers-section, .news-section').remove();
  $('body > section').each((_, el) => {
    const c = $(el).attr('class') || '';
    if (/hero-about-section|cta-section|footer/.test(c)) return;
    $(el).remove();
  });
  $('.cta-section').before(blocks);

  $('title').text('Rólam — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.lead);
  $('meta[property="og:title"]').attr('content', d.hero.h1);
  $('head').append(TD_CSS);

  writeFileSync(join(OUT, 'rolam.html'), $.html());
  console.log(`BN rolam.html: ${d.values.items.length} érték, ${d.story.steps.length} történet-szakasz, `
    + `${d.sport.items.length} tanulság, ${d.extras.items.length} extra kérdés`);
}

/* --------------------------------------------------------------------- */
/* Főoldal                                                                */
/* --------------------------------------------------------------------- */

function readHome() {
  const $ = cheerio.load(readFileSync(join(SRC, 'index.html'), 'utf8'));
  $('script, style, noscript, svg').remove();
  const S = $('main').children();

  const pairsIn = (i) => S.eq(i).find('h3').map((_, e) => ({
    title: txt($(e).text()),
    desc: txt($(e).nextAll('p').first().text()),
  })).get();

  return {
    hero: {
      eyebrow: txt(S.eq(0).find('.bnx-eyebrow, .label-large, [class*="eyebrow"]').first().text()),
      h1: txt(S.eq(0).find('h1').first().text()),
      h1Html: headingHtml($, S.eq(0).find('h1').first()),
      lead: txt(S.eq(0).find('p').first().text()),
      ctas: S.eq(0).find('a').map((_, a) => ({ label: txt($(a).text()), href: $(a).attr('href') }))
        .get().filter((c) => c.href && c.href !== '#'),
    },
    features: {
      title: txt(S.eq(1).find('h2').first().text()),
      items: S.eq(1).find('.services-horizontal_tile').map((_, e) => ({
        title: txt($(e).find('.heading-style-h6').text()),
        desc: txt($(e).find('.tone-subtle').last().text()),
      })).get(),
    },
    // két alcím-blokk egy szekcióban: „Rendbe teszem a hátteret" + „Közös rendszer"
    // a két alcím-blokk bevezetője testvér-konténerben áll, nem közvetlen testvérként
    combos: S.eq(2).find('h2').map((i, e) => ({
      title: txt($(e).text()),
      lead: txt($(e).parent().find('p').first().text()),
    })).get(),
    comboItems: pairsIn(2),
    cases: {
      title: txt(S.eq(3).find('.heading-style-h2, h2').first().text()),
      // a cím és a leírás külön elemben áll — szöveg-hasogatással azonos lett
      // A kártya szerkezete: .performance-tile (nagy szám + címke), alatta a
      // magyarázó mondat, végül a „Használati eset · <terület>" meta.
      items: S.eq(3).find('.slide_case').map((_, e) => {
        const $c = $(e);
        const num = txt($c.find('.heading-style-h1, .heading-style-h0').first().text());
        const lbl = txt($c.find('.performance-tile .label-large').first().text());
        const all = txt($c.text()).split('Használati eset');
        const head = [num, lbl].filter(Boolean).join(' ');
        const rest = txt(all[0]);
        return {
          title: head || rest,
          desc: head && rest.startsWith(head) ? txt(rest.slice(head.length)) : '',
          tag: txt(all[1]),
        };
      }).get(),
    },
    proof: {
      title: txt(S.eq(4).find('h2').first().text()),
      lead: txt(S.eq(4).find('.tone-subtle').map((_, e) => txt($(e).text()))
        .get().find((t) => t.length > 40) || ''),
      stats: S.eq(4).find('.performance-tile').map((_, e) => ({
        title: txt($(e).find('.heading-style-h0').text()),
        desc: txt($(e).find('.label-large').text()),
      })).get(),
      cta: {
        text: txt(S.eq(4).find('.cta_tile').text()),
        href: S.eq(4).find('a').attr('href'),
        label: txt(S.eq(4).find('a').text()),
      },
    },
    closing: {
      title: txt(S.eq(5).find('h2').first().text()),
      options: S.eq(5).find('h3').map((_, e) => {
        const $w = $(e).parent();
        return {
          title: txt($(e).text()),
          desc: txt($w.find('p').first().text()),
          links: $w.find('a').map((i, a) => ({ label: txt($(a).text()), href: $(a).attr('href') })).get(),
        };
      }).get(),
    },
  };
}

// A sticky split paneljeinek képei. A forráson ezek absztrakt illusztrációs
// kártyák voltak („Ma a háttérben", „Közös tábla"); itt a BN saját fotóiból
// választunk, területenként illeszkedőt.
const COMBO_IMG = [
  '/assets/bn-womanPhone.webp',   // Ügyfélszerzés
  '/assets/bn-duoTalk.webp',      // Kiszolgálás
  '/assets/bn-handsTyping.webp',  // Háttérműködés
  '/assets/bn-duoLaptop.webp',    // Ismétlődő feladatok kiszervezése
  '/assets/bn-officeRoom.webp',   // Folyamatfigyelés
  '/assets/bn-team.webp',         // Közös feladatlista
];
const CLOSING_IMG = ['/assets/bn-proj-konstruo.jpg', '/assets/bn-deskWarm.webp'];

function buildHome() {
  const shellFile = join(OUT, 'index.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs index váz');
  const d = readHome();
  const $ = cheerio.load(readFileSync(shellFile, 'utf8'));

  // A főoldal váza már BN-tartalmat kapott a content.mjs-től; itt a hiányzó
  // szekciókat pótoljuk, a hero és a meglévő logósáv érintetlen marad.
  const $hero = $('[class*="hero"]').first();
  $hero.find('h1').first().html(d.hero.h1Html || esc(d.hero.h1));
  const $eyebrow = $hero.find('.label-small, .master-label .label-small').first();
  if ($eyebrow.length && d.hero.eyebrow) $eyebrow.text(d.hero.eyebrow);
  const $hlead = $hero.find('.body-medium, p').first();
  if ($hlead.length) $hlead.text(d.hero.lead);
  else $hero.find('h1').first()
    .after(`<div class="body-medium" style="margin-top:var(--spacing--20);max-width:var(--max-width--7-columns)">${esc(d.hero.lead)}</div>`);
  // Hero-belépő: a cím és a lead sorban úszik be. A heroban NEM scrub-olt
  // split-cím — az a hajtás alatti szekciókra való, itt azonnal olvasható
  // kell legyen.
  $hero.find('h1').first().attr('data-bnm', 'rise');
  $hero.find('.body-medium, p').first().attr('data-bnm', 'rise');
  $hero.find('.master-label').first().attr('data-bnm', 'rise');
  $hero.attr('data-bnm-group', '');
  $hero.find('a[class*="cta"], .cta_primary').addClass('bnm-arrow');

  // A logósáv IX2-vel mozgott volna; a marquee-t saját CSS-animáció hajtja.
  // A sávot duplázzuk, hogy a -50%-nál varrat nélkül ismétlődjön.
  const $mq = $('.wrap-marquee-logos').first();
  if ($mq.length) {
    const inner = $mq.html();
    $mq.removeAttr('data-w-id').removeAttr('style')
      .addClass('bnm-marquee-track').html(inner + inner);
    $mq.parent().addClass('bnm-marquee');
  }

  const combo = (i) => d.comboItems.slice(i * 3, i * 3 + 3).map((it, k) => ({
    ...it, img: COMBO_IMG[i * 3 + k], tag: `0${k + 1}`, paneTitle: it.title,
  }));

  const blocks = [
    stackRow({ eyebrow: 'Előnyök', title: d.features.title, items: d.features.items }),
    syncSplit({
      eyebrow: 'Egyéni vállalkozóknak', title: d.combos[0] && d.combos[0].title,
      lead: d.combos[0] && d.combos[0].lead, items: combo(0),
      cta: { label: 'Nézd meg a szolgáltatásom', href: '/szolgaltatas' },
    }),
    syncSplit({
      eyebrow: 'Csapatoknak', title: d.combos[1] && d.combos[1].title,
      lead: d.combos[1] && d.combos[1].lead, items: combo(1), reverse: true,
    }),
    usecaseGrid({ eyebrow: 'Használati esetek', title: d.cases.title, items: d.cases.items }),
    numberBand({
      eyebrow: 'Amit vállalok', title: d.proof.title, lead: d.proof.lead,
      // A forrás `.cta_tile`-jának szövege a gomb feliratát is tartalmazza —
      // levágjuk, különben a mondat végén és a CTA-n is ott állna ugyanaz.
      stats: d.proof.stats,
      note: (d.proof.cta.text || '').replace(d.proof.cta.label || '', '').trim(),
      cta: d.proof.cta.href
        ? { label: d.proof.cta.label, href: mapHref(d.proof.cta.href) } : null,
    }),
    duoCards({
      eyebrow: 'Következő lépés', title: d.closing.title,
      items: d.closing.options.map((o, i) => ({
        title: o.title, desc: o.desc, img: CLOSING_IMG[i],
        href: mapHref((o.links[0] || {}).href || '/'),
        label: (o.links[0] || {}).label || 'Megnézem',
      })),
    }),
  ].join('');

  // a sablon köztes szekciói helyére a BN szekciói kerülnek; a hero, a
  // logósáv (valódi eszközök) és a záró CTA marad
  $('body > section').each((_, el) => {
    const c = $(el).attr('class') || '';
    if (/hero|cta-section|footer|logo/.test(c)) return;
    $(el).remove();
  });
  $('.cta-section').before(blocks);

  $('title').text('Business Native — AI-alapú rendszerek szolgáltató vállalkozóknak');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.lead);
  $('head').append(TD_CSS);

  writeFileSync(shellFile, $.html());
  console.log(`BN index.html: ${d.features.items.length} előny, ${d.comboItems.length} terület, `
    + `${d.cases.items.length} használati eset, ${d.proof.stats.length} vállalás`);
}

/* --------------------------------------------------------------------- */

buildService();
buildContact();
buildAbout();
// A főoldalt a generate-ef.mjs építi az Expert Flow forrásból (ef-src/).
// buildHome();
