// Expert Flow forrásoldal → Modulabs sablon.
//
// Forrás: `ef-src/` (https://nagys-sublime-site-c0c265.webflow.io/)
//
// MIÉRT ÍGY: az előző két kör azon bukott el, hogy (1) rossz forrásból, a
// businessnative.hu-ról dolgoztam, és (2) a képeket én párosítottam a
// blokkokhoz. Itt MINDEN a forrás DOM-jából jön — szöveg, kép, sőt az inline
// SVG-ikonok is. A generátorban egyetlen kézzel írt tartalmi sor sincs, így
// nem tud „elcsúszni" a kép a szövegtől.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, txt } from './shared.mjs';
import {
  efHero, efStatement, efSplitMedia, efPillars, efCtaBar,
} from './ef-sections.mjs';

const SRC = 'ef-src';

// A forrás linkjei a V2 tiszta URL-jeire mutatnak.
const URLMAP = {
  '/szolgaltatas': '/szolgaltatas', '/rolam': '/rolam', '/referenciak': '/projektek',
  '/adatvedelmi': '/adatvedelem', '/aszf': '/aszf', '/garancia': '/garancia', '/': '/',
};
const mapHref = (h) => {
  if (!h || h === '#') return '';
  if (h.startsWith('http') || h.startsWith('mailto:') || h.startsWith('#')) return h;
  return URLMAP[h.replace(/\.html$/, '')] || h;
};

// CDN-útvonal → lokális asset. A letöltéskor a vezető hex-prefix esett le, és
// `ef-` előtagot kapott minden fájl.
function localImg(src) {
  if (!src) return '';
  const base = decodeURIComponent(src.split('/').pop() || '').replace(/^[0-9a-f]+_/, '');
  return `/assets/ef-${base}`;
}

// A képeknél a srcset legnagyobb variánsa a legjobb minőség, de a lokális
// másolat az alapfájl — ezért mindig a `src`-ből dolgozunk.
const imgOf = ($, $scope) => localImg($scope.find('img').first().attr('src'));

/* --------------------------------------------------------------------- */
/* A sablon SAJÁT sticky blokkja                                          */
/* --------------------------------------------------------------------- */
// A `.capabilities-section` a Modulabs sablon komponense — ugyanaz az osztály
// szerepel az Expert Flow forrásoldalon is, mert Attila onnan másolta ki.
// Ezért nem újraépítjük, hanem a sablon eredeti markupját emeljük át, és CSAK
// a szöveget és a képet cseréljük benne. Így a sablon saját arányai, sticky
// viselkedése és stílusai maradnak — nincs saját CSS, ami elcsúszhat tőle.

const TPLDIR = '../site-generator/public';
const TPL = `${TPLDIR}/index.html`;

// A sablon elemein Webflow-interakciós KEZDŐÁLLAPOT ül inline stílusként
// (`opacity:0`, `transform:translate3d(...)`, `filter:blur(...)`), amit az IX2
// animálna láthatóra. Az interakció-definíciók viszont hiányoznak a lokális
// másolatból, így ez a kezdőállapot örökre megmaradna — és az inline stílust
// egyetlen CSS-osztály sem tudja felülírni. Ezért minden átemelt blokkról
// letakarítjuk, a hozzá tartozó halott `data-w-id`-vel együtt.
function stripDeadIx($t, $scope) {
  $scope.find('[style]').addBack('[style]').each((_, el) => {
    const $e = $t(el);
    const s = ($e.attr('style') || '')
      .replace(/(^|;)\s*(opacity|transform|filter|visibility|will-change)\s*:[^;]*/gi, '')
      .replace(/^;+|;+$/g, '').trim();
    if (s) $e.attr('style', s); else $e.removeAttr('style');
  });
  $scope.find('[data-w-id]').addBack('[data-w-id]').removeAttr('data-w-id');
}

// Egy sablon-szekció betöltése szerkeszthető formában. Minden blokk így jön:
// a sablon markupja marad, mi csak a szöveget és a képet cseréljük benne.
function tpl(file, sel) {
  const p = `${TPLDIR}/${file}`;
  if (!existsSync(p)) return null;
  const $t = cheerio.load(readFileSync(p, 'utf8'));
  const $sec = $t(sel).first();
  if (!$sec.length) return null;
  stripDeadIx($t, $sec);
  return { $t, $sec };
}

// A sablon képei srcset-tel jönnek, a mi lokális másolatunknak nincsenek
// méretvariánsai — a srcset/sizes eldobása nélkül a böngésző a sablon eredeti
// fotóját töltené be a mienk helyett.
function setImg($img, src) {
  if (!$img || !$img.length) return;
  if (src) $img.attr('src', src).removeAttr('srcset').removeAttr('sizes').attr('alt', '');
  else $img.remove();
}

function capabilitiesBlock({ eyebrow, title, lead, navItems, panels }) {
  const t = tpl('index.html', '.capabilities-section');
  if (!t) return '';
  const { $t, $sec } = t;

  // fejléc
  const $head = $sec.find('.headline-tabs').first();
  $head.find('.label-small').first().text(eyebrow || '');
  // A sablon címében <span class="heading-medium"> tördeli a kiemelt részt;
  // a mi címünk egyben áll, ezért a span-t elhagyjuk.
  $head.find('h2').first().text(title || '');
  const $lead = $head.find('.body-medium').first();
  if (lead) $lead.text(lead); else $lead.remove();

  // Scroll-spy: a sablon a listaelemet csak `.w--current`-kor emeli ki, ami
  // horgony-kattintásra állna be. Görgetésre nem történne semmi — ezt a
  // jelölést adjuk hozzá, a sablon markupjának módosítása nélkül.
  $sec.attr('data-bnm', 'spy');

  // bal oldali lista — a sablon 4 elemet hoz, mi annyit tartunk meg, ahány kell
  const $items = $sec.find('.tab-item');
  $items.each((i, el) => {
    const it = navItems[i];
    if (!it) return $t(el).remove();
    $t(el).attr('href', `#${it.id}`).attr('data-bnm-spy-nav', '')
      .find('.label-small').first().text(it.label);
  });

  // jobb oldali panelek
  const $panels = $sec.find('.tab-content-item');
  $panels.each((i, el) => {
    const p = panels[i];
    const $p = $t(el);
    if (!p) return $p.remove();
    $p.attr('id', p.id).attr('data-bnm-spy-panel', '');
    // A srcset/sizes a sablon képvariánsaira mutat — a mi képünknek nincsenek
    // ilyen méretei, ezért ezeket el kell dobni, különben a böngésző a sablon
    // eredeti fotóját töltené be.
    const $img = $p.find('img').first();
    if (p.img) $img.attr('src', p.img).removeAttr('srcset').removeAttr('sizes').attr('alt', '');
    else $img.remove();
    const $icon = $p.find('.icon-large').first();
    if (p.icon) $icon.html(p.icon); else $icon.closest('.icon-wrap-medium').remove();
    $p.find('.text-body-bold').first().text(p.title || '');
    $p.find('.text-small').first().text(p.desc || '');
  });

  return $t.html($sec);
}


// A sablon szekcióinak cseréje a generált blokkokra.
// FONTOS: a `<section>` elemek törlése után a köztük álló ÜRES szövegcsomók
// bent maradnak, és minden újabb build hozzátesz még néhányat — a kimenet így
// sosem lesz bájtazonos önmagával. Ezért a whitespace-t is takarítjuk.
function replaceSections($, blocks) {
  $('body > section').each((_, el) => {
    if (/cta-section|footer/.test($(el).attr('class') || '')) return;
    $(el).remove();
  });
  $('body').contents().each((_, n) => {
    if (n.type === 'text' && !n.data.trim()) $(n).remove();
  });
  const $anchor = $('.cta-section').first();
  if ($anchor.length) $anchor.before(blocks); else $('body').prepend(blocks);
}

