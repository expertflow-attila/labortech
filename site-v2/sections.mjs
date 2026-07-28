// Business Native — szekció-komponensek a fő oldalakhoz.
//
// Miért létezik ez a fájl: a korábbi körben a négy fő oldal 24 szekciójából 17
// pontosan ugyanaz a minta volt (eyebrow + h2 + lead + kártyarács). A tartalom
// hiánytalanul átjött, a FORMA nem — ugyanaz a rács ismétlődött 19-szer az
// egész site-on. Itt minden szekció-típusnak saját ritmusa, rácsa és mozgása
// van, és a forrásoldal valódi viselkedését (sticky split, lépcsőzött csempe,
// scroll-idővonal) állítja helyre.
//
// A sablon design-tokenjeit használjuk (--spacing--*, --max-width--*, a
// 🎨-színtokenek), hogy a Modulabs vizuális rendszerén belül maradjunk.

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BORDER = 'var(--_🎨-color--tokens---border--subtle)';
const LIFT = 'var(--_🎨-color--tokens---background--lift)';
const BASE = 'var(--_🎨-color--tokens---background--base)';

export const wrap = (inner, extra = '') =>
  `<section class="section"${extra}><div class="w-layout-blockcontainer main-container w-container">${inner}</div></section>`;

// Eyebrow — a sablon `.master-label` komponense (pötty + kis címke).
export const eyebrow = (t) => (t
  ? `<div class="master-label"><div class="circle-label"></div><div class="label-small">${esc(t)}</div></div>`
  : '');

// Cím, amely scrollra szavanként világosodik ki (a forrás `stagger-text`-je).
export const splitTitle = (t, cls = 'text-h2') =>
  (t ? `<h2 class="${cls} no-margins" data-bnm="split">${esc(t)}</h2>` : '');

/* --------------------------------------------------------------------- */
/* 1. Lépcsőzött csempesor                                                */
/* --------------------------------------------------------------------- */
// A forrás főoldalán a 2. csempe -7.5rem-ről, a 3. -15rem-ről csúszott a
// helyére, ahogy a rács a nézetbe ért. Itt ugyanez, ScrollTriggerrel scrubolva.

export function stackRow({ eyebrow: eb, title, items }) {
  const tiles = items.map((it, i) => `
    <div class="bn-tile" data-bnm="stack" style="--i:${i}">
      <div class="bn-tile-num label-small">${String(i + 1).padStart(2, '0')}</div>
      <div class="text-h5 no-margins">${esc(it.title)}</div>
      <div class="body-medium">${esc(it.desc)}</div>
    </div>`).join('');
  return wrap(`
    <div class="bn-stack-head">${eyebrow(eb)}${splitTitle(title)}</div>
    <div class="bn-stack-grid" data-bnm-group="stack">${tiles}</div>`);
}

/* --------------------------------------------------------------------- */
/* 2. Sticky split — bal lista + jobb váltó panel                         */
/* --------------------------------------------------------------------- */
// EZ a blokk hiányzott a legjobban. A forráson a bal oldali háromelemű lista
// kattintós akkordeon volt, a jobb oldali illusztráció pedig statikus. Itt a
// scroll vezérli mindkettőt: ahogy a szekció elgördül, a bal lista aktív
// eleme lépked, és a jobb panel vele vált (a `motion.mjs` sync-blokkja).
// A `reverse` a forrás második blokkjának `.reverse` variánsa: oldalcsere.

