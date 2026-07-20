# ModuLabs sablon — teljes magyar másolat terve

## Kontextus

A cél a **ModuLabs Webflow-sablon** (élő demo: https://modulabs-template.webflow.io/, BYQ Studio) **összes oldalának 1:1 másolata magyar nyelven**, statikus weboldalként, Vercelre deployolva. A felhasználó birtokolja a sablon Webflow-exportját (`modulabs.zip`), amelyet **feltölt a GitHub repóba** (expertflow-attila/labortech) — ez lesz a kivitelezés alapja, így a másolat pixelpontos lesz.

- **Márka/tartalom:** 1:1 másolat — a „Modulabs” név, demo-szövegek, képek maradnak, csak **minden szöveg magyarul**.
- **Munkabranch:** `claude/modulabs-hungarian-website-87t424` (a repó jelenleg üres, nincs commit).
- **A kivitelezést egy másik modell végzi** — ez a dokumentum a teljes végrehajtási útmutató. A terv jóváhagyása után ezt a dokumentumot `TERV.md` néven a repóba commitoljuk és pusholjuk, hogy a kivitelező session induláskor megtalálja.

## 0. Előfeltétel (a felhasználó teendője)

A `modulabs.zip` feltöltése a repó gyökerébe a GitHub webes felületén (repó → *Add file → Upload files*). **A kivitelezés e nélkül nem indulhat el** — a kivitelező modell első lépésként ellenőrizze, hogy a zip ott van-e; ha nincs, álljon meg és kérje a feltöltést.

Megjegyzés: a távoli környezet proxyja a `webflow.io`-t blokkolja, ezért az élő oldalról való másolás nem járható út — kizárólag a zip a forrás.

## 1. Elkészítendő oldalak (a Webflow-export fájljai alapján)

A zip kicsomagolása után a pontos fájlnevek/slugok az exportból derülnek ki — **az export HTML-fájllistája a mérvadó**, az alábbi lista az élő oldal láblécéből felderített teljes oldalkészlet (~18 oldal):

| # | Oldal | Megjegyzés |
|---|-------|-----------|
| 1 | Home A (`index.html`) | Fő kezdőlap |
| 2 | Home B | Alternatív kezdőlap-layout |
| 3 | Home C | Alternatív kezdőlap-layout |
| 4–6 | Service A / B / C | Három szolgáltatás-layout |
| 7–9 | Contact A / B / C | Három kapcsolat-layout |
| 10 | About | Rólunk |
| 11 | Careers | Karrier (állálista) |
| 12 | Career Single (Job CMS) | Állás-részletoldal |
| 13 | Pricing | Árazás |
| 14 | Blog | Cikklista |
| 15 | Blog Article | Cikk-részletoldal |
| 16 | Book a call | Időpontfoglaló oldal |
| 17 | Legal | Jogi oldal |
| 18 | 404 + Password (401) | Hibaoldal és jelszóvédett oldal |

(„More Templates” a láblécben külső link a sablonboltra — nem külön oldal, a link maradhat.)

### Fő szekciók oldalanként (felderítés alapján, tájékoztató jelleggel)

- **Home A:** hero („mérhető eredményeket szállító rendszerek” üzenet) + Book a call CTA; ügyfél-logósor; case study kiemelés; „operating system” bemutató szekció + árazás CTA; „capabilities” szekció 4 füllel (kockázatfelügyelet, adatkeretrendszerek, teljesítmény-értékelés, szállítási rendszerek); testimonial-slider; Insights (blog) kártyák; záró CTA + időpontfoglaló űrlap.
- **About:** misszió-hero; „who we are” + 4 statisztika-számláló; 6 fős vezetőségi rács; karrier-előnézet (3 nyitott pozíció); Insights szekció.
- **Pricing:** 3 csomagkártya (2× Core, 1× Scale „egyedi ár”); logósor; 6 elemű FAQ-akkordeon.
- **Careers:** hero; nyitott pozíciók akkordeon (3 állás kategóriával, típussal, helyszínnel, leírással); „nem találtad?” CTA.
- **Globális elemek (minden oldalon):** navbar; lábléc (Multilayout / Pages / More linkoszlopok + elérhetőségek + social); időpontfoglaló űrlap (név, telefon, e-mail, idősáv-választó, megjegyzés, adatkezelési checkbox, sikeres/hibás beküldés üzenetek).

## 2. Technikai megközelítés

**A Webflow statikus exportot változtatás nélkül megtartjuk** (HTML + `css/` + `js/` + `images/` + `fonts/`), és csak a szövegeket fordítjuk le a HTML-fájlokban. Nem építjük újra Next.js-ben/Astróban — a statikus export adja a pixelpontos másolatot a legkisebb kockázattal, és Vercelen közvetlenül hosztolható.

Könyvtárszerkezet: az export tartalma a **repó gyökerébe** kerül (így a Vercel külön konfig nélkül statikus oldalként szolgálja ki), a `modulabs.zip` a kicsomagolás után törölhető a repóból.

## 3. Kivitelezési lépések (a végrehajtó modellnek)

1. **Zip ellenőrzése és kicsomagolása** a repó gyökerébe; fájlleltár készítése (minden `.html` felsorolása), egyeztetés a fenti oldallistával. Eltérés esetén az export a mérvadó.
2. **Fordítás oldalanként** — minden HTML-fájlban kizárólag a látható szövegek és a szöveges attribútumok cserélése magyarra:
   - látható szövegek (címsorok, bekezdések, gomb- és linkfeliratok, navigáció, lábléc),
   - `<title>` és `meta description`,
   - `alt` attribútumok,
   - űrlap: `label`, `placeholder`, `select` opciók, submit-gomb, siker-/hibaüzenetek (Webflow `w-form-done` / `w-form-fail` blokkok),
   - **TILOS** módosítani: class-neveket, `id`-kat, `data-w-*` attribútumokat, HTML-struktúrát, CSS/JS fájlokat, képhivatkozásokat — különben törnek a Webflow-interakciók.
3. **`lang="hu"`** beállítása minden `<html>` tagen.
4. **Magyar konvenciók:** dátumok „2025. szeptember 15.” formában; árak és személynevek változatlanul (1:1 másolat); elérhetőségek (Warsaw, +48…) változatlanul maradnak.
5. **Fordítási minőség:** természetes, üzleti magyar nyelv, nem tükörfordítás. Egységes terminológia, pl.: Book a call → „Foglalj hívást”, Get started → „Vágjunk bele”, Read More → „Tovább olvasom”, View all insights → „Összes cikk”, Open positions → „Nyitott pozíciók”, Case Study → „Esettanulmány”, Pricing → „Árazás”. A visszatérő elemeket (navbar, lábléc, foglaló űrlap, testimonial-kártya) **egyszer** kell lefordítani és minden oldalon azonosan használni.
6. **Belső linkek ellenőrzése:** a fájlnevek (slugok) maradnak angolul, ahogy az exportban vannak — így egyetlen link sem törik.
7. **Vercel-konfiguráció:** statikus deploy; `404.html`-t a Vercel automatikusan használja. Szükség esetén minimális `vercel.json` (`cleanUrls: true`), hogy a `/about` jellegű URL-ek kiterjesztés nélkül működjenek.
8. **Commit + push:** a `claude/modulabs-hungarian-website-87t424` branchre (`git push -u origin ...`, hálózati hiba esetén 4 újrapróbálkozás exponenciális várakozással).
9. **Deploy Vercelre:** a session Vercel MCP eszközével (`mcp__Vercel__deploy_to_vercel`), vagy ha nem elérhető, a Vercel–GitHub integrációval. A kapott URL-t jelenteni a felhasználónak.

## 4. Ellenőrzés (kötelező a kivitelezés végén)

1. **Teljességi ellenőrzés:** minden HTML-fájlban keresés gyakori angol maradványokra (pl. `grep -ril "Read More\|Book a call\|Get started\|View all"` stb.) — nem maradhat le nem fordított látható szöveg.
2. **Vizuális ellenőrzés:** a deployolt (vagy lokálisan `npx serve`-vel futtatott) oldalt Playwrightтal/Chromiummal oldalanként megnyitni, screenshotokat készíteni desktop + mobil nézetben, és összevetni a layoutot — a dizájnnak pixelre egyeznie kell az eredetivel (előfordulhat betűméret-túlcsordulás a hosszabb magyar szövegek miatt; ezt szövegrövidítéssel kell javítani, nem CSS-módosítással).
3. **Linkellenőrzés:** minden navbar-/lábléclink működik, nincs 404 (kivéve maga a 404 oldal).
4. **Űrlap:** a foglaló űrlap megjelenik, a magyar siker-/hibaüzenetek helyükön vannak. (Webflow-exportban az űrlap beküldése a Webflow-ra mutat — ez demo-oldalon elfogadható, jelezni kell a felhasználónak, hogy éles használathoz saját form-backend kell, pl. Formspree.)
5. **Jelentés:** oldalankénti kész-lista + deploy URL a felhasználónak.

## 5. E session teendői jóváhagyás után

1. Ezt a tervet `TERV.md` néven a repó gyökerébe írni, commitolni és pusholni a `claude/modulabs-hungarian-website-87t424` branchre.
2. Jelezni a felhasználónak: töltse fel a `modulabs.zip`-et a repóba, majd indíthatja a kivitelező modellt azzal az utasítással, hogy a `TERV.md` szerint dolgozzon.

## Megjegyzés a licencről

A ModuLabs kereskedelmi Webflow-sablon (projektenkénti licenc). A kivitelezés a felhasználó saját, letöltött exportjából történik — az élő oldalról tartalom nem kerül másolásra.
