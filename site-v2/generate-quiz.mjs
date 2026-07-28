// Szegmentáló kvíz → a V2 (Modulabs) arculatában.
//
// A kvíz eredetileg külön Next.js app (`~/dev/expertflow-quiz`), saját
// „Chronicle" design-tokenekkel. Itt statikus oldalként épül újra, a Modulabs
// sablon tipográfiájával, színeivel és gombjaival — hogy a V2 oldalain belül
// ne érződjön idegen felületnek.
//
// A KÉRDÉSEK NEM KÉZZEL VANNAK ÁTMÁSOLVA: a generátor a kvíz-app forrásából
// (`lib/quiz-data.ts`) olvassa ki őket, így ha ott változik egy kérdés, itt
// egy újrabuildeléssel követhető. Ugyanígy a szegmens-logika (`lib/segment.ts`).

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT } from './shared.mjs';

const QUIZ_REPO = '/Users/nagyattila/dev/expertflow-quiz';
const API = 'https://expertflow-quiz.vercel.app/api/submit';
const CAL_LINK = 'attila-nagy-hjau8q/egyeni-konzultacio';
const CAL_NS = 'egyeni-konzultacio';

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A TS-forrásból kivágjuk a tömböt és kiértékeljük. Így a kérdések egyetlen
// igazság-forrása a kvíz-app marad.
function readSteps() {
  const p = join(QUIZ_REPO, 'lib/quiz-data.ts');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/export const QUIZ_STEPS[^=]*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) return null;
  // eslint-disable-next-line no-eval
  return eval(m[1].replace(/;\s*$/, ''));
}