/* --------------------------------------------------------------------- */

function readHome() {
  const $ = cheerio.load(readFileSync(join(SRC, 'index.html'), 'utf8'));

  /* 1. hero + képsáv */
  const $hero = $('.hero-home-b-section').first();
  const hero = {
    title: txt($hero.find('h2').first().text()),
    lead: txt($hero.find('.text-wrap-home-b-hero').first().text()),
    // A marquee utolsó eleme egy angol sablon-kártya (Evermind/FRANCO) —
    // az nem a mi tartalmunk, a képek viszont igen.
    images: [...new Set($hero.find('img').map((_, im) => $(im).attr('src')).get()
      .filter((s) => s && !/Dots/i.test(s)).map(localImg))],
  };

  /* 2. állítás-blokk */
  const $st = $('.section_about-docs-2').first();
  const statement = {
    title: txt($st.find('h2').first().text()),
    eyebrow: txt($st.find('.eyebrow-31').first().text()),
    body: txt($st.find('.herpo-alatt').first().text()),
  };

  /* 3. sticky lista + görgő panelek — a „három legnagyobb kihívás" */
  const $sl = $('.system-home-b-section').first();
  const navLabels = $sl.find('.tab-list-5 a').map((_, a) => ({
    label: txt($(a).text()), href: $(a).attr('href') || '',
  })).get();
  const stickyList = {
    eyebrow: txt($sl.find('.label-small-165').first().text()),
    title: txt($sl.find('.heading-system-home-b-2').first().text()),
    items: $sl.find('.tab-content-item-4').map((i, el) => {
      const $p = $(el);
      const heads = $p.find('.label-small-165, [class*="label-small"]');
      return {
        id: $p.attr('id') || `panel-${i + 1}`,
        nav: (navLabels[i] || {}).label || '',
        eyebrow: txt(heads.first().text()),
        title: txt($p.find('.text-h6-17, h6, [class*="text-h6"]').first().text()),
        desc: txt($p.find('[class*="text-light-88"], p').first().text()),
        img: imgOf($, $p),
      };
    }).get(),
  };

  /* 4. kétoszlopos kép + szöveg */
  const $sp = $('.home-a-column-section').first();
  const $spText = $sp.find('.headline-column-13').first();
  const $spBtn = $sp.find('a[href]').first();
  const splitMedia = {
    img: imgOf($, $sp),
    eyebrow: txt($spText.find('[class*="label-small"]').first().text()),
    title: txt($spText.find('[class*="text-h3"]').first().text()),
    body: txt($spText.find('p, .text-block-20, div').filter((_, e) =>
      txt($(e).text()).length > 60).first().text()),
    cta: $spBtn.length
      ? { label: txt($spBtn.find('.button-text').first().text() || $spBtn.text()),
        href: mapHref($spBtn.attr('href')) }
      : null,
  };

  /* 5. sticky lista + kártyák (sötét sáv) */
  const $cs = $('.capabilities-section').first();
  const stickyCards = {
    eyebrow: txt($cs.find('.master-label-5').first().text()),
    title: txt($cs.find('.no-margins-7').first().text()),
    navItems: $cs.find('.tab-item-5').map((_, a) => ({
      label: txt($(a).text()), id: ($(a).attr('href') || '').replace('#', ''),
    })).get(),
    cards: $cs.find('.tab-content-item-6').map((i, el) => {
      const $c = $(el);
      // Az ikon a forrás inline SVG-je — átemeljük, nem rajzolunk újat.
      const $svg = $c.find('svg').first();
      return {
        id: $c.attr('id') || `card-${i + 1}`,
        icon: $svg.length ? $.html($svg) : '',
        title: txt($c.find('.text-body-bold-2, [class*="text-body-bold"]').first().text()),
        desc: txt($c.find('[class*="text-small"], [class*="body-medium"]').first().text()),
        img: imgOf($, $c),
      };
    }).get(),
  };

  /* 6. pillérek */
  const $pl = $('.hero-pricing-section').first();
  const pillars = {
    title: txt($pl.find('h1').first().text()),
    lead: txt($pl.find('.headline-home-b-bottom-tile-5').first().text()),
    items: $pl.find('.card-pricing-5').map((_, el) => {
      const $c = $(el);
      const labels = $c.find('[class*="label-small"]').map((__, l) => txt($(l).text())).get();
      return {
        title: txt($c.find('[class*="text-large"]').first().text()),
        tag: labels[0] || '',
        desc: txt($c.find('.plan-about').first().text()),
        listTitle: labels[1] || '',
        // CSAK a tényleges listaelemek. A tágabb `[class*="plan-list"] > div`
        // a konténert és a „FÓKUSZ" címkét is behúzta, ráadásul többszörösen.
        items: $c.find('[class*="plan-list-item"]')
          .map((__, li) => txt($(li).text())).get().filter(Boolean),
      };
    }).get(),
  };

  /* 7. CTA-sáv */
  const $cta = $('.pricing-logos-section').first();
  const $ctaBtn = $cta.find('a[href]').first();
  const ctaBar = $ctaBtn.length ? {
    label: txt($ctaBtn.find('.button-text').first().text() || $ctaBtn.text()),
    href: mapHref($ctaBtn.attr('href')),
  } : null;

  return { hero, statement, stickyList, splitMedia, stickyCards, pillars, ctaBar };
}

/* --------------------------------------------------------------------- */

function buildHome() {
  const shell = join(OUT, 'index.html');
  if (!existsSync(shell)) return console.log('SKIP: nincs index váz');
  const d = readHome();
  const $ = cheerio.load(readFileSync(shell, 'utf8'));

  // A forrás világos/sötét ritmusa: világos hero → világos állítás → SÖTÉT
  // kihívás-blokk → világos bemutatkozás → SÖTÉT kártyák → világos pillérek.
  const blocks = [
    efHero(d.hero),
    efStatement({ ...d.statement, light: true }),
    // Mindkét sticky blokk a sablon SAJÁT `.capabilities-section`-jéből épül —
    // ez ugyanaz a komponens, amit a forrásoldal is használ.
    capabilitiesBlock({
      eyebrow: d.stickyList.eyebrow,
      title: d.stickyList.title,
      navItems: d.stickyList.items.map((it) => ({ id: it.id, label: it.nav })),
      panels: d.stickyList.items,
    }),
    efSplitMedia({ ...d.splitMedia, light: true }),
    capabilitiesBlock({
      eyebrow: d.stickyCards.eyebrow,
      title: d.stickyCards.title,
      navItems: d.stickyCards.navItems,
      panels: d.stickyCards.cards,
    }),
    efPillars({ ...d.pillars, light: true }),
    d.ctaBar ? efCtaBar({ ...d.ctaBar, light: true }) : '',
  ].join('');

  // A sablon saját szekcióit lecseréljük; a záró CTA-sáv (háttérvideós) és a
  // lábléc marad, a navigációt a polish írja BN-re.
  replaceSections($, blocks);

  $('title').text('Business Native — AI-alapú rendszerek egyéni vállalkozóknak');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.lead);

  writeFileSync(shell, $.html());
  console.log(`EF index.html: ${d.hero.images.length} hero-kép, `
    + `${d.stickyList.items.length} kihívás-panel, ${d.stickyCards.cards.length} kártya, `
    + `${d.pillars.items.length} pillér`);
}

/* --------------------------------------------------------------------- */
/* Szolgáltatás oldal                                                     */
/* --------------------------------------------------------------------- */

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clone = (html) => cheerio.load(html, null, false).root().children().first();

