// Business Native — közös segédek a generátoroknak.
// Azért külön fájl, hogy a Tudástár-oldalak (generate.mjs) és a Tudástár-appok
// (generate-apps.mjs) ugyanazt a vázat és ugyanazt a CSS-t használják.

import * as cheerio from 'cheerio';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const OUT = 'public';
export const CAL = 'https://cal.com/attila-nagy-hjau8q/egyeni-konzultacio';
export const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();

// A careers.html sablonváz: hero + kártyarács. A sablon saját szekcióit
// (rólunk-blokk, kapcsolat-kártyák) kivesszük, hogy ne maradjon idegen tartalom.
export function tdShell(h1, lead) {
  const $ = cheerio.load(readFileSync(join(OUT, 'careers.html'), 'utf8'));
  $('.careers-about-section, .contact-seciton').remove();
  $('.hero-careers-section').find('h1').first().text(h1);
  $('.hero-careers-section').find('.body-medium').first().text(lead);
  return $;
}

export const hasShell = () => existsSync(join(OUT, 'careers.html'));

// A cikkváz jobb oldali tartalomjegyzéke. FIGYELEM: a sablonban a tételek NEM
// <a> elemek, hanem `.link-content-table` divek — ezért nem elég az `a`-kra
// keresni, különben csendben a sablon fix címei (Kihívás/Megközelítés/…)
// maradnak az oldalon. Itt a törzs H2-iből építjük, valódi ugrólinkekkel.
export function buildToc($, $body) {
  const $toc = $('.cms-content-table');
  if (!$toc.length) return 0;
  const $tpl = $toc.find('.link-content-table').first();
  const heads = $body.find('h2').toArray();
  if (!$tpl.length || !heads.length) { $toc.remove(); return 0; }

  const tplHtml = $.html($tpl);
  $toc.empty();
  heads.forEach((h, i) => {
    const id = `szakasz-${i + 1}`;
    $(h).attr('id', id);
    const $item = cheerio.load(tplHtml, null, false).root().children().first();
    $item.find('.label-small').first().text(txt($(h).text()));
    $toc.append(`<a href="#${id}" class="bn-toc-link">${$.html($item)}</a>`);
  });
  return heads.length;
}

