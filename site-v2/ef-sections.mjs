// Expert Flow forrásoldal — szekció-komponensek.
//
// Ezek a komponensek az `ef-src/` (Webflow, nagys-sublime-site-c0c265.webflow.io)
// oldal SAJÁT szekció-típusait képezik le a Modulabs sablon vizuális nyelvére.
//
// A korábbi két kör tanulsága, amit itt szabályként tartunk:
//   1. A képet NEM a generátor választja. Minden blokk azzal a képpel jön, ami
//      a forrásban hozzá tartozik — a hívó adja át, a forrásból kiolvasva.
//   2. A viselkedés is a forrásé: a „három legnagyobb kihívás" blokkon a bal
//      lista RAGAD, a jobb oldali panelek pedig elgörögnek mellette. Nem
//      kattintós akkordeon és nem is panelváltás.
//   3. A forrás világos és sötét szekciókat váltogat — ez adja a ritmusát.
//      A sablonban van kész `.light-mode` osztály (92 színtoken), azt használjuk.

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BORDER = 'var(--_🎨-color--tokens---border--subtle)';
const LIFT = 'var(--_🎨-color--tokens---background--lift)';

// A sablon light-mode-ja a szekcióra téve világos sávot ad — így áll elő a
// forrás világos/sötét ritmusa anélkül, hogy saját színeket találnánk ki.
const tone = (light) => (light ? ' light-mode ef-light' : '');

const container = (inner) =>
  `<div class="w-layout-blockcontainer main-container w-container">${inner}</div>`;

export const efEyebrow = (t) => (t
  ? `<div class="master-label"><div class="circle-label"></div><div class="label-small">${esc(t)}</div></div>`
  : '');

/* --------------------------------------------------------------------- */
/* 1. Hero + vízszintes képsáv                                            */
/* --------------------------------------------------------------------- */
// A forráson a hero alatt végtelen kép-marquee fut (6 fotó). A sablon
// IX2-marquee-je halott, ezért CSS-animáció hajtja (motion.mjs).