// A sablon pipás listája (pricing.html `.plan-list`) — a pillérek EREDMÉNY-listáihoz.
function planList(items) {
  const t = tpl('pricing.html', '.plan-list');
  if (!t || !items.length) return '';
  const { $t, $sec } = t;
  const itemHtml = $t.html($sec.find('.plan-list-item').first());
  $sec.empty();
  items.forEach((x) => {
    const $i = clone(itemHtml);
    $i.find('div').last().text(x);
    $sec.append($i);
  });
  return $t.html($sec);
}

function readService() {
  const $ = cheerio.load(readFileSync(join(SRC, 'szolgaltatas.html'), 'utf8'));
  const S = $('body > section');
  const sec = (i) => S.eq(i);
  const labels = ($s) => $s.find('[class*="label-small"]').map((_, e) => txt($(e).text())).get();

  // 3–5. szekció: a három pillér. Azonos szerkezet, csak a középső tükrözött
  // és sötét — a forrás így váltogatja a ritmust.
  const pillar = (i) => {
    const $s = sec(i);
    const lb = labels($s);
    return {
      img: imgOf($, $s),
      eyebrow: lb[0] || '',
      title: txt($s.find('[class*="text-h3"], h2').first().text()),
      body: txt($s.find('[class*="text-block"]').first().text())
        || txt($s.find('div').filter((_, e) => {
          const t = txt($(e).text());
          return t.length > 80 && !$(e).children('div,p').length;
        }).first().text()),
      listTitle: lb[1] || '',
      items: $s.find('[class*="plan-list-item"]').map((_, e) => txt($(e).text())).get(),
    };
  };

  return {
    hero: {
      title: txt(sec(0).find('h1').first().text()),
      lead: txt(sec(0).find('[class*="text-block"]').first().text()),
      img: localImg(sec(0).find('img[class*="about-image"]').first().attr('src')),
      logos: sec(0).find('[class*="single-logo-marquee"] img')
        .map((_, e) => localImg($(e).attr('src'))).get(),
    },
    audience: {
      eyebrow: labels(sec(1))[0] || '',
      title: txt(sec(1).find('[class*="text-h3"]').first().text()),
      items: sec(1).find('[class*="card-system"]').map((_, e) => ({
        num: txt($(e).find('[class*="text-h6"]').first().text()),
        desc: txt($(e).find('[class*="text-light"]').first().text()),
      })).get(),
    },
    statement: {
      eyebrow: labels(sec(2))[0] || '',
      title: txt(sec(2).find('h2').first().text()),
    },
    pillars: [pillar(3), pillar(4), pillar(5)],
    solutions: {
      eyebrow: labels(sec(6))[0] || '',
      title: txt(sec(6).find('h2').first().text()),
      items: sec(6).find('[class*="card-feature"]').map((_, e) => ({
        title: txt($(e).find('[class*="text-h6"]').first().text()),
        desc: txt($(e).find('[class*="text-dark-88"], [class*="body-medium"]').first().text()),
      })).get().filter((x) => x.title),
    },
    process: {
      eyebrow: labels(sec(7))[0] || '',
      title: txt(sec(7).find('h3, h2').first().text()),
      // A lépés leírása osztály NÉLKÜLI div-ben áll, közvetlenül a címet
      // tartalmazó div után — osztály-alapú szelektor nem találja meg.
      steps: sec(7).find('[class*="timeline-step"]').map((_, e) => {
        const $strong = $(e).find('strong').first();
        return {
          num: txt($(e).find('[class*="label-small"]').first().text()),
          title: txt($strong.text()),
          desc: txt($strong.parent().next().text())
            || txt($(e).find('[class*="body-medium"], p').last().text()),
        };
      }).get(),
    },
    consult: {
      title: txt(sec(8).find('h2').first().text()),
      img: imgOf($, sec(8)),
      items: sec(8).find('[class*="timeline-item"]').map((_, e) => ({
        num: txt($(e).find('[class*="label-small"]').first().text()),
        title: txt($(e).find('strong').first().text()),
        desc: txt($(e).find('[class*="body-medium"]').first().text()),
      })).get(),
    },
    ctaBar: (() => {
      const $b = sec(9).find('a[href]').first();
      return $b.length
        ? { label: txt($b.find('.button-text').first().text() || $b.text()),
          href: $b.attr('href') }
        : null;
    })(),
    faq: {
      eyebrow: labels(sec(10))[0] || '',
      title: txt(sec(10).find('h2').first().text()),
      // A mentett HTML-ből hiányzik a GYIK tab-menüje, így a 3 panel felirata
      // nem létezik — kitalálni nem fogom. Mind a 15 kérdés egy listába megy,
      // a két szó szerint ismételt kérdés kiszűrve.
      items: (() => {
        const seen = new Set();
        return sec(10).find('[class*="expandable-single"]').map((_, e) => ({
          q: txt($(e).find('[class*="text-body-bold"], strong').first().text()),
          a: txt($(e).find('[class*="faq-paragraph"], p').first().text()),
        })).get().filter((x) => {
          if (!x.q || seen.has(x.q)) return false;
          seen.add(x.q); return true;
        });
      })(),
    },
  };
}

/* --- szekció-építők a sablon saját blokkjaiból --- */

// Hero: cím + lead + széles kép + logósáv. A sablon `hero-pricing-section`
// fejléce adja a tipográfiát, a logósávot a `home-b-logos-section` hozza.
function serviceHero(d) {
  const logos = d.logos.map((src) =>
    `<div class="ef-logo"><img src="${src}" alt="" loading="lazy" decoding="async"></div>`).join('');
  return `
  <section class="section ef-hero ef-service-hero">
    <div class="w-layout-blockcontainer main-container w-container">
      <div class="ef-hero-head">
        <h1 class="text-h1 no-margins" data-bnm="rise">${esc(d.title)}</h1>
        ${d.lead ? `<p class="text-large ef-hero-lead" data-bnm="rise">${esc(d.lead)}</p>` : ''}
      </div>
      ${d.img ? `<div class="ef-hero-media" data-bnm="clip">
        <img src="${d.img}" alt="" decoding="async"></div>` : ''}
    </div>
    ${logos ? `<div class="ef-logos bnm-marquee"><div class="ef-logos-track bnm-marquee-track">
      ${logos}${logos}</div></div>` : ''}
  </section>`;
}

// „Neked szól, ha:" — a sablon `.contact-grid` + `.card-contact` rácsa.
function audienceGrid(d) {
  const t = tpl('careers.html', '.contact-seciton') || tpl('contact/contact-a.html', '.contact-seciton');
  if (!t) return '';
  const { $t, $sec } = t;
  $sec.find('[class*="label-small"]').first().text(d.eyebrow);
  const $h = $sec.find('h2, [class*="text-h3"], [class*="text-h2"]').first();
  if ($h.length) $h.text(d.title);
  // A sablon fejlécében a cím alatt saját marketingmondat áll („Nem csupán
  // projekteket hajtunk végre…"). A forrásban ehhez a szekcióhoz nincs lead,
  // ezért a sablon szövege maradna bent — ki kell venni.
  $sec.find('.headline-contact, [class*="headline"]').first()
    .find('.body-medium, .text-large').remove();
  const $cards = $sec.find('.card-contact');
  const cardHtml = $t.html($cards.first());
  const $grid = $cards.first().parent();
  $grid.empty();
  d.items.forEach((it) => {
    const $c = clone(cardHtml);
    $c.find('[class*="icon"]').remove();
    const $tx = $c.find('.text-wrap-contact-card');
    $tx.empty().append(`<div class="text-h4 no-margins ef-aud-num">${esc(it.num)}</div>`)
      .append(`<div class="body-medium">${esc(it.desc)}</div>`);
    $c.find('a').remove();
    $c.attr('data-bnm', 'rise');
    $grid.append($c);
  });
  $grid.attr('data-bnm-group', '');
  $sec.addClass('ef-audience');
  return $t.html($sec);
}