export const TD_CSS = `<style id="bn-tudastar">
  .card-job.is-static{height:auto;min-height:0}
  .card-job.is-static .job-font-view{gap:var(--spacing--24)}
  .contact-grid.bn-tools{grid-template-columns:1fr 1fr 1fr}
  .contact-grid.bn-cols-2{grid-template-columns:1fr 1fr}
  .contact-grid.bn-cols-2 .card-contact:not(:nth-child(2n+1)){
    border-left:1px solid var(--_🎨-color--tokens---border--subtle)}
  .contact-grid.bn-cols-2 .card-contact:nth-child(n+3){
    border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
  /* A sablon .card-contact „space-between"-je fix magassághoz készült; nálunk
     tartalom-vezérelt a kártya, így a rövid szövegek alatt 150-180px lyuk
     maradt. Felülről indul a tartalom, a link tapad az aljára. */
  .contact-grid.bn-tools .card-contact{height:auto;min-height:0;
    justify-content:flex-start;gap:var(--spacing--24)}
  .contact-grid.bn-tools .card-contact .bn-card-link{margin-top:auto}
  /* Osztóvonalak: a sorok közé vízszintes, az oszlopok közé függőleges.
     A rejtett (szűrt) kártyákat a nth-child is számolja, ezért a szűrt
     rácsokon a JS teszi ki az osztályt — ott ez a szabály nem fut. */
  .contact-grid.bn-tools:not(.bn-filtered) .card-contact:nth-child(n+4){
    border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
  .contact-grid.bn-tools:not(.bn-filtered) .card-contact:not(:nth-child(3n+1)){
    border-left:1px solid var(--_🎨-color--tokens---border--subtle)}
  .contact-grid.bn-tools .card-contact.bn-row-sep{
    border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
  .contact-grid.bn-tools .card-contact.bn-col-sep{
    border-left:1px solid var(--_🎨-color--tokens---border--subtle)}
  /* A leckeoldalak heroja kétoszlopos rács; a bélyegkép törlése után a jobb
     fele üresen tátongott 992px felett. */
  .cms-hero-halves.bn-single{grid-template-columns:1fr}
  /* A Tudástár-hub kártyáin ugyanaz a space-between-lyuk. */
  .card-job.is-static .job-font-view{justify-content:flex-start}
  .bn-tabs{display:flex;flex-wrap:wrap;gap:var(--spacing--8);
    margin-bottom:var(--spacing--32)}
  .bn-tab{padding:var(--spacing--8) var(--spacing--16);cursor:pointer;
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--default);
    background:var(--_🎨-color--tokens---background--base);
    color:inherit;font:inherit}
  .bn-tab.is-active{background:var(--_🎨-color--tokens---background--lift)}
  .bn-hidden{display:none}
  /* A kártyák akciólinkje a sablon 10px-es címke-stílusát örökölte — az egy
     kattintható elemhez kevés, mobilon pedig érinthetetlen. */
  .bn-card-link{font-size:.8125rem;letter-spacing:.02em;text-transform:none;
    display:inline-flex;align-items:center;min-height:2rem}
  @media (max-width:767px){.bn-card-link{min-height:2.75rem}}
  /* Leckeoldalak törzse: a hosszú prompt-sablonok és széles táblázatok
     nem feszíthetik szét a szövegoszlopot — saját görgetősávot kapnak. */
  .cms-body-left pre{white-space:pre-wrap;word-break:break-word;overflow-x:auto;
    max-width:100%;padding:var(--spacing--16);
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--default)}
  .cms-body-left img,.cms-body-left svg{max-width:100%;height:auto}
  .cms-body-left .bn-shot{max-height:38rem;overflow-y:auto;
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--default)}
  .cms-body-left .bn-shot img{display:block;width:100%}
  .cms-body-left table{display:block;overflow-x:auto;max-width:100%}
  /* A sablon tartalomjegyzéke 10px-es, csupa nagybetűs címkékre készült
     („KIHÍVÁS"), nálunk viszont teljes mondatok állnak benne — ott az
     olvashatatlan. Normál méret és kis-nagybetű. */
  .bn-toc-link{display:block;color:inherit;text-decoration:none}
  .bn-toc-link:hover .label-small{opacity:1}
  .cms-content-table .label-small{
    font-size:.8125rem;line-height:1.45;letter-spacing:0;text-transform:none;opacity:.8}
  .cms-body-left h2{scroll-margin-top:6rem}
  /* Mobilon a fejléc- és láblécsávok linkjei 23px magasak voltak; érintésre kicsi.
     A rövid linkeknél elég a sormagasság, a tartalomjegyzék viszont teljes
     mondatokat tartalmaz — ott a line-height szétdobná a törött sorokat,
     ezért flex + min-height. */
  @media (max-width:767px){
    .nav-link,.footer-legal-link,.footer-columns a{
      display:flex;min-height:2.75rem;align-items:center}
    .bn-toc-link{display:flex;align-items:center;min-height:2.75rem}
    .cms-content-table .label-small{line-height:1.45}
    .bn-tab{min-height:2.75rem;display:inline-flex;align-items:center}
    a.text-underline{min-height:2.75rem;display:inline-flex;align-items:center}
    /* A sablon gombjai és ikonlinkjei 20–38px magasak — ujjal ez kevés.
       A 44px az általánosan ajánlott minimum érintési célméret. */
    .cta-main,.cta-small,.button-book,.brand-nav,.brand-footer,
    .tab-link-cms,.tab-item,.tab-accordion,.link-social,.button-slider{
      min-height:2.75rem;display:inline-flex;align-items:center}
    .link-social{min-width:2.75rem;justify-content:center}
    /* A lenyíló GYIK fejléce a teljes sávot lefedi, hogy könnyű legyen eltalálni. */
    summary.expandable-top{min-height:2.75rem}
  }
  /* Beúszás a generált szekciókra, hogy a mozgás egységes legyen a sablon
     saját scroll-animációival. A rejtés CSAK akkor lép életbe, ha a JS
     felrakta a bn-motion osztályt — így JS nélkül sem tűnik el tartalom. */
  .bn-motion .bn-reveal{opacity:0;transform:translateY(14px);
    transition:opacity .55s cubic-bezier(.22,.61,.36,1),transform .55s cubic-bezier(.22,.61,.36,1)}
  .bn-motion .bn-reveal.is-in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){
    .bn-motion .bn-reveal{opacity:1;transform:none;transition:none}}
  .bn-group{margin-bottom:var(--spacing--64)}
  .bn-group-title{margin:0 0 var(--spacing--24)}
  .bn-lesson-num{opacity:.6}
  @media (max-width:991px){.contact-grid.bn-tools{grid-template-columns:1fr 1fr}}
  @media (max-width:991px){
    .contact-grid.bn-tools .card-contact:not(:nth-child(3n+1)){border-left:0}
    .contact-grid.bn-tools:not(.bn-filtered) .card-contact:not(:nth-child(2n+1)){
      border-left:1px solid var(--_🎨-color--tokens---border--subtle)}}
  @media (max-width:767px){
    .contact-grid.bn-tools{grid-template-columns:1fr}
    .contact-grid.bn-tools .card-contact{min-height:0;border-left:0 !important}
    /* Egy oszlopban MINDEN kártya új sor, ezért az elsőt kivéve mindegyikhez
       kell elválasztó — az nth-child(n+4) (3 oszlopra szabott) itt semmit nem
       adna, és a 3-kártyás szekciók egybefolynának. */
    .contact-grid.bn-tools .card-contact:not(:first-child){
      border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
    .cms-body-left .bn-shot{max-height:60vh}}
</style>`;

