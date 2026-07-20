# Modulabs HU — oldalgenerátor

A felhasználó megvásárolt Modulabs Webflow-sablonjának (export: `modulabs.zip`, a tulajdonos birtokában)
magyar nyelvű változatát állítja elő. Mivel a fejlesztői konténer hálózata nem éri el sem a
Google Drive-ot, sem a Webflow-t, a build a Vercel build-környezetében fut, ahol a sablon
élő demójából tükrözi a licencelt fájlokat, majd a `dictionary.json` alapján magyarra fordítja.

## Működés

- `crawl.mjs` — a Vercel buildben fut (`npm run build`):
  1. bejárja az oldal összes belső hivatkozását (max. 60 oldal),
  2. letölti az összes `website-files.com` assetet a `public/assets/` mappába, és átírja a hivatkozásokat,
  3. minden szövegcsomópontot és szöveges attribútumot (alt, placeholder, meta, submit-érték stb.)
     lefordít a `dictionary.json` alapján, `lang="hu"`-t állít,
  4. riportot ír a `public/_report/strings.json` fájlba a le nem fordított szövegekről.
- `dictionary.json` — angol → magyar fordítási szótár (normalizált kulcsok: idézőjelek, whitespace).
- A kimenet teljesen statikus site a `public/` mappában.

## Frissítés / hiányzó fordítások

1. Deploy után nézd meg: `https://<deployment>/_report/strings.json` → `translation.missing`.
2. A hiányzó szövegeket vedd fel a `dictionary.json`-ba, majd deployolj újra.

## Megjegyzés

Amint a `modulabs.zip` bekerül a repóba, a crawler kiváltható a saját exportból történő
builddel (ugyanez a fordítási lépés az export HTML-jein futtatva).