export function syncSplit({ eyebrow: eb, title, lead, cta, items, reverse = false }) {
  const list = items.map((it, i) => `
    <button type="button" class="bn-sync-item${i === 0 ? ' is-active' : ''}"
      data-bnm-item role="tab" aria-selected="${i === 0}">
      <span class="bn-sync-item-top">
        <span class="label-small bn-sync-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="text-large text-body-bold">${esc(it.title)}</span>
      </span>
      <span class="bn-sync-item-desc"><span class="body-medium">${esc(it.desc)}</span></span>
    </button>`).join('');

  // A panel felirata csak a címet ismétli — a sorszám a bal listán már ott van,
  // kétszer kiírva zajos lenne.
  const panes = items.map((it) => `
    <figure class="bn-sync-pane" data-bnm-pane>
      ${it.img ? `<img src="${it.img}" alt="" loading="lazy" decoding="async">` : ''}
      <figcaption><span class="text-h5 no-margins">${esc(it.paneTitle || it.title)}</span></figcaption>
    </figure>`).join('');

  // A magasság adja a görgetési sávot: elemenként egy képernyőnyi olvasási idő.
  const vh = items.length * 90 + 60;
  return `
  <section class="section bn-sync${reverse ? ' is-reverse' : ''}" data-bnm="sync"
    style="--bn-sync-h:${vh}vh">
    <div class="bn-sync-sticky">
      <div class="w-layout-blockcontainer main-container w-container">
        <div class="bn-sync-grid">
          <div class="bn-sync-left">
            ${eyebrow(eb)}${splitTitle(title)}
            ${lead ? `<p class="body-medium bn-sync-lead">${esc(lead)}</p>` : ''}
            <div class="bn-sync-list" role="tablist">${list}</div>
            ${cta ? `<a href="${cta.href}" class="bn-cta-link bnm-arrow bn-sync-cta">${esc(cta.label)}</a>` : ''}
          </div>
          <div class="bn-sync-right">${panes}</div>
        </div>
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 3. Használati esetek — aszimmetrikus, eltolt rács                      */
/* --------------------------------------------------------------------- */
// A forráson ez slider volt (6 slide, automatika nélkül) — ott a hatodik eset
// gyakorlatilag láthatatlan maradt. Rácsban mind a hat egyszerre olvasható, a
// jobb oszlop eltolásával megtörve a gépies sorrendet.

const TEXTURES = ['amber', 'teal', 'violet', 'sage', 'peach', 'lavender'];

export function usecaseGrid({ eyebrow: eb, title, lead, items }) {
  const cards = items.map((it, i) => `
    <article class="bn-uc bnm-card" data-bnm="rise">
      <img class="bn-uc-bg" src="/assets/bn-bnx-smoke-${TEXTURES[i % TEXTURES.length]}.jpg"
        alt="" aria-hidden="true" loading="lazy" decoding="async">
      <div class="bn-uc-body">
        <div class="text-h3 no-margins bn-uc-head">${esc(it.title)}</div>
        ${it.desc ? `<p class="body-medium">${esc(it.desc)}</p>` : ''}
        ${it.tag ? `<div class="label-small bn-uc-tag">${esc(it.tag)}</div>` : ''}
      </div>
    </article>`).join('');
  return wrap(`
    <div class="bn-uc-head-wrap">${eyebrow(eb)}${splitTitle(title)}
      ${lead ? `<p class="body-medium" style="max-width:var(--max-width--7-columns)">${esc(lead)}</p>` : ''}</div>
    <div class="bn-uc-grid" data-bnm-group>${cards}</div>`);
}

/* --------------------------------------------------------------------- */
/* 4. Számsáv — nagy metrikák, felszámlálva                               */
/* --------------------------------------------------------------------- */
// A sablon `.about-numbers-section`-jének mintája: nagy szám, alatta címke,
// köztük vékony osztóvonal. A forráson ezek statikus szövegek voltak; itt a
// szám felszámlálódik (a DOM-ban a végérték áll, így JS nélkül is helyes).

export function numberBand({ eyebrow: eb, title, lead, stats, note, cta }) {
  const cells = stats.map((s) => `
    <div class="bn-num" data-bnm="rise">
      <div class="text-h1 no-margins bn-num-val" data-bnm="count">${esc(s.title)}</div>
      <div class="label-small bn-num-key">${esc(s.desc)}</div>
    </div>`).join('');
  return wrap(`
    <div class="bn-num-head">${eyebrow(eb)}${splitTitle(title)}
      ${lead ? `<p class="body-medium" style="max-width:var(--max-width--7-columns)">${esc(lead)}</p>` : ''}</div>
    <div class="bn-num-grid" data-bnm-group>${cells}</div>
    ${note || cta ? `<div class="bn-num-foot" data-bnm="rise">
      ${note ? `<p class="body-medium no-margins">${esc(note)}</p>` : ''}
      ${cta ? `<a href="${cta.href}" class="bn-cta-link bnm-arrow">${esc(cta.label)}</a>` : ''}
    </div>` : ''}`);
}

/* --------------------------------------------------------------------- */
/* 5. Kettős záró kártya — nagy kép, hover-zoom                           */
/* --------------------------------------------------------------------- */

export function duoCards({ eyebrow: eb, title, items }) {
  const cards = items.map((it, i) => `
    <a class="bn-duo bnm-card" href="${it.href}" data-bnm="clip">
      <img src="${it.img}" alt="" loading="lazy" decoding="async">
      <div class="bn-duo-body">
        <div class="text-h4 no-margins">${esc(it.title)}</div>
        ${it.desc ? `<p class="body-medium">${esc(it.desc)}</p>` : ''}
        <span class="bn-cta-link bnm-arrow">${esc(it.label || 'Megnézem')}</span>
      </div>
    </a>`).join('');
  return wrap(`
    <div class="bn-duo-head">${eyebrow(eb)}${splitTitle(title)}</div>
    <div class="bn-duo-grid" data-bnm-group>${cards}</div>`);
}

/* --------------------------------------------------------------------- */
/* A szekciók CSS-e                                                       */
/* --------------------------------------------------------------------- */

export const SECTIONS_CSS = `<style id="bn-sections">
  /* ---- Lépcsőzött csempesor ---- */
  .bn-stack-head{max-width:var(--max-width--8-columns);display:flex;flex-direction:column;
    gap:var(--spacing--24);margin-bottom:var(--spacing--64)}
  .bn-stack-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;
    background:${BORDER};border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER}}
  .bn-tile{background:${BASE};padding:var(--spacing--48) var(--spacing--32);
    display:flex;flex-direction:column;gap:var(--spacing--16)}
  .bn-tile-num{opacity:.45}
  @media (max-width:991px){.bn-stack-grid{grid-template-columns:1fr}}

  /* ---- Sticky split ---- */
  .bn-sync{padding:0}
  .bn-sync-sticky{padding:var(--spacing--80) 0}
  .bn-sync-grid{display:grid;grid-template-columns:5fr 1fr 6fr;align-items:center}
  .bn-sync-left{display:flex;flex-direction:column;gap:var(--spacing--24);
    grid-column:1;align-items:flex-start}
  /* A relatív pozíció KELL: a második paneltől kezdve a lapok egymásra
     kerülnek (position:absolute), és enélkül a viewporthoz igazodnának —
     teljes képernyős képet adva a szekció helyett. */
  .bn-sync-right{grid-column:3;min-width:0;position:relative}
  .bn-sync.is-reverse .bn-sync-left{grid-column:3}
  .bn-sync.is-reverse .bn-sync-right{grid-column:1}
  .bn-sync-lead{max-width:var(--max-width--6-columns);margin:0}
  .bn-sync-list{display:flex;flex-direction:column;width:100%;margin-top:var(--spacing--16);
    border-top:1px solid ${BORDER}}
  .bn-sync-item{appearance:none;background:none;border:0;border-bottom:1px solid ${BORDER};
    text-align:left;cursor:pointer;color:inherit;font:inherit;width:100%;
    padding:var(--spacing--20) 0;display:flex;flex-direction:column;gap:var(--spacing--8);
    opacity:.42;transition:opacity .45s ${'cubic-bezier(.22,1,.36,1)'},padding-left .45s ${'cubic-bezier(.22,1,.36,1)'}}
  .bn-sync-item.is-active{opacity:1;padding-left:var(--spacing--16)}
  .bn-sync-item:focus-visible{outline:2px solid currentColor;outline-offset:3px}
  .bn-sync-item-top{display:flex;align-items:baseline;gap:var(--spacing--12)}
  .bn-sync-idx{opacity:.5}
  /* A leírás csak az aktív elemen nyílik ki — grid-rows trükk, hogy ne kelljen
     fix magasságot tippelni, és mégis animálható legyen. */
  .bn-sync-item-desc{display:grid;grid-template-rows:0fr;overflow:hidden;
    transition:grid-template-rows .5s ${'cubic-bezier(.22,1,.36,1)'},opacity .4s;opacity:0;
    max-width:var(--max-width--6-columns)}
  .bn-sync-item.is-active .bn-sync-item-desc{grid-template-rows:1fr;opacity:1}
  .bn-sync-item-desc>*{min-height:0}
  .bn-sync-cta{margin-top:var(--spacing--8)}
  /* A sablon .label-small-ja 10px, csupa nagybetű — címkének jó, kattintható
     főcselekvésnek kevés. A szekció-CTA-k ezt a saját, olvasható méretet kapják. */
  .bn-cta-link{display:inline-flex;align-items:center;min-height:2.75rem;
    font-size:.9375rem;font-weight:600;letter-spacing:0;text-transform:none;
    text-decoration:none;color:inherit;border-bottom:1px solid currentColor;
    padding-bottom:.15em;line-height:1.3}
  .bn-cta-link:focus-visible{outline:2px solid currentColor;outline-offset:4px}
  .bn-sync-pane{margin:0;position:relative;border-radius:var(--_🔘-radius---general--large);
    overflow:hidden;background:${LIFT};border:1px solid ${BORDER};aspect-ratio:4/3.2}
  .bn-sync-pane img{width:100%;height:100%;object-fit:cover;display:block}
  .bn-sync-pane figcaption{position:absolute;left:0;right:0;bottom:0;
    padding:var(--spacing--32);display:flex;flex-direction:column;
    align-items:flex-start;text-align:left;
    background:linear-gradient(to top,rgba(10,10,11,.88),rgba(10,10,11,0));color:#f6f3ec}
  @media (min-width:992px){
    .bn-sync{height:var(--bn-sync-h)}
    .bn-sync-sticky{position:sticky;top:0;height:100vh;display:flex;align-items:center}
    /* Amíg a GSAP be nem kapcsol, minden panel egymás alatt látszik — így JS
       nélkül sem tűnik el tartalom. A bnm-fx-et a motion.mjs teszi fel.
       Bekapcsolás után MINDEN panel abszolút, és a méretet a konténer adja:
       ha csak a második paneltől lennének abszolútak, az első elrejtésekor a
       rács összeomlana, és a kép a viewportra feszülne. */
    .bnm-fx .bn-sync-right{aspect-ratio:4/3.2;max-height:68vh}
    .bnm-fx .bn-sync-pane{position:absolute;inset:0;aspect-ratio:auto}
  }
  @media (max-width:991px){
    .bn-sync-grid{grid-template-columns:1fr;gap:var(--spacing--48)}
    .bn-sync-left,.bn-sync-right,.bn-sync.is-reverse .bn-sync-left,
    .bn-sync.is-reverse .bn-sync-right{grid-column:1}
    .bn-sync-item{opacity:1;padding-left:0}
    .bn-sync-item-desc{grid-template-rows:1fr;opacity:1}
    .bn-sync-right{display:flex;flex-direction:column;gap:var(--spacing--16)}
    .bn-sync-sticky{padding:var(--spacing--64) 0}
  }

  /* ---- Használati esetek ---- */
  .bn-uc-head-wrap{max-width:var(--max-width--8-columns);display:flex;flex-direction:column;
    gap:var(--spacing--24);margin-bottom:var(--spacing--64)}
  .bn-uc-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--24)}
  /* Eltolt jobb oszlop: megtöri a gépies sorrendet, anélkül hogy a tartalom
     sorrendje (és a billentyűzetes bejárás) változna. FONTOS: margóval, nem
     transformmal — a reveal-animáció transform:none-ra vált befejezéskor,
     és az kilőné az eltolást. */
  @media (min-width:992px){.bn-uc-grid>*:nth-child(even){margin-top:var(--spacing--64)}}
  .bn-uc{position:relative;border-radius:var(--_🔘-radius---general--large);overflow:hidden;
    border:1px solid ${BORDER};min-height:19rem;display:flex;isolation:isolate}
  .bn-uc-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;
    opacity:.7}
  /* A fátyol alul erős (hogy a szöveg olvasható legyen), felül átlátszó — így
     a textúra színe megmarad, nem szürkül feketévé. */
  .bn-uc-body{padding:var(--spacing--32);display:flex;flex-direction:column;
    gap:var(--spacing--12);justify-content:flex-end;width:100%;
    background:linear-gradient(to top,rgba(10,10,11,.92) 22%,rgba(10,10,11,.55) 55%,
      rgba(10,10,11,.12));color:#f6f3ec}
  .bn-uc-head{max-width:14ch}
  .bn-uc-tag{opacity:.72;order:-1;margin-bottom:var(--spacing--4)}
  @media (max-width:991px){.bn-uc-grid{grid-template-columns:1fr}}

  /* ---- Számsáv ---- */
  .bn-num-head{max-width:var(--max-width--8-columns);display:flex;flex-direction:column;
    gap:var(--spacing--24);margin-bottom:var(--spacing--64)}
  .bn-num-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--spacing--32)}
  .bn-num{display:flex;flex-direction:column;gap:var(--spacing--12);
    padding-top:var(--spacing--24);border-top:1px solid ${BORDER}}
  /* A sablon .label-small-ja 10px + csupa nagybetű; egész mondatokra
     olvashatatlan (a forrás is felülírta a pricing-táblázatban). */
  .bn-num-key{opacity:.68;max-width:26ch;text-transform:none;letter-spacing:0;
    font-size:.875rem;line-height:1.5}
  .bn-num-foot{display:flex;flex-wrap:wrap;align-items:center;gap:var(--spacing--24);
    margin-top:var(--spacing--64);padding-top:var(--spacing--32);border-top:1px solid ${BORDER}}
  @media (max-width:767px){.bn-num-grid{grid-template-columns:1fr;gap:var(--spacing--48)}}

  /* ---- Kettős záró kártya ---- */
  .bn-duo-head{max-width:var(--max-width--8-columns);display:flex;flex-direction:column;
    gap:var(--spacing--24);margin-bottom:var(--spacing--64)}
  .bn-duo-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--24)}
  .bn-duo{position:relative;display:block;text-decoration:none;color:inherit;
    border-radius:var(--_🔘-radius---general--large);overflow:hidden;border:1px solid ${BORDER};
    background:${LIFT}}
  .bn-duo>img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}
  .bn-duo-body{padding:var(--spacing--32);display:flex;flex-direction:column;gap:var(--spacing--12)}
  .bn-duo:focus-visible{outline:2px solid currentColor;outline-offset:3px}
  @media (max-width:767px){.bn-duo-grid{grid-template-columns:1fr}}
</style>`;