// Beúszás-vezérlés. A `bn-motion` osztályt maga a szkript teszi fel, ezért ha
// a JS nem fut le, a tartalom egyszerűen látható marad — nem tűnik el.
export const MOTION_JS = `<script>
  (function () {
    var els = document.querySelectorAll('.bn-reveal');
    if (!els.length || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('bn-motion');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var sibs = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = Math.min(sibs, 5) * 70 + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    // Biztonsági háló: ha bármi a nézetben maradt rejtve (gyors görgetés,
    // szűrés, display:none-ból előkerülő elem), megmutatjuk.
    function bnSafety() {
      document.querySelectorAll('.bn-reveal:not(.is-in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight + 200) el.classList.add('is-in');
      });
    }
    window.addEventListener('scroll', bnSafety, { passive: true });
    setTimeout(bnSafety, 1200);
  })();
</script>`;

export const TD_JS = `<script>
  // A szűrt rácson a nth-child a rejtett kártyákat is számolja, ezért az
  // osztóvonalakat a látható sorrend alapján tesszük ki.
  function bnSeps() {
    document.querySelectorAll('.contact-grid.bn-filtered').forEach(function (g) {
      var cols = window.matchMedia('(max-width:767px)').matches ? 1
        : window.matchMedia('(max-width:991px)').matches ? 2 : 3;
      var vis = [].filter.call(g.children, function (c) { return !c.classList.contains('bn-hidden'); });
      vis.forEach(function (c, i) {
        c.classList.toggle('bn-row-sep', i >= cols);
        c.classList.toggle('bn-col-sep', cols > 1 && i % cols !== 0);
      });
    });
  }
  window.addEventListener('resize', bnSeps);
  document.addEventListener('DOMContentLoaded', bnSeps);
  bnSeps();
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.bn-tab');
    if (!t) return;
    var cat = t.getAttribute('data-cat');
    document.querySelectorAll('.bn-tab').forEach(function (b) {
      b.classList.toggle('is-active', b === t);
    });
    document.querySelectorAll('.card-contact[data-cat]').forEach(function (c) {
      var show = c.getAttribute('data-cat') === cat;
      c.classList.toggle('bn-hidden', !show);
      // a rejtett kártyákra nem futott le a beúszás — megjelenéskor azonnal láthatóvá tesszük
      if (show) c.classList.add('is-in');
    });
    bnSeps();
  });
</script>`;
