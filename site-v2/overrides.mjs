// Business Native V2 — kézi felülírások és takarítás a generálás UTÁN.
//
// MIÉRT KÜLÖN LÉPÉS
// Az oldal szövege két crawlolt forrásból (`ef-src/`, `bn-src/`) épül, amiket
// szándékosan nem szerkesztünk — a forrás a mérce. Amikor viszont Attila
// felülbírál egy adatot (pl. árat), az nem írható vissza a forrásba anélkül,
// hogy a következő crawl le ne törölné. Ezért minden ilyen döntés ITT él,
// egyetlen, olvasható listában.
//
// DRIFT-VÉDELEM
// Minden szabálynak találnia KELL (kivéve a kifejezetten `optional`-ként
// jelölteket). Ha egy `from` nulla helyen egyezik, a build ELHASAL — ez jelzi,
// hogy a forrás megváltozott, és a szabály némán elavult volna.

import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public';

/* ------------------------------------------------------------------ *
 * 1. Szövegcserék
 * ------------------------------------------------------------------ */

// Árak — Attila döntése (2026-07-28). A korábbi számok két, egymásnak
// ellentmondó helyről jöttek: az Árak/Kapcsolat oldal a `bn-src`-ből
// (400 000 – 999 000 Ft + 250 000 Ft/hó), a Szolgáltatás GYIK-je az
// `ef-src`-ből (250.000–600.000 Ft + egyszeri 150.000 + havi 50–150 000 Ft).
// Mostantól MINDENHOL egy történet: rendszerépítés 250 000 – 500 000 Ft,
// partneri támogatás 150 000 Ft/hó.
const RULES = [
  // -- árak: sávos ár --
  { from: '400 000 – 999 000 Ft', to: '250 000 – 500 000 Ft' },
  { from: '400 000 és 999 000 Ft között', to: '250 000 és 500 000 Ft között' },

  // -- árak: havi díj --
  { from: '250 000 Ft/hó', to: '150 000 Ft/hó' },

  // -- árak: a Szolgáltatás GYIK eltérő története, ráigazítva a fentire --
  {
    from: 'Az együttműködés teljes összege 250.000 és 600.000 Ft között mozog, az igényeidtől függően.',
    to: 'Az együttműködés teljes összege 250 000 és 500 000 Ft között mozog, az igényeidtől függően.',
  },
  {
    from: 'Az induláskor egy egyszeri 150.000 forintos díj kerül kifizetésre. Utána havi szinten, mindig az adott hónap elején.',
    to: 'A rendszerépítés díja induláskor és átadáskor, két részletben esedékes. A partneri támogatás havonta, mindig az adott hónap elején.',
  },
  {
    from: 'A havi díj általában 50.000 és 150.000 Ft között alakul.',
    to: 'A partneri támogatás fix 150 000 Ft/hó, minimum három hónapra.',
  },

  // -- elgépelés a forrásban (a forrást nem javítjuk, csak a kimenetet) --
  { from: '3.pillér', to: '3. pillér' },

  // A forrásban szereplő „ÜGYFÉSZERZÉS" (hiányzó L) a generátorig nem jut el —
  // a kimeneten a helyes „Ügyfélszerzés" alak áll. A szabály védőhálóként van
  // itt: ha egy jövőbeli forrás-változás mégis kisodorná, elkapja.
  { from: 'ÜGYFÉSZERZÉS', to: 'ÜGYFÉLSZERZÉS', optional: true },
];

/* ------------------------------------------------------------------ *
 * 2. Angol Modulabs-sablonoldalak kivezetése
 * ------------------------------------------------------------------ */

// A crawl a teljes Modulabs sablont lehozza, és a generátor csak azokat írja
// felül, amikre BN-oldal épül. A maradék angol nyelven, BN-navigáció nélkül
// ott ragadt a kimeneten: a BN-oldalakról EGYETLEN link sem mutat rájuk, de
// közvetlen URL-en elérhetők és indexelhetők voltak. A `vercel.json` 308-as
// átirányítást ad az öt gyökér-oldalra, hogy a külső hivatkozások se haljanak el.
const PRUNE_FILES = [
  'about.html', 'careers.html', 'pricing.html', 'privacy-policy.html', 'news-insights.html',
];
const PRUNE_DIRS = [
  'careers', 'contact', 'homepage', 'news-insights', 'service', 'template',
];

/* ------------------------------------------------------------------ */

function pages(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (e.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let files = 0;
const counts = new Map(RULES.map((r) => [r.from, 0]));

for (const p of pages(OUT)) {
  const src = readFileSync(p, 'utf8');
  let out = src;
  for (const r of RULES) {
    if (!out.includes(r.from)) continue;
    counts.set(r.from, counts.get(r.from) + out.split(r.from).length - 1);
    out = out.split(r.from).join(r.to);
  }
  if (out !== src) { writeFileSync(p, out); files += 1; }
}

const missing = RULES.filter((r) => !r.optional && counts.get(r.from) === 0);
if (missing.length) {
  console.error('\nHIBA — elavult felülírás-szabály (a forrás megváltozott?):');
  for (const r of missing) console.error(`  nem található: "${r.from}"`);
  process.exit(1);
}

let pruned = 0;
for (const f of PRUNE_FILES) {
  const p = join(OUT, f);
  if (existsSync(p)) { rmSync(p); pruned += 1; }
}
for (const d of PRUNE_DIRS) {
  const p = join(OUT, d);
  if (existsSync(p)) { pruned += pages(p).length; rmSync(p, { recursive: true }); }
}

const applied = RULES.filter((r) => counts.get(r.from) > 0).length;
console.log(`BN felülírások: ${applied}/${RULES.length} szabály, ${files} fájl · `
  + `${pruned} angol sablonoldal kivezetve`);