export function efHero({ title, lead, images }) {
  const strip = images.map((src) =>
    `<div class="ef-strip-item"><img src="${src}" alt="" loading="eager" decoding="async"></div>`).join('');
  return `
  <section class="section ef-hero light-mode ef-light">
    ${container(`
      <div class="ef-hero-head">
        <h1 class="text-h1 no-margins" data-bnm="rise">${esc(title)}</h1>
        ${lead ? `<p class="text-large ef-hero-lead" data-bnm="rise">${esc(lead)}</p>` : ''}
      </div>`)}
    <div class="ef-strip bnm-marquee">
      <div class="ef-strip-track bnm-marquee-track">${strip}${strip}</div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 2. Állítás-blokk                                                       */
/* --------------------------------------------------------------------- */
// Nagy, lélegző kijelentés, alatta kétoszlopos aljzat: bal oldalt címke,
// jobb oldalt a magyarázó bekezdés. A forrás 1fr .7fr rácsa.

export function efStatement({ title, eyebrow, body, light = false }) {
  return `
  <section class="section ef-statement${tone(light)}">
    ${container(`
      <h2 class="text-h4 no-margins ef-statement-title" data-bnm="split">${esc(title)}</h2>
      <div class="ef-statement-foot">
        <div>${efEyebrow(eyebrow)}</div>
        <p class="body-medium no-margins" data-bnm="rise">${esc(body)}</p>
      </div>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 3. Sticky lista + görgő képes panelek                                  */
/* --------------------------------------------------------------------- */
// A forrás viselkedése pontosan: `.tab-list-5 { position: sticky; top: 120px }`,
// mellette a panelek egymás alatt görögnek. Ehhez annyit teszünk hozzá, hogy a
// bal listán kiemelődik az éppen olvasott panel (scroll-spy, motion.mjs).

export function efStickyList({ eyebrow, title, items, light = false }) {
  const nav = items.map((it, i) => `
    <a class="ef-sticky-nav-item${i === 0 ? ' is-active' : ''}" href="#${it.id}" data-bnm-spy-nav>
      <span class="label-small">${esc(it.nav)}</span>
    </a>`).join('');

  const panels = items.map((it) => `
    <article class="ef-panel" id="${it.id}" data-bnm-spy-panel>
      ${it.img ? `<div class="ef-panel-media" data-bnm="clip">
        <img src="${it.img}" alt="" loading="lazy" decoding="async">
      </div>` : ''}
      <div class="ef-panel-text" data-bnm="rise">
        ${it.eyebrow ? `<div class="label-small ef-panel-eyebrow">${esc(it.eyebrow)}</div>` : ''}
        <h3 class="text-h5 no-margins">${esc(it.title)}</h3>
        <p class="body-medium no-margins">${esc(it.desc)}</p>
      </div>
    </article>`).join('');

  return `
  <section class="section ef-sticky${tone(light)}" data-bnm="spy">
    ${container(`
      <div class="ef-sticky-head">${efEyebrow(eyebrow)}
        <h2 class="text-h3 no-margins" data-bnm="split">${esc(title)}</h2></div>
      <div class="ef-sticky-grid">
        <nav class="ef-sticky-nav" aria-label="${esc(eyebrow || 'Szakaszok')}">${nav}</nav>
        <div class="ef-panels">${panels}</div>
      </div>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 4. Kétoszlopos kép + szöveg                                            */
/* --------------------------------------------------------------------- */

export function efSplitMedia({ img, eyebrow, title, body, cta, reverse = false, light = false, as = 'h2' }) {
  return `
  <section class="section ef-split${reverse ? ' is-reverse' : ''}${tone(light)}">
    ${container(`
      <div class="ef-split-grid">
        <div class="ef-split-media" data-bnm="clip">
          <img src="${img}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="ef-split-text" data-bnm="rise">
          ${efEyebrow(eyebrow)}
          <${as} class="text-h3 no-margins">${esc(title)}</${as}>
          <p class="body-medium no-margins">${esc(body)}</p>
          ${cta ? `<a href="${cta.href}" class="bn-cta-link bnm-arrow">${esc(cta.label)}</a>` : ''}
        </div>
      </div>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 5. Sticky lista + kártyák (sötét)                                      */
/* --------------------------------------------------------------------- */
// A forráson az első kártya kétszer olyan magas, és csak neki van fotója —
// ezt a ritmust megtartjuk. A többi tömör felületű, ikonnal.

export function efStickyCards({ eyebrow, title, navItems, cards }) {
  const nav = navItems.map((n, i) => `
    <a class="ef-sticky-nav-item${i === 0 ? ' is-active' : ''}" href="#${n.id}" data-bnm-spy-nav>
      <span class="label-small">${esc(n.label)}</span>
    </a>`).join('');

  const list = cards.map((c) => `
    <article class="ef-card${c.img ? ' has-media' : ''}" id="${c.id}" data-bnm-spy-panel data-bnm="rise">
      ${c.img ? `<img class="ef-card-bg" src="${c.img}" alt="" loading="lazy" decoding="async">` : ''}
      <div class="ef-card-body">
        ${c.icon ? `<div class="ef-card-icon" aria-hidden="true">${c.icon}</div>` : ''}
        <div class="text-large text-body-bold">${esc(c.title)}</div>
        <p class="body-medium no-margins">${esc(c.desc)}</p>
      </div>
    </article>`).join('');

  return `
  <section class="section ef-cards" data-bnm="spy">
    ${container(`
      <div class="ef-cards-grid">
        <div class="ef-cards-left">
          ${efEyebrow(eyebrow)}
          <h2 class="text-h3 no-margins" data-bnm="split">${esc(title)}</h2>
          <nav class="ef-sticky-nav" aria-label="${esc(eyebrow || 'Szakaszok')}">${nav}</nav>
        </div>
        <div class="ef-cards-right">${list}</div>
      </div>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 6. Pillér-rács (checklistákkal)                                        */
/* --------------------------------------------------------------------- */

export function efPillars({ title, lead, items, light = false }) {
  const cards = items.map((it) => `
    <article class="ef-pillar" data-bnm="rise">
      <div class="ef-pillar-top">
        <div class="text-large text-body-bold">${esc(it.title)}</div>
        <div class="label-small ef-pillar-tag">${esc(it.tag)}</div>
      </div>
      <p class="body-medium ef-pillar-lead">${esc(it.desc)}</p>
      ${it.listTitle ? `<div class="label-small ef-pillar-listtitle">${esc(it.listTitle)}</div>` : ''}
      <ul role="list" class="ef-checklist w-list-unstyled">
        ${it.items.map((x) => `<li class="ef-check"><span class="ef-check-mark" aria-hidden="true"></span>
          <span>${esc(x)}</span></li>`).join('')}
      </ul>
    </article>`).join('');
  return `
  <section class="section ef-pillars${tone(light)}">
    ${container(`
      <div class="ef-pillars-head">
        <h2 class="text-h2 no-margins" data-bnm="rise">${esc(title)}</h2>
        ${lead ? `<p class="body-medium ef-pillars-lead" data-bnm="rise">${esc(lead)}</p>` : ''}
      </div>
      <div class="ef-pillars-grid" data-bnm-group>${cards}</div>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* 7. CTA-sáv                                                             */
/* --------------------------------------------------------------------- */

export function efCtaBar({ label, href, light = false }) {
  return `
  <section class="section ef-ctabar${tone(light)}">
    ${container(`<a href="${href}" class="bn-cta-link bnm-arrow ef-ctabar-link" data-bnm="rise">${esc(label)}</a>`)}
  </section>`;
}

/* --------------------------------------------------------------------- */
/* CSS                                                                    */
/* --------------------------------------------------------------------- */

export const EF_CSS = `<style id="ef-sections">
  /* A sablon .light-mode osztálya 92 színtokent ír felül. A szekcióra téve
     világos sávot ad — ettől kapja meg az oldal a forrás világos/sötét ritmusát.
     A háttérszínt expliciten is kitesszük, mert a .section maga átlátszó. */
  .ef-light{background:var(--_🎨-color--tokens---background--base);
    color:var(--_🎨-color--tokens---text-body--strong)}

  /* ---- A sablon saját .capabilities-section blokkja ---- */
  /* A markup a sablonból jön változatlanul; itt csak két dolgot teszünk hozzá.
     1) Olvashatóság: a sablon overlay-e szinte átlátszó (#100f120a), mert a
        sablon saját fotói sötétek voltak. A mi képeink világosabbak, ezért a
        szöveg mögé fokozatos sötétítés kell — a kép így is látszik. */
     A sablon a szöveget a kártya ALJÁRA teszi (az ikon kerül felülre), ezért
     alulról sötétítünk erősen, felül csak annyira, hogy az ikon megüljön. */
  .capabilities-section .overlay-card-feature.full{
    background-image:linear-gradient(to top,rgba(10,10,11,.9) 0%,
      rgba(10,10,11,.62) 28%,rgba(10,10,11,.12) 62%,rgba(10,10,11,.34) 100%)}
  /* A sablon overlay-e space-between: ikon felül, szöveg alul. Ahol a
     forrásban nincs ikon (a „három kihívás" paneljei), ott a szöveg egyedüli
     gyerekként FELÜLRE csúszna — a sötétítés viszont alulról jön. Leküldjük. */
  .capabilities-section .overlay-card-feature.full > .text-wrap-card-feature:only-child{
    margin-top:auto}
  /* 2) Scroll-spy kiemelés: a sablon csak .w--current-re emel ki (horgony-
        kattintásra), görgetésre nem történne semmi. */
  .capabilities-section .tab-item{opacity:.5;
    transition:padding-left .4s cubic-bezier(.22,1,.36,1),opacity .4s cubic-bezier(.22,1,.36,1)}
  .capabilities-section .tab-item.is-active{padding-left:20px;opacity:1}
  @media (prefers-reduced-motion:reduce){
    .capabilities-section .tab-item{transition:none}}

  /* ---- Hero ---- */
  /* A navigáció fixen ül a lap tetején — enélkül a hero címe alácsúszik. */
  .ef-hero{padding-top:clamp(7.5rem,11vw,11rem);padding-bottom:0;overflow:clip}
  .ef-hero-head{max-width:var(--max-width--8-columns);margin:0 auto;text-align:center;
    display:flex;flex-direction:column;gap:var(--spacing--24);align-items:center}
  .ef-hero-lead{max-width:52ch;opacity:.72}
  .ef-strip{margin-top:var(--spacing--80);width:100%}
  .ef-strip-track{gap:var(--spacing--16)}
  .ef-strip-item{flex:none;width:clamp(15rem,26vw,26rem);aspect-ratio:7/5;
    border-radius:var(--_🔘-radius---general--large);overflow:hidden}
  .ef-strip-item img{width:100%;height:100%;object-fit:cover;display:block}

  /* ---- Állítás-blokk ---- */
  .ef-statement-title{max-width:22ch}
  .ef-statement-foot{display:grid;grid-template-columns:1fr .7fr;gap:var(--spacing--48);
    margin-top:var(--spacing--64);padding-top:var(--spacing--32);border-top:1px solid ${BORDER}}
  @media (max-width:767px){.ef-statement-foot{grid-template-columns:1fr;gap:var(--spacing--24)}}

  /* ---- Sticky lista + görgő panelek ---- */
  .ef-sticky-head{display:flex;flex-direction:column;gap:var(--spacing--24);
    max-width:var(--max-width--8-columns);margin-bottom:var(--spacing--80)}
  .ef-sticky-grid{display:grid;grid-template-columns:1fr 2fr;gap:var(--spacing--80)}
  .ef-sticky-nav{position:sticky;top:120px;display:flex;flex-direction:column;
    align-self:start;border-top:1px solid ${BORDER}}
  .ef-sticky-nav-item{display:flex;align-items:center;min-height:3rem;
    padding:var(--spacing--12) 0;border-bottom:1px solid ${BORDER};
    text-decoration:none;color:inherit;opacity:.45;
    transition:opacity .4s cubic-bezier(.22,1,.36,1),padding-left .4s cubic-bezier(.22,1,.36,1)}
  .ef-sticky-nav-item.is-active{opacity:1;padding-left:var(--spacing--16)}
  .ef-sticky-nav-item:focus-visible{outline:2px solid currentColor;outline-offset:3px}
  .ef-panels{display:flex;flex-direction:column;gap:var(--spacing--80);min-width:0}
  .ef-panel{scroll-margin-top:9rem;display:grid;grid-template-columns:1fr 1fr;
    gap:var(--spacing--32);align-items:center}
  .ef-panel-media{border-radius:var(--_🔘-radius---general--large);overflow:hidden;
    aspect-ratio:4/5;background:${LIFT}}
  .ef-panel-media img{width:100%;height:100%;object-fit:cover;display:block}
  .ef-panel-text{display:flex;flex-direction:column;gap:var(--spacing--16)}
  .ef-panel-eyebrow{opacity:.6}
  @media (max-width:991px){
    .ef-sticky-grid{grid-template-columns:1fr;gap:var(--spacing--48)}
    .ef-sticky-nav{position:static;flex-direction:row;flex-wrap:wrap;gap:var(--spacing--8);
      border-top:0}
    .ef-sticky-nav-item{opacity:1;padding-left:0;border-bottom:0;
      border:1px solid ${BORDER};border-radius:var(--_🔘-radius---general--full);
      padding:var(--spacing--8) var(--spacing--16);min-height:2.75rem}
    .ef-sticky-nav-item.is-active{padding-left:var(--spacing--16);
      background:${LIFT}}
    .ef-panel{grid-template-columns:1fr;gap:var(--spacing--24)}
    .ef-panel-media{aspect-ratio:16/10}}

  /* ---- Kétoszlopos kép + szöveg ---- */
  .ef-split-grid{display:grid;grid-template-columns:.8fr 1fr;gap:var(--spacing--80);
    align-items:center}
  .ef-split.is-reverse .ef-split-media{order:2}
  .ef-split-media{border-radius:var(--_🔘-radius---general--large);overflow:hidden;
    aspect-ratio:4/5;background:${LIFT}}
  .ef-split-media img{width:100%;height:100%;object-fit:cover;display:block}
  .ef-split-text{display:flex;flex-direction:column;gap:var(--spacing--20);align-items:flex-start}
  @media (max-width:991px){
    .ef-split-grid{grid-template-columns:1fr;gap:var(--spacing--32)}
    .ef-split.is-reverse .ef-split-media{order:0}
    .ef-split-media{aspect-ratio:16/11}}

  /* ---- Sticky kártyák (sötét sáv) ---- */
  .ef-cards{border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER}}
  .ef-cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--64)}
  .ef-cards-left{position:sticky;top:120px;align-self:start;max-width:28rem;
    display:flex;flex-direction:column;gap:var(--spacing--24)}
  .ef-cards-left .ef-sticky-nav{margin-top:var(--spacing--16)}
  .ef-cards-right{display:flex;flex-direction:column;gap:var(--spacing--16);min-width:0}
  .ef-card{position:relative;border-radius:var(--_🔘-radius---general--large);
    overflow:hidden;background:${LIFT};min-height:20rem;display:flex;
    align-items:flex-end;scroll-margin-top:9rem;isolation:isolate}
  /* A forráson az egyetlen fotós kártya kétszer olyan magas — ez a ritmus
     tartja meg a blokk hierarchiáját. */
  .ef-card.has-media{min-height:39rem}
  .ef-card-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1}
  /* A fotós kártyán a szöveg a képre kerül — a fátyolnak elég erősnek kell
     lennie ahhoz, hogy arcok fölött is olvasható maradjon. */
  .ef-card.has-media .ef-card-body{padding-top:var(--spacing--64);
    background:linear-gradient(to top,rgba(10,10,11,.94) 45%,rgba(10,10,11,.7) 70%,
      rgba(10,10,11,0))}
  .ef-card-body{padding:var(--spacing--32);display:flex;flex-direction:column;
    gap:var(--spacing--12);width:100%}
  .ef-card-icon{width:24px;height:24px;opacity:.7;margin-bottom:var(--spacing--8)}
  .ef-card-icon svg{width:100%;height:100%;display:block}
  @media (max-width:991px){
    .ef-cards-grid{grid-template-columns:1fr;gap:var(--spacing--32)}
    .ef-cards-left{position:static;max-width:none}
    .ef-card.has-media{min-height:26rem}}

  /* ---- Pillérek ---- */
  .ef-pillars-head{text-align:center;max-width:var(--max-width--8-columns);margin:0 auto;
    display:flex;flex-direction:column;gap:var(--spacing--20);align-items:center}
  .ef-pillars-lead{max-width:56ch;opacity:.72}
  .ef-pillars-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--spacing--16);
    margin-top:var(--spacing--64)}
  .ef-pillar{border:1px solid ${BORDER};border-radius:var(--_🔘-radius---general--large);
    padding:var(--spacing--32);display:flex;flex-direction:column;gap:var(--spacing--16);
    background:${LIFT}}
  .ef-pillar-top{display:flex;align-items:center;justify-content:space-between;
    gap:var(--spacing--12)}
  .ef-pillar-tag{opacity:.6;white-space:nowrap}
  .ef-pillar-lead{margin:0}
  .ef-pillar-listtitle{opacity:.6;padding-top:var(--spacing--16);border-top:1px solid ${BORDER}}
  .ef-checklist{display:flex;flex-direction:column;gap:var(--spacing--12);margin:0;padding:0}
  .ef-check{display:flex;gap:var(--spacing--12);align-items:flex-start;font-size:.9375rem;
    line-height:1.5}
  /* Pipa CSS-ből, hogy ne kelljen 9 db azonos SVG-t a markupba ismételni. */
  .ef-check-mark{flex:none;width:1.125rem;height:1.125rem;margin-top:.15em;border-radius:50%;
    border:1px solid ${BORDER};position:relative}
  .ef-check-mark::after{content:"";position:absolute;left:.3rem;top:.28rem;width:.3rem;
    height:.5rem;border:solid currentColor;border-width:0 1.5px 1.5px 0;
    transform:rotate(45deg);opacity:.8}
  @media (max-width:991px){.ef-pillars-grid{grid-template-columns:1fr}}

  /* ---- CTA-sáv ---- */
  .ef-ctabar{text-align:center}
  .ef-ctabar-link{font-size:1.0625rem}

  /* ===================== Szolgáltatás oldal ===================== */
  /* A szekciók a sablon saját blokkjaiból épülnek; itt csak az illesztés van. */

  /* Hero: sötét sáv, széles kép, alatta logósáv. */
  .ef-service-hero{padding-bottom:0}
  .ef-hero-media{margin-top:var(--spacing--64);border-radius:var(--_🔘-radius---general--large);
    overflow:hidden;aspect-ratio:16/7;background:${LIFT}}
  .ef-hero-media img{width:100%;height:100%;object-fit:cover;display:block}
  .ef-logos{margin-top:var(--spacing--80);padding-bottom:var(--spacing--80)}
  .ef-logos-track{gap:clamp(3rem,7vw,7rem);align-items:center}
  .ef-logo{flex:none;height:1.5rem;display:flex;align-items:center}
  .ef-logo img{height:100%;width:auto;object-fit:contain;opacity:.62;display:block}

  /* „Neked szól, ha:" — a sablon kártyarácsa, nagy sorszámokkal. */
  .ef-audience .card-contact{height:auto;min-height:0;justify-content:flex-start;
    gap:var(--spacing--16)}
  .ef-aud-num{opacity:.42}

  /* Pillérek — a sablon column-halves blokkja. */
  .ef-pillar-sec .column-halves{align-items:center}
  /* Tükrözés: a középső pillérnél a kép a másik oldalra kerül, ahogy a
     forrásban. Csak a vizuális sorrend fordul, a DOM-sorrend marad, hogy a
     billentyűzetes bejárás és a felolvasó logikus maradjon. */
  @media (min-width:992px){
    .ef-pillar-sec .column-halves.ef-rev .image-wrap-column{order:2}}
  .ef-list-title{opacity:.6;margin-top:var(--spacing--32);
    padding-top:var(--spacing--24);border-top:1px solid ${BORDER}}
  .ef-pillar-sec .plan-list{margin-top:var(--spacing--16)}
  .ef-pillar-sec .image-wrap-column{border-radius:var(--_🔘-radius---general--large);
    overflow:hidden}

  /* Megoldás-slider — a forrás kártyáin nincs kép, csak cím + szöveg.
     A sablon kártyája a fotóhoz volt méretezve; kép nélkül az overlay abszolút
     marad, és a kártya alja üresen tátong. Ezért: statikus overlay, tartalom-
     vezérelt magasság, egységes minimum a slide-ok között. */
  .ef-solutions .card-feature{background:${LIFT};border:1px solid ${BORDER};
    height:auto;min-height:14rem;display:flex}
  .ef-solutions .overlay-card-feature{background-image:none;position:static;
    padding:var(--spacing--32);display:flex;flex-direction:column;
    justify-content:flex-start;width:100%;height:auto}
  .ef-solutions .text-wrap-card-feature{display:flex;flex-direction:column;
    gap:var(--spacing--12)}
  /* A slider maszkja is a fotós kártyamagassághoz volt szabva — kép nélkül
     üres sáv maradna a kártyák alatt. */
  .ef-solutions .slider,.ef-solutions .mask-features,
  .ef-solutions .slide-feature{height:auto;min-height:0}

  /* Idővonal. Kép nélküli változatban egy oszlop marad. */
  .ef-timeline .image-wrap-timeline{border-radius:var(--_🔘-radius---general--large);
    overflow:hidden}
  @media (min-width:992px){
    .ef-timeline .timeline-halves.ef-tl-nomedia{grid-template-columns:1fr}}
  .ef-timeline .headline-timeline{display:flex;flex-direction:column;
    gap:var(--spacing--20);align-items:flex-start}
  .ef-tl-dark{background:var(--_🎨-color--tokens---background--lift)}

  /* ===================== Árak oldal ===================== */
  /* A csomagrács oszlopszáma a TÉNYLEGES csomagszámhoz igazodik. A sablon
     három oszlopa két csomagnál üresen hagyta a harmadik cellát 992px felett —
     ez volt a legláthatóbb elrendezési hiba az oldalon. */
  .pricing-thirds.bn-plans-2{grid-template-columns:1fr 1fr}
  .pricing-thirds.bn-plans-1{grid-template-columns:minmax(0,32rem)}
  @media (max-width:767px){.pricing-thirds.bn-plans-2{grid-template-columns:1fr}}
  .bn-plans-note{text-align:center;margin-top:var(--spacing--32);opacity:.72;
    max-width:var(--max-width--7-columns);margin-left:auto;margin-right:auto}
  .card-plan .plan-bottom-tile .label-large{opacity:.6}
  /* A sablon ára rövid volt („$9,000 / hónap"), a miénk sávos és hosszú
     („400 000 – 999 000 Ft”) — egy sorban a megjegyzés mellé tördelve kusza.
     A megjegyzés külön sorba kerül, az ár mérete a hosszhoz igazodik. */
  .card-plan .price-wrap{flex-wrap:wrap;align-items:baseline;
    gap:var(--spacing--8) var(--spacing--12)}
  .card-plan .price-wrap .text-h3{font-size:clamp(1.75rem,2.6vw,2.25rem);line-height:1.1}
  .card-plan .price-wrap .body-medium{flex:1 0 100%;opacity:.66}
  .card-plan > .text-small strong{display:block;margin-bottom:var(--spacing--4);opacity:.7}

  /* Összehasonlító tábla — a sablonban nincs ilyen komponens, ezért saját,
     de végig a sablon tokenjeivel. Asztali nézetben rács, mobilon kártyák
     (címkézett cellákkal), hogy ne kelljen vízszintesen görgetni. */
  .bn-ct-title{margin-bottom:var(--spacing--48);max-width:var(--max-width--8-columns)}
  .ef-faq-links{display:flex;flex-wrap:wrap;gap:var(--spacing--24);margin-top:var(--spacing--24)}
  .bn-ct{display:flex;flex-direction:column;gap:var(--spacing--48)}
  .bn-ct-row{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:var(--spacing--24);
    padding:var(--spacing--16) 0;border-bottom:1px solid ${BORDER};align-items:start}
  .bn-ct-head{border-bottom:1px solid ${BORDER};padding-bottom:var(--spacing--16)}
  .bn-ct-key{opacity:.62}
  .bn-ct-group{display:flex;flex-direction:column}
  .bn-ct-groupname{opacity:.5;padding:var(--spacing--16) 0;letter-spacing:.08em}
  .bn-ct-collabel{display:none;opacity:.55;margin-bottom:var(--spacing--4)}
  @media (max-width:767px){
    .bn-ct-head{display:none}
    .bn-ct-row{grid-template-columns:1fr;gap:var(--spacing--12);
      padding:var(--spacing--20) 0}
    .bn-ct-key{font-size:.9375rem;text-transform:none;letter-spacing:0;opacity:1;
      font-weight:600}
    .bn-ct-collabel{display:block}
    .bn-ct-cell{padding-left:var(--spacing--12);
      border-left:2px solid ${BORDER}}}

  /* Vállalások — négy egyenrangú kártya (a forrásban slider, ahol a 4.-et
     szinte senki nem látta volna). */
  .bn-promise-head{max-width:var(--max-width--8-columns);margin-bottom:var(--spacing--48)}
  .bn-promise-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--16)}
  .bn-promise{border:1px solid ${BORDER};border-radius:var(--_🔘-radius---general--large);
    padding:var(--spacing--32);display:flex;flex-direction:column;gap:var(--spacing--16);
    background:${LIFT}}
  .bn-promise-tag{opacity:.6}
  @media (max-width:767px){.bn-promise-grid{grid-template-columns:1fr}}


  /* ===================== Kapcsolat oldal ===================== */
  /* A fix navigáció alá csúszna a cím. */
  .ef-contact{padding-top:clamp(7.5rem,11vw,11rem)}
  .ef-contact .headline-service-b-contact{text-align:center;margin-bottom:var(--spacing--64)}
  .ef-contact .card-contact-c{display:flex;flex-direction:column;gap:var(--spacing--12);
    height:auto;min-height:0}
  .ef-contact .contact-features{gap:var(--spacing--16)}
  .ef-cal-title{margin-bottom:var(--spacing--16)}
  .ef-cal-lead{margin:0 0 var(--spacing--32);opacity:.72;
    max-width:var(--max-width--7-columns)}
  .ef-form-note{margin-top:var(--spacing--16);opacity:.6}
  /* A GYIK fülfeliratai csoportcímként, hogy a forrás tagolása megmaradjon. */
  .ef-faq-group{opacity:.55;letter-spacing:.08em;
    margin:var(--spacing--32) 0 var(--spacing--12);padding-top:var(--spacing--16);
    border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
  .ef-faq-group:first-child{margin-top:0;padding-top:0;border-top:0}
  /* A Cal.com beágyazás saját görgetősávot kap, hogy ne feszítse szét az
     oldalt kis kijelzőn. */
  .ef-cal-embed{width:100%;height:44rem;max-height:80vh;overflow:auto;
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--large)}
  @media (max-width:767px){.ef-cal-embed{height:38rem}}

  /* ===================== Rólam: történet-fülek ===================== */
  /* A sablon tabos blokkja natív Webflow-tab, tehát ténylegesen működik —
     ellentétben az IX2-animációkkal. */
  .ef-story .tab-accordion{cursor:pointer}
  .ef-story .image-wrap-service-tab{border-radius:var(--_🔘-radius---general--large);
    overflow:hidden}

  /* GYIK — natív <details>, a sablon vizuális osztályaival.
     A sablon a nyitást Webflow-interakcióval animálta volna, de az hiányzik a
     lokális másolatból (ellenőrizve: a válasz magassága 0 marad kattintásra).
     Itt a böngésző natív lenyílója végzi a munkát. */
  .ef-faq .tab-menu-faq{display:flex;flex-direction:column;width:100%}
  .ef-acc{display:block;width:100%}
  .ef-acc>summary{list-style:none;cursor:pointer;width:100%}
  .ef-acc>summary::-webkit-details-marker{display:none}
  .ef-acc>summary::marker{content:""}
  .ef-acc>summary:focus-visible{outline:2px solid currentColor;outline-offset:4px}
  /* A sablon a zárt állapotot 0 magassággal oldotta meg — nyitva ezt fel kell
     oldani, különben a <details> kinyílna, de a válasz nem látszana. */
  .ef-acc .expandable-bottom{height:auto;overflow:visible;
    padding-bottom:var(--spacing--24)}
  .ef-acc:not([open]) .expandable-bottom{display:none}
  /* A plusz-ikon függőleges szára nyitáskor eltűnik → mínusz lesz belőle. */
  .ef-acc .faq-vertical{transition:transform .35s cubic-bezier(.22,1,.36,1),opacity .35s}
  .ef-acc[open] .faq-vertical{transform:rotate(90deg);opacity:0}
  @media (prefers-reduced-motion:reduce){.ef-acc .faq-vertical{transition:none}}
</style>`;