// Pillér: a sablon `.column-halves` blokkja (kép | tartalom).
function pillarBlock(p, { reverse = false, light = false } = {}) {
  const t = tpl('index.html', '.home-b-column-section');
  if (!t) return '';
  const { $t, $sec } = t;
  // A sablon képére egy kitalált ügyféltörténet-kártya van ráúsztatva
  // („Jessica Mercedes") — kitalált referencia nem maradhat az oldalon.
  $sec.find('.overlay-client-story').remove();
  setImg($sec.find('.image-wrap-column img').first(), p.img);
  $sec.find('.image-wrap-column').first().attr('data-bnm', 'clip');
  const $c = $sec.find('.content-column').first();
  $c.attr('data-bnm', 'rise');
  $c.find('[class*="label-small"]').first().text(p.eyebrow);
  $c.find('h2').first().text(p.title);
  $c.find('.body-medium').first().text(p.body);
  // A sablon CTA-gombja helyére az EREDMÉNY-lista kerül.
  $sec.find('.cta-main').remove();
  if (p.items.length) {
    $c.append(`<div class="label-small ef-list-title">${esc(p.listTitle)}</div>${planList(p.items)}`);
  }
  $sec.addClass('ef-pillar-sec');
  if (reverse) $sec.find('.column-halves').addClass('ef-rev');
  if (light) $sec.addClass('light-mode ef-light');
  return $t.html($sec);
}

// „Megvalósítás a gyakorlatban" — a sablon feature-slidere. A forrásban a
// kártyáknak nincs képük és ikonjuk, csak cím + szöveg.
function solutionSlider(d) {
  const t = tpl('homepage/home-b.html', '.home-a-features-section');
  if (!t) return '';
  const { $t, $sec } = t;
  $sec.find('[class*="label-small"]').first().text(d.eyebrow);
  $sec.find('h2').first().text(d.title);
  const $slides = $sec.find('.slide-feature');
  const slideHtml = $t.html($slides.first());
  const $mask = $slides.first().parent();
  $mask.empty();
  d.items.forEach((it) => {
    const $s = clone(slideHtml);
    $s.find('img').remove();
    $s.find('.icon-wrap-medium').remove();
    $s.find('.text-body-bold').first().text(it.title);
    $s.find('.text-small').first().text(it.desc);
    $mask.append($s);
  });
  $sec.addClass('ef-solutions');
  return $t.html($sec);
}

// Idővonal — a sablon `.timeline-section`-je. Kétszer használjuk: a folyamat
// lépéseihez (kép nélkül) és a konzultációs blokkhoz (portréval).
function timelineBlock({ eyebrow, title, img, steps, dark = false }) {
  const t = tpl('service/service-a.html', '.timeline-section');
  if (!t) return '';
  const { $t, $sec } = t;
  const $head = $sec.find('.headline-timeline').first();
  $head.find('[class*="text-h3"]').first().text(title).find('span').remove();
  if (eyebrow) {
    $head.prepend(`<div class="master-label"><div class="circle-label"></div>`
      + `<div class="label-small">${esc(eyebrow)}</div></div>`);
  }
  const $img = $sec.find('.image-wrap-timeline').first();
  if (img) { setImg($img.find('img').first(), img); $img.attr('data-bnm', 'clip'); }
  else { $img.remove(); $sec.find('.timeline-halves').addClass('ef-tl-nomedia'); }

  const $items = $sec.find('.timeline-item');
  const itemHtml = $t.html($items.first());
  const $holder = $items.first().parent();
  $holder.empty();
  steps.forEach((s) => {
    const $i = clone(itemHtml);
    $i.find('.label-small').first().text(s.num);
    $i.find('.text-body-bold').first().text(s.title);
    $i.find('.body-medium').first().text(s.desc);
    $i.attr('data-bnm', 'rise');
    $holder.append($i);
  });
  $holder.attr('data-bnm-group', '');
  $sec.addClass('ef-timeline');
  if (dark) $sec.addClass('ef-tl-dark');
  return $t.html($sec);
}

// GYIK — a sablon `.faq-section`-je (bal fejléc + jobb lenyíló lista).
function faqBlock(d) {
  const t = tpl('pricing.html', '.faq-section');
  if (!t) return '';
  const { $t, $sec } = t;
  $sec.find('[class*="label-small"]').first().text(d.eyebrow);
  const $ft = $sec.find('[class*="text-h3"], h2').first();
  $ft.text(d.title);
  // A forrás fejlécében kifutó linkek állnak (pl. „Összes kérdés és válasz")
  // — ezek a sablon fejlécében nincsenek, ezért utánuk fűzzük.
  if (d.links && d.links.length) {
    $ft.after(`<div class="ef-faq-links">` + d.links.map((l) =>
      `<a class="bn-cta-link bnm-arrow" href="${mapHref(l.href) || l.href}"`
      + `${(l.href || '').startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>`
      + `${esc(l.label.replace(/\s*→\s*$/, ''))}</a>`).join('') + `</div>`);
  }
  // A sablon GYIK-je Webflow-tabként nyílna, az IX2 interakció pedig hiányzik
  // a lokális másolatból — leellenőrizve: kattintásra a válasz magassága 0
  // marad, vagyis a lenyíló egyszerűen NEM működik. Ezért natív <details>-re
  // alakítjuk: ugyanaz a vizuális felépítés és osztálykészlet, de JS nélkül,
  // billentyűzetről is kezelhetően.
  const $links = $sec.find('.tab-link-faq');
  const inner = $t.html($links.first().find('.expandable-single').first());
  const $menu = $links.first().parent();
  $menu.empty().removeClass('w-tab-menu').removeAttr('role');
  let lastGroup = null;
  d.items.forEach((f) => {
    // Csoportváltásnál kiírjuk a fül feliratát, hogy a forrás tagolása
    // megmaradjon akkor is, ha a fülek helyett egy listát használunk.
    if (f.group && f.group !== lastGroup) {
      $menu.append(`<div class="label-small ef-faq-group">${esc(f.group)}</div>`);
      lastGroup = f.group;
    }
    const $s = clone(inner);
    $s.find('.text-body-bold').first().text(f.q);
    $s.find('.faq-paragraph').first().text(f.a);
    const top = $t.html($s.find('.expandable-top').first());
    const bottom = $t.html($s.find('.expandable-bottom').first());
    $menu.append(`<details class="expandable-single ef-acc" data-bnm="rise">`
      + `<summary class="expandable-top">${$s.find('.expandable-top').first().html()}</summary>`
      + bottom + `</details>`);
    void top;
  });
  $menu.attr('data-bnm-group', '');
  // A tabs-váz maradéka nélkülünk hibát dobna (a Webflow tab-JS a hiányzó
  // panelek id-jét keresné) — a wrappert sima konténerré fokozzuk le.
  $sec.find('.tabs-content-faq').remove();
  $sec.find('.tabs-faq').removeClass('w-tabs')
    .removeAttr('data-current').removeAttr('data-easing')
    .removeAttr('data-duration-in').removeAttr('data-duration-out');
  $sec.addClass('ef-faq');
  return $t.html($sec);
}

