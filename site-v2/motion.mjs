// Business Native — mozgás-réteg.
//
// Miért külön fájl: a sablon saját animációi HALOTTAK. A Webflow IX2/IX3
// interakció-definíciói (`wf-ix-data`) nincsenek a lokális crawlban, csak a
// 113 db `data-w-id` attribútum és a futtatókörnyezet. Ezért a marquee nem
// mozog, a flip-kártya nem fordul, a gomb szövegmaszkja nem csúszik. A
// mozgást tehát nekünk kell megírni — a motor viszont adott: a sablon minden
// oldalon betölti a GSAP 3.15-öt és a (fizetős) SplitText plugint.
// A ScrollTrigger nem volt köztük, azt az npm-csomagból emeltük ki:
// `public/assets/bn-scrolltrigger.min.js`.
//
// KÉTRÉTEGŰ FELÉPÍTÉS — szándékos:
//   1. Belépők (rise/clip) → CSS transition + IntersectionObserver.
//      Nem függ a GSAP-tól. Ha bármi elhasal, a tartalom LÁTHATÓ marad.
//   2. Scroll-vezérelt effektek (split-cím, stack, count, sync) → GSAP +
//      ScrollTrigger. Ha ezek nem futnak le, a `bnm-fx` osztály sem kerül fel,
//      és a CSS eleve látható alapállapotot ad.
// A rejtést MINDIG a JS kapcsolja be (`html.bnm` / `html.bnm-fx`), sosem a
// statikus CSS — ez a tanulság a korábbi körből: tartalom nem tűnhet el.

// Egységes mozgás-nyelv. Anti-slop szabályok: nincs `linear`/default ease,
// csak transform+opacity (GPU), stagger 0.08s, minden reveal egyszer fut.
export const EASE_CSS = 'cubic-bezier(.22,1,.36,1)';

export const BNM_CSS = `<style id="bn-motion-css">
  /* ---- 1. réteg: belépők (CSS + IntersectionObserver) ---- */
  .bnm [data-bnm="rise"]{opacity:0;transform:translate3d(0,28px,0);will-change:opacity,transform}
  /* Az !important itt nem lustaság: a sablon Webflow-interakciós motorja
     FUTÁSIDŐBEN tesz inline opacity:0-t bizonyos osztályokra (pl.
     .expandable-single), az animáció-definíciója viszont hiányzik a lokális
     másolatból, így soha nem venné le. Inline stílust csak !important üt. */
  .bnm [data-bnm="rise"].is-in{opacity:1 !important;transform:none !important;
    transition:opacity .75s ${EASE_CSS},transform .75s ${EASE_CSS}}
  /* Képfelfedés maszkkal — a clip-path nem layout-művelet, GPU-n fut. */
  .bnm [data-bnm="clip"]{clip-path:inset(0 0 100% 0);will-change:clip-path}
  .bnm [data-bnm="clip"].is-in{clip-path:inset(0 0 0 0);opacity:1 !important;
    transition:clip-path 1s ${EASE_CSS}}
  .bnm [data-bnm="clip"] img{transform:scale(1.06);transition:transform 1.2s ${EASE_CSS}}
  .bnm [data-bnm="clip"].is-in img{transform:none}

  /* ---- 2. réteg: scroll-vezérelt (GSAP + ScrollTrigger) ---- */
  /* Csak akkor rejt, ha a GSAP tényleg elindult (bnm-fx). */
  .bnm-fx [data-bnm="split"] .bnm-w{opacity:.12}
  .bnm-fx [data-bnm="stack"]{will-change:transform}

  /* ---- Végtelen logósáv ---- */
  /* A sablon marquee-je IX2-vel mozgott volna; itt tiszta CSS, a tartalom
     duplázva, így a -50% ponton varrat nélkül ismétlődik. */
  .bnm-marquee{overflow:clip;position:relative}
  .bnm-marquee-track{display:flex;width:max-content;animation:bnm-scroll 42s linear infinite}
  .bnm-marquee:hover .bnm-marquee-track{animation-play-state:paused}
  @keyframes bnm-scroll{to{transform:translate3d(-50%,0,0)}}
  /* Széli elhalványítás, hogy a sáv ne vágódjon el élesen. */
  .bnm-marquee::before,.bnm-marquee::after{content:"";position:absolute;top:0;bottom:0;
    width:12%;z-index:2;pointer-events:none}
  .bnm-marquee::before{left:0;background:linear-gradient(to right,
    var(--_🎨-color--tokens---background--base),transparent)}
  .bnm-marquee::after{right:0;background:linear-gradient(to left,
    var(--_🎨-color--tokens---background--base),transparent)}

  /* ---- Mikro-interakció: gomb-nyíl ---- */
  /* A forrás .rl-diary::before mintája: a nyíl balról siklik be, a szöveg
     nem ugrik, mert a max-width animál 0-ról. */
  .bnm-arrow{display:inline-flex;align-items:center;gap:0}
  .bnm-arrow::after{content:"→";max-width:0;opacity:0;overflow:hidden;
    transform:translate3d(-6px,0,0);
    transition:max-width .35s ${EASE_CSS},opacity .35s ${EASE_CSS},
      margin-left .35s ${EASE_CSS},transform .35s ${EASE_CSS}}
  .bnm-arrow:hover::after,.bnm-arrow:focus-visible::after{
    max-width:1.4em;opacity:1;margin-left:.4em;transform:none}

  /* ---- Kártya-hover: képzoom + fátyol ---- */
  .bnm-card{position:relative;overflow:hidden}
  .bnm-card img{transition:transform .9s ${EASE_CSS}}
  .bnm-card:hover img,.bnm-card:focus-within img{transform:scale(1.06)}

  /* ---- Reduced motion: minden nyugton marad ---- */
  @media (prefers-reduced-motion:reduce){
    .bnm [data-bnm="rise"],.bnm [data-bnm="clip"]{opacity:1 !important;
      transform:none !important;clip-path:none !important;transition:none}
    .bnm [data-bnm="clip"] img{transform:none;transition:none}
    .bnm-fx [data-bnm="split"] .bnm-w{opacity:1}
    .bnm-marquee-track{animation:none}
    .bnm-card img{transition:none}
    .bnm-arrow::after{transition:none}
  }
</style>`;