// A szegmens-besorolás címkéi és ajánlás-szövegei szintén a forrásból.
function readSegment() {
  const p = join(QUIZ_REPO, 'lib/segment.ts');
  if (!existsSync(p)) return null;
  const src = readFileSync(p, 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\};)`));
    // eslint-disable-next-line no-eval
    return m ? eval(`(${m[1].replace(/;\s*$/, '')})`) : {};
  };
  return {
    industry: grab('INDUSTRY_LABEL'),
    team: grab('TEAM_LABEL'),
    budget: grab('BUDGET_LABEL'),
    urgency: grab('URGENCY_LABEL'),
  };
}

function stepMarkup(s, i, total) {
  const num = String(i + 1).padStart(2, '0');
  const head = `
    <div class="label-small qz-eyebrow">${s.type === 'contact' ? 'Kapcsolat' : `Kérdés ${num} / ${total - 1}`}</div>
    ${i === 0 ? `<p class="body-medium qz-intro">Mielőtt megjelenne az időpontfoglalás, válaszolj gyorsan ezekre a rövid kérdésekre — így felkészülten érkezem a beszélgetésre, a végén pedig azonnal időpontot foglalhatsz.</p>` : ''}
    <h1 class="text-h3 no-margins qz-title">${esc(s.title)}</h1>
    ${s.helper ? `<p class="body-medium qz-helper">${esc(s.helper)}</p>` : ''}`;

  if (s.type === 'closed') {
    return `<div class="qz-step" data-step="${i}" data-id="${s.id}" data-type="closed" hidden>
      ${head}
      <div class="qz-options" role="radiogroup" aria-label="${esc(s.title)}">
        ${s.options.map((o) => `<button type="button" class="qz-opt" role="radio"
          aria-checked="false" data-value="${esc(o.value)}">
          <span>${esc(o.label)}</span>
          <span class="qz-tick" aria-hidden="true"></span>
        </button>`).join('')}
      </div>
    </div>`;
  }
  if (s.type === 'open') {
    return `<div class="qz-step" data-step="${i}" data-id="${s.id}" data-type="open" hidden>
      ${head}
      <textarea class="qz-textarea" rows="5" placeholder="${esc(s.placeholder || '')}"
        aria-label="${esc(s.title)}"></textarea>
      <div class="qz-count label-small"><span class="qz-chars">0 karakter</span><span class="qz-valid"></span></div>
    </div>`;
  }
  // kontakt
  return `<div class="qz-step" data-step="${i}" data-id="contact" data-type="contact" hidden>
    ${head}
    <div class="qz-fields">
      <label class="qz-field"><span class="label-large">Név *</span>
        <input class="qz-input" name="name" type="text" required autocomplete="name"></label>
      <label class="qz-field"><span class="label-large">Email *</span>
        <input class="qz-input" name="email" type="email" required autocomplete="email"></label>
      <label class="qz-field"><span class="label-large">Telefon (opcionális)</span>
        <input class="qz-input" name="phone" type="tel" autocomplete="tel"></label>
      <label class="qz-field"><span class="label-large">Cég neve (opcionális)</span>
        <input class="qz-input" name="company" type="text" autocomplete="organization"></label>
    </div>
    <label class="qz-gdpr">
      <input type="checkbox" name="gdpr_ok" required>
      <span class="body-medium">Elfogadom, hogy a megadott adataimat a kapcsolatfelvételhez és személyre szabott javaslat küldéséhez kezeljétek. Az adatokat kizárólag erre a célra használjátok, harmadik félnek nem adjátok át. *</span>
    </label>
    <p class="qz-error label-small" hidden></p>
  </div>`;
}

function buildQuiz() {
  const steps = readSteps();
  if (!steps) return console.log('SKIP: nincs kvíz-forrás');
  const seg = readSegment();
  const shellFile = join(OUT, 'kapcsolat.html');
  if (!existsSync(shellFile)) return console.log('SKIP: nincs váz a kvízhez');
  const $ = cheerio.load(readFileSync(shellFile, 'utf8'));

  const total = steps.length;
  const body = `
  <div class="qz-progress" aria-hidden="true"><span class="qz-progress-bar"></span></div>
  <section class="section qz-section">
    <div class="w-layout-blockcontainer main-container w-container qz-wrap">
      <div class="qz-steps">${steps.map((s, i) => stepMarkup(s, i, total)).join('')}</div>

      <div class="qz-nav">
        <button type="button" class="qz-back bn-cta-link" hidden>← Vissza</button>
        <button type="button" class="qz-next cta-main w-inline-block">
          <div class="button-circle"></div>
          <div class="button-text-mask"><div class="button-text qz-next-label">Tovább</div></div>
          <div class="button-bg"></div>
        </button>
      </div>
      <p class="label-small qz-hint">Enter = tovább · Esc = vissza</p>

      <div class="qz-done" hidden>
        <div class="label-small qz-eyebrow">Köszönöm</div>
        <h2 class="text-h2 no-margins qz-done-title">Köszönöm.</h2>
        <p class="body-medium qz-done-lead">Megkaptam a válaszaidat — köszönöm, hogy időt szántál a kitöltésre. Hamarosan személyesen válaszolok, és a válaszaid alapján felkészülten érkezem a beszélgetésünkre.</p>
        <div class="qz-sign">
          <div class="text-large text-body-bold">Nagy Attila</div>
          <div class="label-small">Business Native alapító</div>
        </div>
        <div class="qz-cal-head">
          <div class="label-small qz-eyebrow">Következő lépés</div>
          <h3 class="text-h3 no-margins">Foglalj egy időpontot</h3>
          <p class="body-medium">Válassz egy időpontot, ami neked is megfelel — egy 60 perces beszélgetésre.</p>
        </div>
        <div id="qz-cal" class="qz-cal">Naptár betöltése…</div>
      </div>
    </div>
  </section>`;

  // A kvíz fókuszált élmény: a sablon szekciói és a lábléc elmaradnak, a
  // navigáció viszont marad, hogy ki lehessen lépni belőle.
  $('body > section').remove();
  $('footer').remove();
  $('#bn-contact-js').remove();
  $('.navbar').first().after(body);

  const DATA = { steps, seg, api: API, cal: { link: CAL_LINK, ns: CAL_NS } };
  $('body').append(`<script id="qz-data" type="application/json">${
    JSON.stringify(DATA).replace(/</g, '\\u003c')}</script>`);
  $('body').append(QUIZ_JS);
  $('head').append(QUIZ_CSS);
  $('title').text('Szegmentáló kvíz — Business Native');
  $('meta[name="description"], meta[property="og:description"]')
    .attr('content', 'Válaszolj néhány rövid kérdésre, és foglalj időpontot egy díjmentes konzultációra.');
  // A kvíz nem keresőoldal — ahogy az eredeti app sem indexelteti magát.
  $('head').append('<meta name="robots" content="noindex, nofollow">');

  writeFileSync(join(OUT, 'kviz.html'), $.html());
  console.log(`BN kviz.html: ${total} lépés (${steps.filter((s) => s.type === 'closed').length} zárt, `
    + `${steps.filter((s) => s.type === 'open').length} nyitott, 1 kontakt)`);
}

/* --------------------------------------------------------------------- */

const QUIZ_CSS = `<style id="qz-css">
  .qz-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:60;
    background:var(--_🎨-color--tokens---border--subtle)}
  .qz-progress-bar{display:block;height:100%;width:0;
    background:var(--_🎨-color--tokens---text-body--strong);
    transition:width .6s cubic-bezier(.22,1,.36,1)}
  .qz-section{padding-top:clamp(6rem,10vw,9rem);min-height:70vh}
  .qz-wrap{max-width:var(--max-width--8-columns)}
  .qz-eyebrow{opacity:.55;margin-bottom:var(--spacing--16)}
  .qz-intro{opacity:.72;margin:0 0 var(--spacing--24);max-width:62ch}
  .qz-title{margin-bottom:var(--spacing--12)}
  .qz-helper{opacity:.66;margin:0 0 var(--spacing--32);max-width:60ch}
  /* Lépésváltás: a tartalom oldalirányban úszik be, ahogy az eredeti kvízben. */
  .qz-step{animation:qz-in .35s cubic-bezier(.22,1,.36,1) both}
  .qz-step.is-back{animation-name:qz-in-back}
  @keyframes qz-in{from{opacity:0;transform:translate3d(40px,0,0)}to{opacity:1;transform:none}}
  @keyframes qz-in-back{from{opacity:0;transform:translate3d(-40px,0,0)}to{opacity:1;transform:none}}

  .qz-options{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--12)}
  @media (max-width:767px){.qz-options{grid-template-columns:1fr}}
  .qz-opt{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing--12);
    min-height:3.5rem;padding:var(--spacing--16) var(--spacing--20);text-align:left;
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--default);
    background:transparent;color:inherit;font:inherit;cursor:pointer;
    transition:border-color .3s cubic-bezier(.22,1,.36,1),background-color .3s cubic-bezier(.22,1,.36,1)}
  .qz-opt:hover{border-color:var(--_🎨-color--tokens---text-body--strong)}
  .qz-opt:focus-visible{outline:2px solid currentColor;outline-offset:3px}
  .qz-opt[aria-checked="true"]{border-color:var(--_🎨-color--tokens---text-body--strong);
    background:var(--_🎨-color--tokens---background--lift)}
  .qz-tick{flex:none;width:1.15rem;height:1.15rem;border-radius:50%;
    border:1px solid var(--_🎨-color--tokens---border--subtle);position:relative}
  .qz-opt[aria-checked="true"] .qz-tick::after{content:"";position:absolute;left:.32rem;top:.28rem;
    width:.3rem;height:.55rem;border:solid currentColor;border-width:0 1.5px 1.5px 0;
    transform:rotate(45deg)}

  .qz-textarea,.qz-input{width:100%;font:inherit;color:inherit;
    background:var(--_🎨-color--tokens---background--lift);
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--default);
    padding:var(--spacing--16);resize:vertical}
  .qz-textarea:focus,.qz-input:focus{outline:none;
    border-color:var(--_🎨-color--tokens---text-body--strong)}
  .qz-count{display:flex;justify-content:space-between;margin-top:var(--spacing--8);opacity:.55}
  .qz-fields{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing--16)}
  @media (max-width:767px){.qz-fields{grid-template-columns:1fr}}
  .qz-field{display:flex;flex-direction:column;gap:var(--spacing--8)}
  .qz-field .label-large{opacity:.7}
  .qz-gdpr{display:flex;gap:var(--spacing--12);align-items:flex-start;
    margin-top:var(--spacing--24);cursor:pointer}
  .qz-gdpr input{margin-top:.25rem;flex:none;width:1.1rem;height:1.1rem;accent-color:currentColor}
  .qz-error{color:var(--_🎨-color--tokens---ui--error,#c94040);margin-top:var(--spacing--16)}

  .qz-nav{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing--16);
    margin-top:var(--spacing--48)}
  .qz-back{background:none;border:0;cursor:pointer;font:inherit;color:inherit;opacity:.7}
  .qz-back:hover{opacity:1}
  .qz-next[disabled]{opacity:.4;pointer-events:none}
  .qz-hint{text-align:center;margin-top:var(--spacing--32);opacity:.4}
  @media (max-width:767px){.qz-hint{display:none}}

  .qz-done{display:flex;flex-direction:column;gap:var(--spacing--16);
    animation:qz-in .6s cubic-bezier(.22,1,.36,1) both}
  /* A display:flex/grid felülírja a hidden attribútumot — enélkül a
     köszönő-blokk és a rejtett lépések végig látszanának. */
  .qz-done[hidden],.qz-step[hidden],.qz-nav[hidden],.qz-hint[hidden],
  .qz-error[hidden],.qz-back[hidden]{display:none !important}
  .qz-done-lead{max-width:60ch;opacity:.76;margin:0}
  .qz-sign{margin:var(--spacing--16) 0 var(--spacing--48);padding-top:var(--spacing--24);
    border-top:1px solid var(--_🎨-color--tokens---border--subtle)}
  .qz-cal-head{display:flex;flex-direction:column;gap:var(--spacing--12);
    margin-bottom:var(--spacing--24)}
  .qz-cal{width:100%;min-height:40rem;overflow:auto;
    border:1px solid var(--_🎨-color--tokens---border--subtle);
    border-radius:var(--_🔘-radius---general--large)}
  @media (prefers-reduced-motion:reduce){
    .qz-step,.qz-done{animation:none}
    .qz-progress-bar{transition:none}}
</style>`;

const QUIZ_JS = `<script id="qz-js">
(function () {
  var DATA = JSON.parse(document.getElementById('qz-data').textContent);
  var steps = DATA.steps, total = steps.length;
  var root = document.querySelector('.qz-section');
  if (!root) return;
  var els = [].slice.call(root.querySelectorAll('.qz-step'));
  var bar = document.querySelector('.qz-progress-bar');
  var btnNext = root.querySelector('.qz-next');
  var btnBack = root.querySelector('.qz-back');
  var nextLabel = root.querySelector('.qz-next-label');
  var hint = root.querySelector('.qz-hint');
  var done = root.querySelector('.qz-done');
  var nav = root.querySelector('.qz-nav');
  var KEY = 'bn-quiz-state-v1';
  var idx = 0, answers = {}, started = Date.now(), sending = false;

  // Félbehagyott kitöltés visszatöltése (24 órán belül), ahogy az eredeti app.
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Date.now() - saved.t < 864e5) { answers = saved.a || {}; idx = saved.i || 0; }
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ a: answers, i: idx, t: Date.now() })); } catch (e) {}
  }

  function stepEl(i) { return els[i]; }
  function value(i) {
    var s = steps[i], el = stepEl(i);
    if (s.type === 'closed') {
      var on = el.querySelector('.qz-opt[aria-checked="true"]');
      return on ? on.getAttribute('data-value') : '';
    }
    if (s.type === 'open') return el.querySelector('.qz-textarea').value.trim();
    return '';
  }
  function valid(i) {
    var s = steps[i];
    if (s.type === 'closed') return !!value(i);
    if (s.type === 'open') return value(i).length >= 3;
    var el = stepEl(i);
    var name = el.querySelector('[name="name"]').value.trim();
    var mail = el.querySelector('[name="email"]').value.trim();
    return name.length >= 2 && /\\S+@\\S+\\.\\S+/.test(mail)
      && el.querySelector('[name="gdpr_ok"]').checked;
  }

  function render(back) {
    els.forEach(function (e, i) {
      e.hidden = i !== idx;
      if (i === idx) { e.classList.toggle('is-back', !!back); }
    });
    bar.style.width = ((idx) / (total - 1) * 100) + '%';
    btnBack.hidden = idx === 0;
    nextLabel.textContent = steps[idx].type === 'contact' ? 'Küldés' : 'Tovább';
    btnNext.disabled = !valid(idx);
    var s = steps[idx];
    if (s.type === 'open') {
      var ta = stepEl(idx).querySelector('.qz-textarea');
      ta.value = answers[s.id] || '';
      count(idx);
      setTimeout(function () { ta.focus(); }, 60);
    }
    if (s.type === 'closed') {
      [].forEach.call(stepEl(idx).querySelectorAll('.qz-opt'), function (b) {
        b.setAttribute('aria-checked', String(b.getAttribute('data-value') === answers[s.id]));
      });
    }
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function count(i) {
    var el = stepEl(i), n = el.querySelector('.qz-textarea').value.trim().length;
    el.querySelector('.qz-chars').textContent = n + ' karakter';
    el.querySelector('.qz-valid').textContent = n >= 3 ? 'folytatható' : 'min. 3 karakter';
  }

  function go(dir) {
    if (dir > 0 && !valid(idx)) return;
    if (dir > 0) answers[steps[idx].id] = value(idx);
    if (dir > 0 && idx === total - 1) return submit();
    idx = Math.max(0, Math.min(total - 1, idx + dir));
    save(); render(dir < 0);
  }

  root.addEventListener('click', function (e) {
    var opt = e.target.closest('.qz-opt');
    if (opt) {
      var wrap = opt.closest('.qz-step');
      [].forEach.call(wrap.querySelectorAll('.qz-opt'), function (b) {
        b.setAttribute('aria-checked', String(b === opt));
      });
      answers[steps[idx].id] = opt.getAttribute('data-value');
      btnNext.disabled = false; save();
      // zárt kérdésnél rövid szünet után magától lép tovább
      setTimeout(function () { if (steps[idx] && steps[idx].type === 'closed') go(1); }, 350);
      return;
    }
    if (e.target.closest('.qz-next')) go(1);
    if (e.target.closest('.qz-back')) go(-1);
  });
  root.addEventListener('input', function (e) {
    if (e.target.classList.contains('qz-textarea')) { count(idx); btnNext.disabled = !valid(idx); }
    else btnNext.disabled = !valid(idx);
  });
  root.addEventListener('change', function () { btnNext.disabled = !valid(idx); });
  document.addEventListener('keydown', function (e) {
    if (done && !done.hidden) return;
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); go(1); }
    if (e.key === 'Escape') { e.preventDefault(); go(-1); }
  });

  function submit() {
    if (sending) return;
    var el = stepEl(total - 1);
    var err = el.querySelector('.qz-error');
    var open = {};
    steps.forEach(function (s) { if (s.type === 'open' && answers[s.id]) open[s.id] = answers[s.id]; });
    var payload = {
      name: el.querySelector('[name="name"]').value.trim(),
      email: el.querySelector('[name="email"]').value.trim(),
      phone: el.querySelector('[name="phone"]').value.trim() || null,
      company: el.querySelector('[name="company"]').value.trim() || null,
      gdpr_ok: true,
      industry: answers.industry, team_size: answers.team_size,
      budget: answers.budget, urgency: answers.urgency,
      answers: open,
      duration_seconds: Math.min(7200, Math.round((Date.now() - started) / 1000))
    };
    sending = true; err.hidden = true; nextLabel.textContent = 'Küldés…'; btnNext.disabled = true;

    fetch(DATA.api, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      finish(payload.name);
    }).catch(function (ex) {
      sending = false; btnNext.disabled = false; nextLabel.textContent = 'Küldés';
      err.hidden = false;
      err.innerHTML = 'Hiba a küldéskor: ' + ex.message
        + '. Próbáld újra pár másodperc múlva. Ha továbbra sem megy, írj a '
        + '<a href="mailto:hello@businessnative.hu">hello@businessnative.hu</a> címre.';
    });
  }

  function finish(name) {
    els.forEach(function (e) { e.hidden = true; });
    nav.hidden = true; if (hint) hint.hidden = true;
    bar.style.width = '100%';
    var first = (name || '').trim().split(' ')[0];
    done.querySelector('.qz-done-title').textContent = first ? 'Köszönöm, ' + first + '.' : 'Köszönöm.';
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    calendar();
  }

  function calendar() {
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar) }; var d = C.document;
      C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true }
        if (ar[0] === L) { const api = function () { p(api, arguments) }; const ns = ar[1];
          api.q = api.q || []; typeof ns === "string"
            ? (cal.ns[ns] = cal.ns[ns] || api) && p(cal.ns[ns], ar) && p(cal, ["initNamespace", ns])
            : p(cal, ar); return }
        p(cal, ar) };
    })(window, "https://app.cal.com/embed/embed.js", "init");
    Cal("init", DATA.cal.ns, { origin: "https://cal.com" });
    Cal.ns[DATA.cal.ns]("inline", {
      elementOrSelector: "#qz-cal", config: { layout: "month_view" }, calLink: DATA.cal.link
    });
    Cal.ns[DATA.cal.ns]("ui", { hideEventTypeDetails: false, layout: "month_view" });
  }

  render(false);
})();
</script>`;

buildQuiz();