function buildService() {
  const out = join(OUT, 'szolgaltatas.html');
  if (!existsSync(out)) return console.log('SKIP: nincs szolgáltatás váz');
  const d = readService();
  const $ = cheerio.load(readFileSync(out, 'utf8'));

  // A forrás világos/sötét ritmusa: sötét hero → sötét „neked szól" →
  // világos állítás → világos I. pillér → SÖTÉT II. pillér → világos III.
  const blocks = [
    serviceHero(d.hero),
    audienceGrid(d.audience),
    efStatement({ ...d.statement, body: '', light: true }),
    pillarBlock(d.pillars[0], { light: true }),
    pillarBlock(d.pillars[1], { reverse: true }),
    pillarBlock(d.pillars[2], { light: true }),
    solutionSlider(d.solutions),
    timelineBlock({ ...d.process, steps: d.process.steps }),
    timelineBlock({ title: d.consult.title, img: d.consult.img, steps: d.consult.items, dark: true }),
    d.ctaBar ? efCtaBar({ ...d.ctaBar, light: true }) : '',
    faqBlock(d.faq),
  ].join('');

  replaceSections($, blocks);

  $('title').text('Szolgáltatás — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.lead);

  writeFileSync(out, $.html());
  console.log(`EF szolgaltatas.html: ${d.hero.logos.length} logó, ${d.audience.items.length} "neked szól", `
    + `${d.pillars.length} pillér (${d.pillars.map((p) => p.items.length).join('+')} eredmény), `
    + `${d.solutions.items.length} megoldás, ${d.process.steps.length} lépés, `
    + `${d.consult.items.length} konzultáció-pont, ${d.faq.items.length} GYIK`);
}

/* --------------------------------------------------------------------- */
/* Árak                                                                   */
/* --------------------------------------------------------------------- */
// Attila kérése: a businessnative.hu Árak-oldalának FELÉPÍTÉSE maradjon meg.
// A korábbi változat két hibában szenvedett: a sablon háromoszlopos rácsában
// állt a két csomag (a harmadik hely üresen tátongott 992px felett), és a
// forrás két nagy szekciója — a 12 soros összehasonlító tábla és a négy
// vállalás — teljesen kimaradt.

const PSRC = 'bn-src';

function readPricing() {
  const $ = cheerio.load(readFileSync(join(PSRC, 'pricing.html'), 'utf8'));
  const S = $('main').children();

  const plans = $('.plan').map((_, el) => {
    const $p = $(el);
    const qs = $p.find('.plan-q').map((__, e) => txt($(e).text())).get();
    const bodies = $p.find('.tone-subtle').map((__, e) => txt($(e).text())).get();
    const $price = $p.find('.text_body-bold').first();
    const note = txt($price.find('span').text());
    return {
      title: txt($p.find('h2').first().text()),
      qLabel: qs[0] || '',
      qBody: bodies[0] || '',
      items: $p.find('.plan_item').map((__, e) => txt($(e).text())).get(),
      whoLabel: qs[1] || '',
      whoBody: bodies[1] || '',
      price: txt($price.clone().find('span').remove().end().text()),
      priceNote: note.replace(/^[·•\s]+/, ''),
      cta: (() => {
        const $a = $p.find('a[href]').first();
        return $a.length ? { label: txt($a.text()), href: $a.attr('href') } : null;
      })(),
      featured: ($p.attr('class') || '').includes('is-with-bg'),
    };
  }).get();

  // összehasonlító tábla: 3 csoport × 4 sor, 2 oszlop
  const columns = $('.table-check_column-tiles').map((_, e) => txt($(e).text())).get();
  const groups = $('.table_grid').map((_, g) => {
    const $g = $(g);
    return {
      name: txt($g.prevAll('.separation-line').first().text())
        || txt($g.find('.separation-line').first().text()),
      rows: $g.find('.table_description-cell').map((__, c) => ({
        label: txt($(c).text()),
        cells: $(c).parent().find('.table_check-cell').map((___, x) => txt($(x).text())).get(),
      })).get(),
    };
  }).get();

  // „Ezt vállalom" — a forrásban 8 slide, ami 4 egyedi kártya duplázva
  const seen = new Set();
  const promises = S.eq(1).find('.w-slide').map((_, e) => {
    const t = txt($(e).text());
    const m = t.match(/^(.{3,30}?)\s*[„"](.+?)["”]/);
    return m ? { tag: txt(m[1]), text: txt(m[2]) } : null;
  }).get().filter((x) => x && !seen.has(x.tag) && seen.add(x.tag));

  return {
    h1: txt(S.eq(0).find('h1').first().text()),
    plans,
    divider: txt($('.wrap_divider-label').first().text()),
    table: { title: txt($('.comparison-table').find('[class*="heading"]').first().text()), columns, groups },
    promises: { title: txt(S.eq(1).find('h2, [class*="heading-style-h2"]').first().text()), items: promises },
    faq: {
      title: txt(S.eq(2).find('h2').first().text()),
      links: S.eq(2).find('.headline_faq a, [class*="headline"] a').map((_, a) => ({
        label: txt($(a).text()), href: $(a).attr('href'),
      })).get(),
      // A kérdés osztály NÉLKÜLI div-ben áll az .expandable-top első
      // gyerekeként — osztály-alapú szelektorral nem található meg.
      items: $('.section_faq-halves .expandable-single').map((_, e) => ({
        q: txt($(e).find('.expandable-top').children().first().text())
          || txt($(e).find('[class*="text-body-bold"], strong').first().text()),
        a: txt($(e).find('[class*="faq-paragraph"], p').first().text()),
      })).get().filter((x) => x.q),
    },
  };
}

// Összehasonlító tábla — a sablonban nincs ilyen komponens, ezért saját, de
// végig a sablon design-tokenjeivel. Mobilon kártyákká bomlik, hogy ne kelljen
// vízszintesen görgetni.
function comparisonTable(d) {
  const head = `<div class="bn-ct-row bn-ct-head">
    <div class="label-small bn-ct-key"></div>
    ${d.columns.map((c) => `<div class="text-large text-body-bold">${esc(c)}</div>`).join('')}
  </div>`;
  const groups = d.groups.map((g) => `
    <div class="bn-ct-group" data-bnm="rise">
      <div class="label-small bn-ct-groupname">${esc(g.name)}</div>
      ${g.rows.map((r) => `<div class="bn-ct-row">
        <div class="bn-ct-key label-small">${esc(r.label)}</div>
        ${r.cells.map((c, i) => `<div class="body-medium bn-ct-cell">`
    + `<span class="bn-ct-collabel label-small">${esc(d.columns[i] || '')}</span>`
    + `${esc(c)}</div>`).join('')}
      </div>`).join('')}
    </div>`).join('');
  const title = d.title
    ? `<h2 class="text-h4 no-margins bn-ct-title" data-bnm="rise">${esc(d.title)}</h2>` : '';
  return wrapSec(`${title}<div class="bn-ct" data-bnm-group>${head}${groups}</div>`, 'bn-ct-sec');
}

const wrapSec = (inner, cls = '') =>
  `<section class="section ${cls}"><div class="w-layout-blockcontainer main-container w-container">${inner}</div></section>`;

function buildPricing() {
  const out = join(OUT, 'arak.html');
  if (!existsSync(out)) return console.log('SKIP: nincs árak váz');
  const d = readPricing();
  const $ = cheerio.load(readFileSync(out, 'utf8'));

  /* 1. csomagkártyák a sablon .card-plan komponensébe */
  const t = tpl('pricing.html', '.hero-pricing-section');
  if (!t) return console.log('SKIP: nincs pricing sablon');
  const { $t, $sec } = t;
  $sec.find('h1').first().text(d.h1);
  $sec.find('.headline-pricing .body-medium, .headline-pricing-top-tile .body-medium').remove();

  const $cards = $sec.find('.card-plan');
  const cardHtml = $t.html($cards.first());
  const $grid = $cards.first().parent();
  $grid.empty();
  // A rács oszlopszáma a TÉNYLEGES csomagszámhoz igazodik — ez volt a lyukas
  // harmadik cella oka: a sablon 3 oszlopa maradt 2 kártyához.
  $grid.addClass(`bn-plans-${d.plans.length}`);
  d.plans.forEach((p) => {
    const $c = clone(cardHtml);
    $c.removeAttr('id').attr('data-bnm', 'rise');
    if (p.featured) $c.addClass('custom');
    $c.find('.plan-top-tile .text-large').first().text(p.title);
    // A sablon fejlécén egy célcsoport-címke ül („Szakembereknek"). A forrásban
    // ilyen nincs — a „Miben segít?" pedig kérdés-felirat, nem címke, ott
    // olvashatatlanul furcsa lenne. Inkább elhagyjuk.
    $c.find('.plan-tag').remove();
    $c.find('.price-wrap .text-h3').first().text(p.price);
    $c.find('.price-wrap .body-medium').first().text(p.priceNote);
    $c.find('.plan-price-tile').children().last().text(p.qBody);
    const $cta = $c.find('.cta-main').first();
    if (p.cta) $cta.attr('href', p.cta.href).attr('target', '_blank').attr('rel', 'noopener')
      .find('.button-text').first().text(p.cta.label);
    else $cta.remove();
    $c.find('.plan-bottom-tile .label-large').first().text('Tartalmazza');
    const $list = $c.find('.plan-list').first();
    const liHtml = $t.html($list.find('.plan-list-item').first());
    $list.empty();
    p.items.forEach((x) => {
      const $li = clone(liHtml);
      $li.find('div').last().text(x);
      $list.append($li);
    });
    // a kártya alján a „Kinek javaslom?" blokk
    $c.children('.text-small').last()
      .html(`<strong>${esc(p.whoLabel)}</strong> ${esc(p.whoBody)}`);
    $grid.append($c);
  });
  if (d.divider) {
    $grid.after(`<div class="bn-plans-note body-medium" data-bnm="rise">${esc(d.divider)}</div>`);
  }

  /* 2-4. tábla, vállalások, GYIK */
  const promises = d.promises.items.length ? wrapSec(
    `<div class="bn-promise-head"><h2 class="text-h3 no-margins" data-bnm="split">${esc(d.promises.title)}</h2></div>`
    + `<div class="bn-promise-grid" data-bnm-group>`
    + d.promises.items.map((p) => `<article class="bn-promise" data-bnm="rise">
        <div class="label-small bn-promise-tag">${esc(p.tag)}</div>
        <p class="text-large no-margins">${esc(p.text)}</p>
      </article>`).join('') + `</div>`, 'bn-promise-sec') : '';

  const blocks = $t.html($sec) + comparisonTable(d.table) + promises
    + faqBlock({ eyebrow: 'GYIK', title: d.faq.title, items: d.faq.items, links: d.faq.links });

  replaceSections($, blocks);

  $('title').text('Árak — Business Native');
  writeFileSync(out, $.html());
  console.log(`BN arak.html: ${d.plans.length} csomag (${d.plans.map((p) => p.items.length).join('+')} pont), `
    + `${d.table.groups.length} tábla-csoport / ${d.table.groups.reduce((s, g) => s + g.rows.length, 0)} sor, `
    + `${d.promises.items.length} vállalás, ${d.faq.items.length} GYIK`);
}

/* --------------------------------------------------------------------- */
/* Rólam                                                                  */
/* --------------------------------------------------------------------- */
// A forráson itt van a második blokk, amit Attila hiányolt: négy fül, és a
// kiválasztott fülhöz jobb oldalt megjelenik a hozzá tartozó kép. Ez a
// Modulabs sablon `.service-a-tabs-section` komponense (`.tabs-features`),
// és a natív Webflow-tab JS működik — ellentétben az IX2-animációkkal.

function readAbout() {
  const $ = cheerio.load(readFileSync(join(SRC, 'rolam.html'), 'utf8'));
  const S = $('body > section');

  return {
    hero: {
      title: txt(S.eq(0).find('h2').first().text()),
      eyebrow: txt(S.eq(0).find('[class*="label-small"]').first().text()),
      body: txt(S.eq(0).find('[class*="text-block"]').first().text()),
      img: imgOf($, S.eq(0)),
    },
    storyHead: {
      eyebrow: txt(S.eq(1).find('[class*="label-small"]').first().text()),
      title: txt(S.eq(1).find('[class*="text-h3"]').first().text()),
    },
    // 4 fül: cím + szöveg, panelenként saját kép
    story: $('[class*="tab-accordion"]').map((i, el) => {
      const $t = $(el);
      const $pane = $('[class*="tab-pane"]').eq(i);
      return {
        title: txt($t.find('strong').first().text()),
        desc: txt($t.find('[class*="acordion-text"], [class*="accordion-text"]').first().text()),
        img: localImg($pane.find('img').first().attr('src')),
      };
    }).get(),
    serve: {
      eyebrow: txt(S.eq(2).find('[class*="label-small"]').first().text()),
      title: txt(S.eq(2).find('[class*="text-h3"], h3').first().text()),
      // A bekezdések osztály NÉLKÜLI divekben állnak — osztály-alapú
      // szelektor nem találná meg őket, és a szekció szövege elveszne.
      body: S.eq(2).find('p, div').map((_, e) => {
        const $e = $(e);
        if ($e.children('div, p').length) return '';   // csak a levél-elemek
        return txt($e.text());
      }).get().filter((t) => t.length > 60).join(' '),
      img: imgOf($, S.eq(2)),
    },
    mission: {
      eyebrow: txt(S.eq(3).find('[class*="label-small"]').first().text()),
      title: txt(S.eq(3).text().replace(txt(S.eq(3).find('[class*="label-small"]').first().text()), '')),
    },
    faq: {
      title: txt(S.eq(4).find('h3, h2').first().text()),
      items: S.eq(4).find('[class*="expandable-single"]').map((_, e) => ({
        q: txt($(e).find('strong').first().text()),
        a: txt($(e).find('[class*="faq-paragraph"], p').first().text()),
      })).get().filter((x) => x.q),
    },
  };
}

// A sablon tabos blokkja: bal oldalt lenyíló fül-lista, jobb oldalt a
// kiválasztott fülhöz tartozó képpanel. Natív Webflow-tab, tehát MŰKÖDIK.
function storyTabs(items, head = {}) {
  const t = tpl('service/service-a.html', '.service-a-tabs-section');
  if (!t || !items.length) return '';
  const { $t, $sec } = t;

  // A sablon fejléce a saját marketingszövege („Segítünk a cégeknek…"). A
  // forrás tabos blokkjának VAN fejléce („AZ ÉN TÖRTÉNETEM" + cím), ezért
  // cseréljük, nem töröljük. Óvatosan: a `closest('div')` a fő konténert
  // vinné magával, és a blokk kiürülne.
  const $h2 = $sec.find('h2').first();
  $h2.nextAll('.body-medium').remove();
  if (head.title) {
    $h2.text(head.title).find('span').remove();
    // A sablon fejlécében nincs eyebrow-hely (csak a h2), ezért beszúrjuk —
    // a többi szekcióval azonos `.master-label` komponenssel.
    const $lbl = $h2.prevAll('.master-label').first();
    if (head.eyebrow) {
      if ($lbl.length) $lbl.find('.label-small').first().text(head.eyebrow);
      else $h2.before(`<div class="master-label"><div class="circle-label"></div>`
        + `<div class="label-small">${esc(head.eyebrow)}</div></div>`);
    } else $lbl.remove();
  } else {
    $h2.prevAll('.master-label').remove();
    $h2.remove();
  }

  const $links = $sec.find('.tab-accordion');
  const linkHtml = $t.html($links.first());
  const $menu = $links.first().parent();
  const $panes = $sec.find('.tab-pane-features');
  const paneHtml = $t.html($panes.first());
  const $content = $panes.first().parent();
  $menu.empty(); $content.empty();

  items.forEach((it, i) => {
    const name = `Story ${i + 1}`;
    // fül: a sablonban csak a rövid cím fér el (.label-small)
    const $l = clone(linkHtml);
    $l.attr('data-w-tab', name).attr('id', `w-tabs-story-tab-${i}`)
      .attr('href', `#w-tabs-story-pane-${i}`).attr('aria-controls', `w-tabs-story-pane-${i}`)
      .attr('aria-selected', i === 0 ? 'true' : 'false');
    if (i === 0) $l.addClass('w--current'); else $l.removeClass('w--current');
    $l.find('.label-small').first().text(it.title);
    $menu.append($l);

    // panel: kép + cím + leírás. A sablon képére egy termék-widget van
    // ráúsztatva, és alá egy CTA-gomb kerül — a forrásban egyik sincs.
    const $p = clone(paneHtml);
    $p.attr('data-w-tab', name).attr('id', `w-tabs-story-pane-${i}`)
      .attr('aria-labelledby', `w-tabs-story-tab-${i}`);
    if (i === 0) $p.addClass('w--tab-active'); else $p.removeClass('w--tab-active');
    $p.find('.overlay-with-image, .tab-widget').remove();
    $p.find('.cta-main').remove();
    setImg($p.find('.image-wrap-service-tab img').first(), it.img);
    $p.find('.text-h6').first().text(it.title);
    $p.find('.text-small').first().text(it.desc);
    $content.append($p);
  });
  $sec.addClass('ef-story');
  return $t.html($sec);
}

function buildAbout() {
  const out = join(OUT, 'rolam.html');
  if (!existsSync(out)) return console.log('SKIP: nincs rólam váz');
  const d = readAbout();
  const $ = cheerio.load(readFileSync(out, 'utf8'));

  const blocks = [
    // Az oldal címe H1 — a sablon h2-t adna, és az oldalnak nem lenne H1-e.
    efSplitMedia({ ...d.hero, cta: null, light: true, as: 'h1' }),
    storyTabs(d.story, d.storyHead),
    efSplitMedia({ ...d.serve, reverse: true, light: true }),
    efStatement({ eyebrow: d.mission.eyebrow, title: d.mission.title, body: '' }),
    faqBlock({ eyebrow: 'Rólam', title: d.faq.title, items: d.faq.items }),
  ].join('');

  replaceSections($, blocks);

  $('title').text('Rólam — Business Native');
  $('meta[name="description"], meta[property="og:description"]').attr('content', d.hero.body);
  writeFileSync(out, $.html());
  console.log(`EF rolam.html: ${d.story.length} történet-fül (kép: `
    + `${d.story.filter((s) => s.img).length}), ${d.faq.items.length} GYIK`);
}

/* --------------------------------------------------------------------- */
/* Kapcsolat                                                              */
/* --------------------------------------------------------------------- */
// Az Expert Flow forrásban nincs Kapcsolat oldal, ezért ez a businessnative.hu
// `contact-a` oldalából épül. A korábbi változat a leggyérebb oldal volt
// (3 szekció, űrlap nélkül) — pedig a forrásban van űrlap és Cal.com-beágyazás
// is. Backend nem kell hozzá: a forrás űrlapja `mailto:`-ra esik vissza.

const RAW_CONTACT = existsSync(join(PSRC, 'contact/contact-a.html'))
  ? readFileSync(join(PSRC, 'contact/contact-a.html'), 'utf8') : '';

function readContact() {
  const $ = cheerio.load(RAW_CONTACT);
  const S = $('main').children();
  // A cím <br>-rel tördelt („Kérdésed van?<br>Írj bátran") — a sima .text()
  // összeragasztaná a két sort.
  const h1Html = (S.eq(0).find('h1').first().html() || '')
    .replace(/<br\s*\/?>/gi, '\u0001').replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').trim().split('\u0001')
    .map((x) => esc(x.trim())).filter(Boolean).join('<br>');

  return {
    title: txt(S.eq(0).find('h1').first().text()),
    titleHtml: h1Html,
    lead: txt(S.eq(0).find('p, [class*="text-block"]').first().text()),
    // A csempe szerkezete: „Írj nekem <span>hello@businessnative.hu</span>" —
    // a cím a span ELŐTTI szöveg, a részlet a spanben. Ha mindkettőt a teljes
    // szövegből olvasnánk, a cím tartalmazná a részletet is (duplikáció).
    channels: $('[class*="info-tile"]').map((_, e) => {
      const $a = $(e).find('a').first();
      const $inner = $a.children().first();
      const $src = $inner.length ? $inner : $a;
      return {
        title: txt($src.clone().find('span').remove().end().text()),
        desc: txt($src.find('span').first().text()),
        href: $a.attr('href') || '',
      };
    }).get().filter((c) => c.title),
    form: {
      fields: $('form').first().find('input[placeholder], textarea[placeholder]')
        .map((_, e) => {
          const $e = $(e);
          return {
            name: $e.attr('name') || '',
            ph: $e.attr('placeholder') || '',
            // A felirat NEM <label> elem a forrásban, hanem egy osztályozott
            // div a mező előtt (`.text_input-label`) — a label-szelektor nem
            // találná meg, és a placeholder csúszna a helyére.
            label: txt($e.prev('[class*="label"]').text()) || txt($e.prev('label').text()),
            type: e.tagName === 'textarea' ? 'textarea' : ($e.attr('type') || 'text'),
          };
        }).get(),
      consent: txt($('form').first().find('label').first().text()),
      consentLinks: $('form').first().find('label a').map((_, a) => ({
        label: txt($(a).text()), href: $(a).attr('href'),
      })).get(),
      submit: txt($('form').first().find('[type="submit"], .cta_primary, button').first().text())
        || 'Üzenet küldése',
      note: txt($('#bn-mailnote').text()),
    },
    cal: {
      title: txt(S.eq(1).find('h2').first().text()),
      lead: txt(S.eq(1).find('p, [class*="tone"]').first().text()),
      // a Cal.com link-azonosító a beágyazó szkriptből
      // A beágyazás két azonosítót használ: a névteret (Cal("init", …)) és a
      // naptár-linket (calLink). Mindkettő a forrásból jön, nincs kitalálva.
      ns: (RAW_CONTACT.match(/Cal\(\s*["']init["']\s*,\s*["']([^"']+)["']/) || [])[1] || '',
      link: (RAW_CONTACT.match(/calLink:\s*["']([^"']+)["']/) || [])[1] || '',
    },
    faq: {
      title: txt(S.eq(3).find('h2').first().text()),
      // A forrásban a kérdések három fül alatt állnak, saját felirattal —
      // a fül-feliratok is tartalom, nem veszhetnek el.
      items: (() => {
        const tabs = $('.w-tab-link').map((_, e) => txt($(e).text())).get();
        const out = [];
        $('.w-tab-pane').each((ti, pane) => {
          $(pane).find('[class*="expandable-single"]').each((__, e) => {
            out.push({
              group: tabs[ti] || '',
              q: txt($(e).find('.expandable-top').children().first().text())
                || txt($(e).find('[class*="text-body-bold"], strong').first().text()),
              a: txt($(e).find('[class*="faq-paragraph"], p').first().text()),
            });
          });
        });
        return out.filter((x) => x.q);
      })(),
    },
  };
}

function buildContact() {
  const out = join(OUT, 'kapcsolat.html');
  if (!existsSync(out)) return console.log('SKIP: nincs kapcsolat váz');
  const d = readContact();
  const $ = cheerio.load(readFileSync(out, 'utf8'));

  const t = tpl('service/service-b.html', '.service-b-contact-section');
  let contactBlock = '';
  if (t) {
    const { $t, $sec } = t;
    // A sablon h2-t használ; ez az oldal fő címe, ezért H1-re cseréljük.
    const $h = $sec.find('h2').first();
    $h.replaceWith(`<h1 class="${$h.attr('class') || ''}">${d.titleHtml || esc(d.title)}</h1>`);
    const $lead = $sec.find('.headline-service-b-contact .body-medium').first();
    if (d.lead) $lead.text(d.lead); else $lead.remove();

    const $cards = $sec.find('.card-contact-c');
    const cardHtml = $t.html($cards.first());
    const $grid = $cards.first().parent();
    $grid.empty().attr('data-bnm-group', '');
    d.channels.forEach((ch) => {
      const $c = clone(cardHtml);
      $c.attr('data-bnm', 'rise');
      const $tx = $c.find('[class*="text-wrap"]').first();
      const inner = `<div class="text-large text-body-bold">${esc(ch.title)}</div>`
        + (ch.desc ? `<div class="body-medium">${esc(ch.desc)}</div>` : '');
      if ($tx.length) $tx.empty().append(inner); else $c.append(inner);
      if (ch.href) {
        const ext = ch.href.startsWith('http');
        $c.append(`<a class="bn-cta-link bnm-arrow" href="${ch.href}"`
          + `${ext ? ' target="_blank" rel="noopener"' : ''}>Megnyitom</a>`);
      }
      $grid.append($c);
    });

    // Az űrlap mezői, felirata és gombja a forrásból jönnek. A sablonban a
    // teljes mezőcsoport EGYETLEN `.contact-form-input-wrap`-ban ül, ezért a
    // legördülő eltávolításánál a közvetlen mezőburkolót kell célozni —
    // különben az egész űrlap kiürül.
    const $form = $sec.find('form').first().attr('id', 'bn-contact-form');
    // A sablon űrlap-fejlécének leírása („Válaszd ki a megkeresés típusát…")
    // a legördülőre utal, ami nálunk nincs — a forrásban sincs ilyen mondat.
    $sec.find('.contact-form-top-tile .text-small').remove();
    // A siker/hiba üzenetek szerveroldali beküldéshez valók; itt az űrlap a
    // levelezőprogramot nyitja meg, így ezek sosem jelennének meg.
    $sec.find('.success-message, .error-message, .w-form-done, .w-form-fail').remove();
    const $select = $form.find('select').first();
    if ($select.length) {
      // A forrásban nincs „tárgy" legördülő; a helyére a következő szöveges
      // mező kerül, hogy a sablon rácsa és térközei érintetlenek maradjanak.
      $select.closest('.select-field-overlay').length
        ? $select.closest('.select-field-overlay').replaceWith(
          '<input class="text-field w-input" type="text">')
        : $select.replaceWith('<input class="text-field w-input" type="text">');
    }

    const $inputs = $form.find('input:not([type="checkbox"]):not([type="submit"]):not(.cta-submit-invisible), textarea');
    d.form.fields.forEach((f, i) => {
      const $i = $inputs.eq(i);
      if (!$i.length) return;
      $i.attr('placeholder', f.ph).attr('name', f.name).attr('id', f.name);
      if (f.type === 'email') $i.attr('type', 'email');
      if (f.type === 'tel') $i.attr('type', 'tel');
    });
    // A feliratokat egységesen mi tesszük ki: a sablonban az első két mezőnek
    // egyáltalán nincs labelje (csak placeholder), a másik kettőé pedig más
    // helyen ül — így a forrás feliratai kiszámíthatóan a helyükre kerülnek.
    $form.find('.input-label').remove();
    d.form.fields.forEach((f, i) => {
      const $i = $inputs.eq(i);
      if (!$i.length || !(f.label || f.ph)) return;
      $i.before(`<div class="label-large input-label">${esc(f.label || f.ph)}</div>`);
    });
    // a fölös sablonmezők eltávolítása — a saját burkolójukkal együtt
    $inputs.slice(d.form.fields.length).each((_, el) => {
      const $w = $t(el).closest('.input-wrap-contact');
      ($w.length ? $w : $t(el)).remove();
    });
    const $consent = $form.find('.checkbox-contact label, label[class*="checkbox"]').first();
    if ($consent.length && d.form.consent) {
      let html = esc(d.form.consent);
      d.form.consentLinks.forEach((l) => {
        html = html.replace(esc(l.label),
          `<a href="${mapHref(l.href) || l.href}" target="_blank" rel="noopener">${esc(l.label)}</a>`);
      });
      $consent.html(html);
    }
    $form.find('[type="submit"]').attr('value', d.form.submit);
    $form.find('.cta-main .button-text, .submit-button').first().text(d.form.submit);
    if (d.form.note) {
      $form.append(`<p class="text-small ef-form-note">${esc(d.form.note)}</p>`);
    }
    $sec.addClass('ef-contact');
    contactBlock = $t.html($sec);
  }

  const cal = d.cal.ns ? `
  <section class="section ef-cal">
    <div class="w-layout-blockcontainer main-container w-container">
      <h2 class="text-h3 no-margins ef-cal-title" data-bnm="rise">${esc(d.cal.title)}</h2>
      ${d.cal.lead ? `<p class="body-medium ef-cal-lead" data-bnm="rise">${esc(d.cal.lead)}</p>` : ''}
      <div id="bn-cal-inline" class="ef-cal-embed" data-bnm="rise"></div>
    </div>
  </section>` : '';

  const blocks = contactBlock + cal
    + faqBlock({ eyebrow: 'GYIK', title: d.faq.title, items: d.faq.items });

  replaceSections($, blocks);

  // mailto-fallback + Cal.com beágyazás
  $('#bn-contact-js').remove();
  $('body').append(`<script id="bn-contact-js">
    (function(){
      var f=document.getElementById('bn-contact-form');
      if(f) f.addEventListener('submit',function(e){
        e.preventDefault();
        var d=new FormData(f), b=[];
        d.forEach(function(v,k){ if(v) b.push(k+': '+v); });
        window.location.href='mailto:hello@businessnative.hu?subject='
          + encodeURIComponent('Üzenet a weboldalról')
          + '&body=' + encodeURIComponent(b.join('\\n'));
      });
      ${d.cal.ns ? `
      (function(C,A,L){var p=function(a,ar){a.q.push(ar)};var d=C.document;C.Cal=C.Cal||function(){
        var cal=C.Cal;var ar=arguments;if(!cal.loaded){cal.ns={};cal.q=cal.q||[];
        d.head.appendChild(d.createElement("script")).src=A;cal.loaded=true}
        if(ar[0]===L){const api=function(){p(api,arguments)};const ns=ar[1];api.q=api.q||[];
        typeof ns==="string"?(cal.ns[ns]=cal.ns[ns]||api)&&p(cal.ns[ns],ar)&&p(cal,["initNamespace",ns]):p(cal,ar);return}
        p(cal,ar)};})(window,"https://app.cal.com/embed/embed.js","init");
      Cal("init","${d.cal.ns}",{origin:"https://cal.com"});
      Cal.ns["${d.cal.ns}"]("inline",{elementOrSelector:"#bn-cal-inline",
        config:{layout:"month_view"},calLink:"${d.cal.link}"});` : ''}
    })();
  </script>`);

  $('title').text('Kapcsolat — Business Native');
  writeFileSync(out, $.html());
  console.log(`BN kapcsolat.html: ${d.channels.length} csatorna, `
    + `Cal.com: ${d.cal.ns ? 'igen' : 'nem'}, ${d.faq.items.length} GYIK`);
}

buildHome();
buildService();
buildPricing();
buildAbout();
buildContact();