// A ScrollTrigger a GSAP után, a saját szkriptünk előtt kell.
export const BNM_SCRIPTS = `<script src="/assets/bn-scrolltrigger.min.js"></script>`;

export const BNM_JS = `<script id="bn-motion-js">
(function () {
  var RM = window.matchMedia('(prefers-reduced-motion:reduce)');
  var root = document.documentElement;

  /* ---------- 1. réteg: belépők. GSAP-tól függetlenül fut. ---------- */
  (function reveals() {
    var els = document.querySelectorAll('[data-bnm="rise"],[data-bnm="clip"]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    root.classList.add('bnm');
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        // Stagger a testvérek között — a csoport tagjai sorban lépnek be,
        // nem egyszerre pattannak. 6 elem után nincs további késleltetés,
        // különben a hosszú listák alja érezhetően késne.
        var g = el.closest('[data-bnm-group]');
        if (g) {
          var sibs = g.querySelectorAll('[data-bnm="rise"],[data-bnm="clip"]');
          var i = [].indexOf.call(sibs, el);
          el.style.transitionDelay = Math.min(i, 6) * 80 + 'ms';
        }
        // A sablon interakció-motorja inline opacity/transform kezdőállapotot
        // tehetett rá, amit már soha nem venne le — takarítjuk.
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });

    // Biztonsági háló: gyors görgetés, display:none-ból előkerülő elem,
    // vagy IO-hiba esetén se maradjon rejtve semmi.
    function safety() {
      document.querySelectorAll('[data-bnm]:not(.is-in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight + 240) el.classList.add('is-in');
      });
    }
    window.addEventListener('scroll', safety, { passive: true });
    setTimeout(safety, 1400);
  })();

  /* ---------- Scroll-spy: sticky lista + görgő panelek ---------- */
  // A forrás viselkedése annyi, hogy a bal lista ragad, a panelek elgörögnek
  // mellette. Ez a réteg teszi hozzá, hogy a listán kiemelődjön, épp melyik
  // panelt olvasod. GSAP-tól függetlenül fut, és reduced motion alatt is
  // működik — nem animáció, hanem tájékozódási segítség.
  (function spy() {
    document.querySelectorAll('[data-bnm="spy"]').forEach(function (sec) {
      var navs = sec.querySelectorAll('[data-bnm-spy-nav]');
      var panels = sec.querySelectorAll('[data-bnm-spy-panel]');
      if (!navs.length || navs.length !== panels.length) return;
      if (!('IntersectionObserver' in window)) return;

      function mark(i) {
        navs.forEach(function (n, k) {
          n.classList.toggle('is-active', k === i);
          if (k === i) n.setAttribute('aria-current', 'true');
          else n.removeAttribute('aria-current');
        });
      }
      // A viewport felső harmadában lévő panel számít „olvasottnak" — így a
      // kiemelés akkor vált, amikor a panel a képernyő közepére ér.
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          mark([].indexOf.call(panels, en.target));
        });
      }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
      panels.forEach(function (p) { io.observe(p); });
    });
  })();

  if (RM.matches) return;              // innentől minden csak dísz
  var g = window.gsap, ST = window.ScrollTrigger;
  if (!g || !ST) return;               // GSAP nélkül marad az 1. réteg
  g.registerPlugin(ST);
  root.classList.add('bnm-fx');

  /* ---------- Cím: szavankénti felfedés, scrollra scrubolva ---------- */
  // A forrás stagger-text effektje. SplitText-tel, ha van; ha nincs,
  // kézzel tördelünk szavakra — a hatás ugyanaz.
  document.querySelectorAll('[data-bnm="split"]').forEach(function (el) {
    var words;
    if (window.SplitText) {
      words = new window.SplitText(el, { type: 'words', wordsClass: 'bnm-w' }).words;
    } else {
      // A <br> megőrzése fontos: a hero-címek kézzel vannak sorokra tördelve.
      el.innerHTML = el.innerHTML.split(/(<br\\s*\\/?>)/i).map(function (part) {
        if (/^<br/i.test(part)) return part;
        return part.replace(/\\S+/g, '<span class="bnm-w" style="display:inline-block">$&</span>');
      }).join('');
      words = el.querySelectorAll('.bnm-w');
    }
    if (!words || !words.length) return;
    g.to(words, {
      opacity: 1, stagger: 0.05, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 60%', scrub: 0.8 },
    });
  });

  /* ---------- Lépcsőzött csempék ---------- */
  // A forrás főoldalán a 2. csempe -7.5rem-ről, a 3. -15rem-ről ért a helyére.
  // Csak asztali nézetben: kis kijelzőn egymás alatt állnak, ott értelmetlen.
  var mm = g.matchMedia();
  mm.add('(min-width: 992px)', function () {
    document.querySelectorAll('[data-bnm-group="stack"]').forEach(function (grp) {
      var tiles = grp.querySelectorAll('[data-bnm="stack"]');
      tiles.forEach(function (t, i) {
        if (!i) return;
        g.from(t, {
          y: i * -120, ease: 'none',
          scrollTrigger: { trigger: grp, start: 'top bottom', end: 'top 45%', scrub: 0.6 },
        });
      });
    });
  });

  /* ---------- Számláló ---------- */
  // Blur-in + felszámlálás. A szám a DOM-ban a VÉGÉRTÉKKEL áll, így ha a
  // szkript elhal, a helyes érték látszik — nem ragad 0-n.
  document.querySelectorAll('[data-bnm="count"]').forEach(function (el) {
    var raw = el.textContent.trim();
    var m = raw.match(/^([^0-9]*)([0-9][0-9\\s.,]*)(.*)$/);
    if (!m) return;
    var target = parseFloat(m[2].replace(/[\\s.,]/g, ''));
    if (!isFinite(target)) return;
    var pre = m[1], post = m[3], o = { v: 0 };
    g.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
      .from(el, { filter: 'blur(8px)', opacity: 0.3, duration: 0.7, ease: 'power2.out' })
      .to(o, {
        v: target, duration: 1.3, ease: 'power2.out',
        onUpdate: function () { el.textContent = pre + Math.round(o.v).toLocaleString('hu-HU') + post; },
        onComplete: function () { el.textContent = raw; },
      }, 0.1);
  });

  /* ---------- Sticky split: bal lista + jobb váltó panel ---------- */
  // EZ a kulcsblokk. A forráson a jobb oldali illusztráció statikus volt, a
  // bal lista pedig kattintós akkordeon. Itt a SCROLL az egyetlen igazság-
  // forrás: ahogy a szekció elgördül, a bal lista aktív eleme lépked, és a
  // jobb panel vele vált. Kattintásra odagördítünk — nincs kétféle állapot,
  // amit szinkronban kéne tartani.
  mm.add('(min-width: 992px)', function () {
    document.querySelectorAll('[data-bnm="sync"]').forEach(function (sec) {
      var items = sec.querySelectorAll('[data-bnm-item]');
      var panes = sec.querySelectorAll('[data-bnm-pane]');
      var n = Math.min(items.length, panes.length);
      if (n < 2) return;
      var cur = -1;

      function show(i) {
        if (i === cur) return;
        cur = i;
        items.forEach(function (it, k) {
          it.classList.toggle('is-active', k === i);
          it.setAttribute('aria-selected', k === i ? 'true' : 'false');
        });
        panes.forEach(function (p, k) {
          if (k === i) {
            p.hidden = false;
            g.fromTo(p, { opacity: 0, y: 18 },
              { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
          } else {
            p.hidden = true;
          }
        });
      }
      show(0);

      ST.create({
        trigger: sec, start: 'top top', end: 'bottom bottom',
        onUpdate: function (self) {
          // A sáv két végén hagyunk ráhagyást, hogy az első és az utolsó
          // panel is kapjon teljes olvasási időt.
          var p = (self.progress - 0.08) / 0.84;
          show(Math.max(0, Math.min(n - 1, Math.floor(p * n))));
        },
      });

      items.forEach(function (it, i) {
        it.addEventListener('click', function () {
          var st = sec.offsetTop, h = sec.offsetHeight - window.innerHeight;
          window.scrollTo({ top: st + h * (0.08 + (i + 0.5) / n * 0.84), behavior: 'smooth' });
        });
      });
    });
  });

  // A képek betöltése után a szekció-magasságok változhatnak.
  window.addEventListener('load', function () { ST.refresh(); });
})();
</script>`;
