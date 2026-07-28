// Business Native — tartalmi réteg a Modulabs dizájn-váz fölé.
//
// A crawl.mjs legyártja a magyar Modulabs-tükröt a ./public mappába; ez a script
// utána fut, és a 4 fő oldalt (főoldal, szolgáltatás, rólam, kapcsolat) feltölti
// a Business Native saját tartalmával — szövegek és képek cseréjével, a sablon
// dizájnjának (dark mode) érintetlenül hagyásával.
//
// Módszer: ugyanaz a bevált szótár-elv, mint a fordításnál — pontos szöveg-egyezés
// alapján cserélünk szövegcsomópontot, és fájlnév-töredék alapján képet. Így nem
// függünk törékeny DOM-sebészettől.

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const OUT = 'public';
const CDN = 'https://cdn.prod.website-files.com/695f8227a36102b1ab34359c';
const CAL = 'https://cal.com/attila-nagy-8uefco/expert-flow-konzultacio?overlayCalendar=true';
const EMAIL = 'hello@businessnative.hu';
const YT = 'https://www.youtube.com/@nagyattilaferenc';

const norm = (s) =>
  s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/* ----------------------------------------------------------------------- */
/* 1. Business Native képek — letöltés a Webflow CDN-ről                    */
/* ----------------------------------------------------------------------- */

const IMG = {
  // munkakörnyezet / ügyfél-fotók
  duoLaptop: '698763001f142900e952361e_33Z4.webp',
  manThink: '6987630045ba854da16ba9dc_45J5L56.webp',
  duoTalk: '69876300481145612d671ff6_EWEZEU444.webp',
  presenting: '698763005b53cdbfba3eb9c5_444ZHH.webp',
  womanPlants: '6987630254eb6f8c32a7fc0b_rjk55.webp',
  womanWindow: '69876302566a248d4fbc25cd_gggg.webp',
  womanPhone: '6987630265707fd60430749b_regm.webp',
  womanDesk: '69876302a26bddc867d87032_545.webp',
  handshake: '6987a491f8f7ece20404ced6_ndfndgmtg.webp',
  womanCall: '6987a49265e679ade37ecf5f_dnsfndjkkkfjkf.webp',
  womanBlonde: '69876301e9230ece004cc270_D4EJK%2C.webp',
  womanChair: '698a30539a20bac413fef421_IMG_9745.webp',
  handsTyping: '69b1e8c4db754d25b3b1af30_1.webp',
  officeRoom: '69b1e95bb50e69d8613e188b_19.webp',
  team: '69b5bbb3fae37cf37a3ab2d5_team_photo_webflow.webp',
  deskWarm: '69c46283d1dbecc1c5492bd1_Gemini_Generated_Image_wu61pbwu61pbwu61.webp',
  // Attila
  attila: '69b5beb3970e13a7390d572e_attila_portrait.webp',
  attilaPhoto: '6964ee32f3d6a1e9845711b6_347582237_3614494415453717_4151729425906503210_n-2.jpg',
  // személyes történet
  story1: '698767480fab53e90b8a12ab_6840a361ea49af737518b9b4_img636.jpg',
  story2: '698767480fab53e90b8a12b8_6843c1f0b7b63a6a64e38c1f_20220926_141808.jpg',
  story3: '698767480fab53e90b8a12c9_683f3c5dd2be8b466c10106c_DSC_4542.JPG',
  // referenciák
  refEva: '69b086d848cdcf5cd046dd38_Ke%CC%81pernyo%CC%8Bfoto%CC%81%202026-03-09%20-%2021.43.09.webp',
  refDavid: '69b086d88f47e659e8dbab89_Ke%CC%81pernyo%CC%8Bfoto%CC%81%202026-03-09%20-%2021.42.18.webp',
  // eszköz-logók
  openai: '69b5e11a0e154ad5f3a68930_openai-wordmark.svg',
  midjourney: '69b5e11a4605b68c33edd25c_midjourney.svg',
  posthog: '69b5e11a6d4473b8eb9e8b7f_posthog-wordmark.svg',
  notion: '69b5e11aa5e98977cd3a0351_notion.svg',
  supabase: '69b5e11ae5b41141c0d0e4c2_supabase-wordmark.svg',
  antigravity: '69b5e836db6fe979352b7c9b_antigravity-icon.svg',
  slack: '69b5eaab90200f4952c573a2_slack-wordmark%20(1).svg',
  resend: '69b5eae114157cf955a9c214_resend-wordmark.svg',
  ollama: '69b5eae19300595e4e84aeac_ollama.svg',
};

const localOf = {}; // kulcs -> /assets/bn-...

async function fetchAssets() {
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  for (const [key, file] of Object.entries(IMG)) {
    const ext = (file.split('.').pop() || 'webp').toLowerCase();
    const local = `/assets/bn-${key}.${ext}`;
    const dest = join(OUT, `assets/bn-${key}.${ext}`);
    localOf[key] = local;
    if (existsSync(dest)) continue;
    try {
      const res = await fetch(`${CDN}/${file}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      console.log(`BN asset FAIL ${key}: ${e}`);
      delete localOf[key];
    }
  }
  console.log(`BN assets: ${Object.keys(localOf).length}/${Object.keys(IMG).length} letöltve`);
}

/* ----------------------------------------------------------------------- */
/* 2. Globális márka-cserék (minden oldalon)                                */
/* ----------------------------------------------------------------------- */

const GLOBAL_TEXT = {
  // márkanév
  'Modulabs': 'Business Native',
  'Expert Flow': 'Business Native',
  'a Modulabs': 'a Business Native',
  'A Modulabs': 'A Business Native',
  'Modulabsnál': 'Business Native-nál',
  'Modulabshoz': 'Business Native-hoz',
  'Modulabsszal': 'Business Native-val',
  'Modulabsot': 'Business Native-ot',
  // lábléc / kapcsolat
  'contact@modulabs.com': EMAIL,
  'Varsó, Lengyelország': 'Budapest, Magyarország',
  '+48 123 456 789': '',
  '© 2025 BYQ Studio': '© 2026 Business Native',
  'Webflow sablon': 'Nagy Attila',
  'Minden jog fenntartva': 'Minden jog fenntartva',
  'Moduláris Webflow-sablon, amelyet a fenntartható infrastruktúrák formáltak — olyan márkáknak, amelyek az átláthatóságot, az alkalmazkodóképességet és a modern esztétikát értékelik.':
    'AI-alapú rendszereket építek egyéni vállalkozóknak — hogy a technológia az emberi értéket és a személyes fejlődést szolgálja.',
  // navigáció
  'Áttekintés': 'Főoldal',
  'Sablon letöltése': 'Konzultációt foglalok',
  'Foglalj hívást': 'Beszéljünk',
  'További sablonok': 'Referenciák',
  'Rólunk': 'Rólam',
  'Árazás': 'Szolgáltatás',
};

/* ----------------------------------------------------------------------- */
/* 3. Oldalankénti szöveg-cserék                                            */
/* ----------------------------------------------------------------------- */

const HOME_TEXT = {
  // hero
  'Rendszerek, amelyek': 'AI-alapú rendszerek',
  'mérhető eredményt hoznak': 'egyéni vállalkozóknak',
  // hero eset-kártya -> valódi referencia
  'Esettanulmány': 'Referencia',
  'A kockázat megfejtése: új megközelítés a működési felügyeletben':
    'Ügyfélszerzés — kiszámítható ügyfélszerzés minden hónapban',
  // 2 kinyíló kártya -> pillérek
  'Generálkivitelezés': 'Ügyfélszerzés',
  'Teljes körű projektmenedzsment.': 'Leegyszerűsítjük az ügyfélszerzés folyamatát.',
  'Kereskedelmi építkezések': 'Háttérműködés',
  'Az irodáktól a nagyüzemi létesítményekig.': 'Fókuszálttá tesszük a vállalkozásod működését.',
  // logó-sáv
  'Cégek, akikkel együtt dolgoztunk': 'Eszközök, amikkel dolgozom',
  // split szekció
  'működési rendszerünk': 'Ebben segítek',
  'Környezettudatos kezdeményezésekre tervezett keretrendszer':
    'AI-támogatott rendszerekkel visszaadom a vállalkozóknak az idejüket, energiájukat és szabadságukat',
  'Újrahasználható szekciókkal, letisztult változókkal és rugalmas elrendezésekkel készült — hogy gyorsan indulhass, és magabiztosan skálázz.':
    'A Business Native célja, hogy az egyéni vállalkozókat segítse egy hatékony és fenntartható vállalkozás kiépítésében — ahol a technológia az emberi értéket és a személyes fejlődést szolgálja.',
  'Nézd meg az árakat': 'Nézd meg a szolgáltatásom',
  'Ügyféltörténet': 'Referencia',
  'A Modulabs az építési tervrajzoktól a digitális sablonokig végigkísért minket':
    'Hangstúdió — felvétel, keverés, mastering, filmes hangmunka',
  'Jessica Mercedes': 'Vitányi Dávid',
  'Marketing': 'Hangstúdió',
  // képességek fülek -> megoldások
  'képességek': 'Megoldások',
  'Segítünk a vállalkozásoknak, hogy': 'Megvalósítás',
  'a zűrzavarból megértés szülessen': 'a gyakorlatban',
  'Minden együttműködés strukturált, adatvezérelt ritmust követ, amely a felmérésen, a tervezésen és a mérhető szállításon alapul.':
    'A három legnagyobb kihívásodra fókuszálok — mert tudom, ezek viszik el a legtöbb energiádat.',
  'Teljes körű projektfelügyelet': 'Kampányok támogatása',
  'Adatvezérelt döntéshozatal': 'Adatvezérelt döntések',
  'Beépített kockázatkezelés': 'Személyi asszisztens',
  'Moduláris szállítási ciklusok': 'Ügyfél tudásbázis',
  'Kockázatfelügyelet': 'Kampányok támogatása',
  'A Modulabs a folyamatokon átívelően térképezi fel a kockázatokat, és még eszkaláció előtt feltárja a vakfoltokat. A strukturált felügyelettel a szervezetek csökkenthetik a bizonytalanságot, és megvédhetik kritikus működésüket.':
    'Az AI-csapatod támogatja a kommunikációt, a követést és a kiértékelést, így minden átlátható és mérhető marad.',
  'Adatkeretrendszerek': 'Adatvezérelt döntések',
  'Teljesítményértékelések': 'Személyi asszisztens',
  'Szállítási rendszerek': 'Ügyfél tudásbázis',
  'A rendszeres teljesítményértékelések a végrehajtás minden szakaszában átláthatóságot adnak. A Modulabs gondoskodik róla, hogy az előrehaladást a közösen rögzített KPI-okhoz mérjük, lehetővé téve a korrekciót és a fenntartható növekedést.':
    'Az AI-ügynököd koordinálja a vállalkozásod fő területeire fókuszáló csapattagokat, és a kérésednek megfelelően irányítja őket.',
  'Szállítási rendszereink moduláris ciklusokra épülnek — kicsi, mérhető lépésekre, amelyek alkalmazkodnak a változó körülményekhez. Ez a megközelítés agilissá, kiszámíthatóvá és skálázhatóvá teszi a projekteket.':
    'Minden ügyfél a saját fiókjában fér hozzá a videókhoz, dokumentumokhoz és felvételekhez — AI-alapú kereséssel.',
  // vélemények -> referenciák
  'vélemények': 'Referenciák',
  'Bizonyíték': 'Akikkel eddig',
  'a gyakorlatban': 'dolgoztam',
  'Mérhető eredmények, minden projektbe beépített átláthatósággal.':
    'Minden projektben más a szakma, más a kihívás — de a megközelítés ugyanaz: először megértem, hogyan dolgozol és kinek segítesz, csak utána építek.',
  'John Kowalski': 'Vitányi Dávid',
  '— Alapító, Modulabs': '— Hangstúdió',
  'Esettanulmány megtekintése': 'További részletek',
  // insights -> pillérek
  'Elemzések': 'Szolgáltatás',
  'Ötletek, kutatások, nézőpontok': 'Egyéni szolgáltatásom',
  'Összes cikk megtekintése': 'További részletek',
  'Bizalomépítés átláthatósággal': 'Kiszolgálás — átlátható folyamatok meglévő és új ügyfeleidnek',
  'A felügyelettől a hatásig: bizalom újraépítése adatvezérelt rendszerekkel':
    'Háttérműködés — rendezett háttér, hogy az ügyfeleidre fókuszálhass',
  'Tovább olvasom': 'További részletek',
  '2025. szeptember 15.': '1. pillér',
  // CTA
  'Építjük': 'Építsük fel',
  'a holnap üzletét': 'a rendszered',
};

const SERVICE_TEXT = {
  'Azonosítsd, mérd és csökkentsd a kockázatokat,': 'Hiszem, hogy a tudásod',
  'mielőtt eszkalálódnának': 'érték',
  'A kockázat megfejtése: új megközelítés a működési felügyeletben':
    'Kiberbiztonsági irányítás és digitális ellenállóképesség',
  'Esettanulmány megtekintése': 'További részletek',
  'Ügyféltörténet': 'Referencia',
  'A Modulabs az építési tervrajzoktól a digitális sablonokig végigkísért minket':
    'Hangstúdió — felvétel, keverés, mastering, filmes hangmunka',
  'Jessica Mercedes': 'Vitányi Dávid',
  'Marketing': 'Hangstúdió',
  'megközelítésünk': 'Kinek szól?',
  'A stratégiát, a dizájnt és a technológiát egyetlen keretrendszerré ötvözzük.':
    'Neked szól, ha nyitott vagy az AI-ra, vannak ügyfeleid, de szeretnéd, ha a kiszolgálás nem venné el a napod nagy részét.',
  'Ez végrehajtható terveket és szállításra kész csapatokat jelent.':
    'És ha szeretnéd, hogy a vállalkozásod működése átlátható legyen — ne kelljen mindent fejben tartani.',
  'Segítünk a cégeknek, hogy': 'Három pillér,',
  'a komplexitásból átláthatóság legyen': 'egy vállalkozás',
  'Teljes körű projektfelügyelet': 'Ügyfélszerzés',
  'Adatvezérelt döntéshozatal': 'Kiszolgálás',
  'Beépített kockázatkezelés': 'Háttérműködés',
  'Moduláris szállítási ciklusok': 'Megoldások',
  'Teljes körű felügyelet': 'Ügyfélszerzés',
  'A projekteket a tervezéstől a szállításig teljes átláthatósággal irányítjuk, hogy minden szakasz összhangban maradjon a céljaiddal.':
    'Felépítek egy ügyfélszerzési útvonalat, ami az ajánlások mellett is dolgozik — hogy a megfelelő emberek megtaláljanak, és felismerjék a szolgáltatásod értékét.',
  'Beszélj szakértővel': 'Jelentkezem konzultációra',
  // idővonal -> folyamat
  'A Modulabsnál minden együttműködés világos, moduláris utat követ.':
    'Az együttműködés négy világos lépésben zajlik.',
  'Átláthatóan, kiszámíthatóan és eredményfókuszáltan dolgozunk':
    'Átláthatóan, kiszámíthatóan és eredményfókuszáltan',
  '1 hét': '01',
  'Felmérő audit': 'Jelentkezés',
  'Jelenlegi rendszereid, kihívásaid és KPI-aid mélyelemzésével kezdünk. Eredmény: világos kép arról, mi számít igazán.':
    'Konzultáció során részletesen átbeszéljük az igényeidet és a céljaidat.',
  'Testreszabott keretrendszert és ütemtervet tervezünk. Eredmény: céljaiddal összehangolt, mérhető terv.':
    'Megtervezzük a weboldalad, a funneled és a hozzá kapcsolódó AI-workflow-kat.',
  'Moduláris szállítási ciklusok világos mérföldkövekkel és egyeztetésekkel. Eredmény: látható haladás minden szakaszban.':
    'Felépítjük a teljes rendszered, majd integráljuk és betanítjuk az AI-t.',
  'Mérjük az eredményeket, követjük a KPI-okat, és igazítjuk a stratégiát. Eredmény: számszerűsíthető hatás.':
    'Teljes körű partneri támogatás, folyamatos fejlesztés és havi optimalizálás.',
  '1–2 hét': '02',
  'Tervezési brief': 'Tervezés',
  'Testreszabott keretrendszert és ütemtervet tervezünk, amely a valós működésedhez igazodik.':
    'Megtervezzük a weboldalad, funneled és a hozzá kapcsolódó AI-workflow-kat.',
  '3 hét': '03',
  'Végrehajtási szakasz': 'Megvalósítás',
  'Moduláris szállítási ciklusok világos mérföldkövekkel, hogy az előrehaladás mindig látható legyen.':
    'Felépítjük a teljes rendszered, majd integráljuk és betanítjuk az AI-t.',
  '4 hét': '04',
  'Teljesítményértékelés': 'Támogatás',
  'Mérjük az eredményeket, követjük a KPI-okat, és a tanulságok alapján finomhangolunk.':
    'Teljes körű partneri támogatás, folyamatos fejlesztés és havi optimalizálás.',
  // kapcsolat-kártyák
  'Dolgozz velünk': 'Következő lépés',
  'Beszélj szakértőinkkel': 'Beszéljünk a vállalkozásodról',
  'Készen állsz részleteiben megismerni ezt a szolgáltatást? Vedd fel a kapcsolatot a Modulabsszal, és nézzük meg együtt, hogyan illeszkedik a céljaidhoz.':
    'Ha most azon gondolkodtál, hogy mindez jól hangzik, de nem tudod, a te helyzetedre is működhet-e — pontosan erről érdemes beszélnünk.',
  'Kérj konzultációt': 'Jelentkezem konzultációra',
  'Határozd meg a kereteket és a prioritásokat egy stratégával.':
    'Átbeszéljük a helyzetedet, a céljaidat és a kihívásaidat.',
  'Szolgáltatási brief letöltése': 'Őszinte véleményt kapsz',
  'Ismerd meg a módszertant, az előnyöket és a bizonyítékokat.':
    'Ha most nem az én szolgáltatásom a legjobb megoldás, azt is megmondom.',
  'Építjük': 'Építsük fel',
  'a holnap üzletét': 'a rendszered',
};

const ABOUT_TEXT = {
  'A holnap üzletét': 'Bizalom, jelenlét,',
  'építjük': 'felelősségvállalás',
  'Küldetésünk': 'Filozófiám',
  'Olyan moduláris tanácsadási rendszereket tervezünk, amelyek':
    'Hiszem, hogy minél tisztábban látjuk, mi fontos számunkra,',
  'a kockázatból eredményt, a felismerésből cselekvést, a stratégiából növekedést formálnak':
    'annál nagyobb hatással lehetünk mások életére. A vállalkozásépítés az egyik legerősebb eszköz erre — mert egy vállalkozás tükröt tart.',
  'Cégek, akikkel együtt dolgoztunk': 'Eszközök, amikkel dolgozom',
  'kik vagyunk': 'Az én történetem',
  'A Modulabs nem elmélet': 'Vállalkozásépítés mint a személyes',
  'Hanem gyakorlati tanácsadás': 'fejlődés legerősebb eszköze',
  'Csapatunk a stratégiát, a dizájnt és a technológiát ötvözve olyan moduláris keretrendszereket épít, amelyeket a cégek valóban használni tudnak — keretrendszereket, amelyek skálázódnak, alkalmazkodnak és mérhető eredményt hoznak.':
    'Egyéni vállalkozóknak segítek, mert magam is az vagyok — ugyanazokkal a kérdésekkel és nehézségekkel küzdök, mint ők. Az elmúlt évek során rengeteg hibát követtem el, és ezekből tanultam a legtöbbet.',
  'A fejlett iparágaktól a gyorsan növekvő startupokig a Modulabs olyan szervezetekkel dolgozik együtt, amelyeknek precizitásra, átláthatóságra és a gyakorlatban is helytálló eredményekre van szükségük.':
    'Úgy gondolom, csak abban lehetek hiteles, amin magam is átmegyek. A saját utamat kínálom fel — azt a tudást és tapasztalatot, amit a hibáimból szűrtem le. Nem elvont elméletet, hanem azt, ami valóban működött, és azt is, ami nem.',
  // karrier -> napló
  'karrier': 'Napló',
  'Csatlakozz csapatunkhoz,': 'Néhány infó',
  'és formáld a mérnöki munka jövőjét': 'még rólam',
  'Nyitott pozíciók': 'Kérdések',
  'Senior adatstratéga': 'Miért pont az AI?',
  'helyszín:': '',
  'San Francisco': 'A fenntarthatóság miatt',
  'Kockázatelemző': 'Mit tanított a 16 év versenysport?',
  '[EU]': 'Hogy egy nagy szerelem után jöhet a másik',
  'Delivery menedzser': 'Mit csinálsz, amikor nem dolgozol?',
  'Varsó': 'Erdőben sétálok, olvasok, főzök',
  'Nem találtad meg a hozzád illőt?': 'Kérdésed van?',
  'Küldd el az önéletrajzod – lehet, hogy éppen ilyen embert keresünk!':
    'Írj bátran, vagy foglalj egy díjmentes konzultációt.',
  'Üzenet küldése': 'Beszéljünk',
  // insights -> referenciák
  'Elemzések': 'Referenciák',
  'Ötletek, kutatások, nézőpontok': 'Akikkel eddig dolgoztam',
  'Összes cikk megtekintése': 'További részletek',
  'Cikk': 'Referencia',
  '2025. szeptember 15.': 'Tanácsadó',
  'Hatékonyság tervezetten: KPI-ok és végrehajtás összehangolása':
    'Dr. Nagyfejő Éva — kiberbiztonsági irányítás',
  'Amikor a stratégia és a működés összeér, mérhető hatékonyságnövekedés következik. Így közelíti meg ezt a Modulabs.':
    'Kiberbiztonsági irányítás és digitális ellenállóképesség — teljes online jelenlét és ügyfélszerző rendszer.',
  'Bizalomépítés átláthatósággal': 'Vitányi Dávid — hangstúdió',
  'Hogyan építenek erősebb ügyfélkapcsolatokat a dashboardok, az auditnaplók és a világos jelentés.':
    'Felvétel, keverés, mastering, filmes hangmunka — weboldal és ügyfélfogadó rendszer.',
  'Építjük': 'Építsük fel',
  'a holnap üzletét': 'a rendszered',
};

const CONTACT_TEXT = {
  'Építsünk együtt átláthatóságot': 'Beszéljünk a vállalkozásodról',
  'Minden nagyszerű projekt egy beszélgetéssel kezdődik.':
    'Minden nagyszerű projekt egy beszélgetéssel kezdődik.',
  '„Az összetett problémáknak nem több zajra van szükségük — hanem struktúrára, átláthatóságra és végrehajtásra.”':
    '„Csak abban lehetek hiteles, amin magam is átmegyek. A saját utamat kínálom fel — azt, ami valóban működött, és azt is, ami nem.”',
  'Jessy Mercedes': 'Nagy Attila',
  '— Alapító, Modulabs': '— Alapító, Business Native',
  'Írj nekünk üzenetet': 'Írj nekem üzenetet',
  'Válaszd ki a megkeresés típusát, és néhány napon belül válaszolunk.':
    'Írd le pár mondatban, hol tartasz — néhány napon belül válaszolok.',
  'Mesélj a projektedről': 'Mesélj a vállalkozásodról',
  'Kérés elküldése': 'Üzenet elküldése',
  'Cégek, akikkel együtt dolgoztunk': 'Eszközök, amikkel dolgozom',
  // "miért mi" kártyák -> konzultációs lépések
  'Kapcsolat': 'Konzultáció',
  'Miért válaszd partnernek a Modulabsot?': 'Mi történik a konzultáción?',
  'Nem csupán projekteket hajtunk végre — a komplexitásból átláthatóságot formálunk.':
    'Egy díjmentes beszélgetés, ami után konkrét irányt kapsz — akkor is, ha nem dolgozunk együtt.',
  'Stratégiai tisztánlátás': 'Konzultáció',
  'Éles célokat határozunk meg, és minden lépést a KPI-okhoz igazítunk.':
    'Átbeszéljük a helyzetedet, a céljaidat és a kihívásaidat, hogy valóban megértsem, hol tartasz most.',
  'Közvetlen hozzáférés': 'Őszinte vélemény',
  'Dolgozz közvetlenül szakértőinkkel — világosan, gyorsan, átláthatóan.':
    'Őszinte véleményt mondok arról, hogy a te élethelyzetedben merre érdemes elindulnod.',
  'Testreszabott tanácsadás': 'Iránymutatás',
  'Az egyedi helyzetedhez igazított keretrendszerek, amelyek a te működésedhez illeszkednek.':
    'Ha most nem az én szolgáltatásom a legjobb megoldás számodra, azt is megmondom — és összekapcsollak a megfelelő szakemberrel.',
  'Építjük': 'Építsük fel',
  'a holnap üzletét': 'a rendszered',
};

/* ----------------------------------------------------------------------- */
/* 4. Képcserék oldalanként: régi assets-fájlnév töredék -> BN kulcs        */
/* ----------------------------------------------------------------------- */

const HOME_IMG = {
  Graph_Image: 'refEva',
  Expandable_Image: 'womanPhone',
  'Expandable_Image-1': 'handsTyping',
  'IMG-3': 'deskWarm',
  Author: 'attila',
  Article_Body_Image: 'duoLaptop',
  Feature_Image: 'womanCall',
  'IMG-4': 'womanDesk',
  'IMG-5': 'officeRoom',
  'IMG-1': 'womanWindow',
  'IMG-6': 'handshake',
};

const SERVICE_IMG = {
  Graph_Image: 'team',
  Author: 'attila',
  End_to_End: 'womanPhone',
  Feature_Image3: 'womanCall',
  Feature_Image: 'handsTyping',
  'IMG-3': 'officeRoom',
};

const ABOUT_IMG = {
  Team_Image: 'story1',
  'Team_Image-1': 'story2',
  'Team_Image-2': 'story3',
  'Team_Image-3': 'womanChair',
  'Team_Image-4': 'womanBlonde',
  'Team_Image-5': 'attilaPhoto',
  Gallery_Image: 'story2',
  'Contact_Support-1': 'story3',
  'IMG-6': 'refEva',
  'IMG-5': 'refDavid',
};

const CONTACT_IMG = {
  Author_Contact: 'attila',
  Contact_Support: 'duoTalk',
  'Contact_Support-1': 'womanPlants',
};

// az ügyfél-logósor helyére az eszköz-logók
const TOOL_LOGOS = [
  'openai', 'notion', 'supabase', 'slack', 'resend', 'posthog', 'midjourney', 'ollama',
];

/* ----------------------------------------------------------------------- */
/* 5. Transzformáció                                                        */
/* ----------------------------------------------------------------------- */

function applyText($, map) {
  const dict = new Map(Object.entries(map).map(([k, v]) => [norm(k), v]));
  let hits = 0;
  $('*').each((_, el) => {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    $(el).contents().each((_, node) => {
      if (node.type !== 'text') return;
      const key = norm(node.data);
      if (!key) return;
      if (dict.has(key)) {
        const lead = node.data.match(/^\s*/)[0];
        const trail = node.data.match(/\s*$/)[0];
        node.data = lead + dict.get(key) + trail;
        hits++;
      }
    });
    for (const attr of ['placeholder', 'alt', 'aria-label', 'data-wait', 'value']) {
      const v = $(el).attr(attr);
      if (v === undefined) continue;
      const key = norm(v);
      if (dict.has(key)) { $(el).attr(attr, dict.get(key)); hits++; }
    }
  });
  return hits;
}

function applyImages($, map) {
  let hits = 0;
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src.startsWith('/assets/')) return;
    // leghosszabb egyező kulcs nyer (IMG-1 vs IMG-10 elkerülése)
    let best = null;
    for (const frag of Object.keys(map)) {
      if (src.includes('_' + frag + '.') || src.includes('_' + frag + '-p-')) {
        if (!best || frag.length > best.length) best = frag;
      }
    }
    if (!best) return;
    const key = map[best];
    if (!localOf[key]) return;
    $(el).attr('src', localOf[key]).removeAttr('srcset').removeAttr('sizes')
      .attr('loading', 'eager');
    hits++;
  });
  return hits;
}

/* Záró márka-söprés: a hosszú bekezdésekben maradt sablon-márkanevek.
   (A pontos egyezésű szótár ezeket nem fogja meg.) */
function brandSweep($) {
  const RE = [
    [/Modulabsszal/g, 'Business Native-val'],
    [/Modulabsnál/g, 'Business Native-nál'],
    [/Modulabshoz/g, 'Business Native-hoz'],
    [/Modulabsot/g, 'Business Native-ot'],
    [/Modulabs/g, 'Business Native'],
    [/BYQ Studio/g, 'Business Native'],
    [/Webflow sablon/gi, ''],
    [/Expert\s*Flow/g, 'Business Native'],
  ];
  let hits = 0;
  $('*').each((_, el) => {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
    $(el).contents().each((_, node) => {
      if (node.type !== 'text') return;
      let d = node.data;
      const before = d;
      for (const [re, rep] of RE) d = d.replace(re, rep);
      if (d !== before) { node.data = d; hits++; }
    });
  });
  return hits;
}

function swapToolLogos($) {
  let i = 0;
  $('img.marquee-logo').each((_, el) => {
    const key = TOOL_LOGOS[i % TOOL_LOGOS.length];
    i++;
    if (!localOf[key]) return;
    $(el).attr('src', localOf[key]).removeAttr('srcset').removeAttr('sizes')
      .attr('alt', key).addClass('bn-tool-logo');
  });
  return i;
}

function cleanup($) {
  // sablon-forgalmazói reklám (BYQ „vásárold meg a sablont")
  $('.sales-cta-master').remove();
  // Webflow badge
  $('.w-webflow-badge').remove();
  // üres telefon-sor a láblécben
  $('a[href^="tel:"]').each((_, el) => {
    if (!norm($(el).text())) $(el).remove();
  });
  // minden e-mail link a BN címre
  $('a[href^="mailto:"]').attr('href', `mailto:${EMAIL}`);
  // sablonbolt-linkek -> saját oldalak
  $('a[href*="byq.supply"], a[href*="webflow.io"], a[href*="webflow.com"]').each((_, el) => {
    $(el).attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');
  });
  // LinkedIn placeholder -> YouTube
  $('a[href="https://linkedin.com"]').attr('href', YT).attr('aria-label', 'YouTube');
}

function rewriteNav($) {
  // fő navigáció: 4 oldal
  const LINKS = [
    ['/', 'Főoldal'],
    ['/szolgaltatas', 'Szolgáltatás'],
    ['/rolam', 'Rólam'],
    ['/kapcsolat', 'Kapcsolat'],
  ];
  $('.navbar .nav-link, .wrap-mobile-menu .nav-link').each((_, el) => {
    const $el = $(el);
    // a legördülő menüket kivesszük
    if ($el.closest('.w-dropdown').length) { $el.closest('.w-dropdown').remove(); return; }
  });
  const $nav = $('.navbar').find('nav, .nav-menu, .wrap-nav-links').first();
  if ($nav.length) {
    $nav.find('.nav-link, .w-dropdown').remove();
    for (const [href, label] of LINKS) {
      $nav.append(`<a href="${href}" class="nav-link">${label}</a>`);
    }
  }
  // fejléc CTA -> Cal.com
  $('.cta-small, .navbar a.button, .navbar .btn').each((_, el) => {
    $(el).attr('href', CAL).attr('target', '_blank').attr('rel', 'noopener');
  });
}

function rewriteFooter($) {
  const COLS = [
    ['Oldalak', [['/', 'Főoldal'], ['/szolgaltatas', 'Szolgáltatás'], ['/rolam', 'Rólam'], ['/kapcsolat', 'Kapcsolat']]],
    ['Referenciák', [[CAL, 'Konzultáció foglalás'], [YT, 'YouTube']]],
    ['Jogi', [['/privacy-policy', 'Adatvédelem']]],
  ];
  const $cols = $('.footer-columns');
  if (!$cols.length) return;
  const $items = $cols.children();
  $items.each((i, el) => {
    const col = COLS[i];
    if (!col) { $(el).remove(); return; }
    const $el = $(el);
    // oszlopcím
    const $title = $el.children().first();
    $title.text(col[0]);
    // linkek
    const $links = $el.find('a');
    $links.each((j, a) => {
      if (j < col[1].length) {
        const ext = col[1][j][0].startsWith('http');
        $(a).attr('href', col[1][j][0]).text(col[1][j][1]);
        if (ext) $(a).attr('target', '_blank').attr('rel', 'noopener');
      } else $(a).remove();
    });
  });
}

/* Valódi referenciák — kitalált testimonial helyett.
   Nincs idézet, mert a forrásoldalon sincs: csak tényszerű projektleírás. */
const REFERENCES = [
  {
    title: 'Kiberbiztonsági irányítás és digitális ellenállóképesség — teljes online jelenlét és ügyfélszerző rendszer.',
    name: 'Dr. Nagyfejő Éva',
    role: '— Tanácsadó',
  },
  {
    title: 'Hangstúdió: felvétel, keverés, mastering és filmes hangmunka — weboldal és ügyfélfogadó rendszer.',
    name: 'Vitányi Dávid',
    role: '— Hangstúdió',
  },
];

function fixTestimonials($) {
  const $slides = $('.card-case-tall');
  if (!$slides.length) return 0;
  $slides.each((i, el) => {
    const $s = $(el);
    if (i >= REFERENCES.length) {
      // a felesleges (ismétlődő) diákat kivesszük
      const $slide = $s.closest('.w-slide');
      ($slide.length ? $slide : $s).remove();
      return;
    }
    const r = REFERENCES[i];
    // a legelső hosszú szövegcsomópont az idézet, utána a név és a szerep
    const texts = [];
    $s.find('*').each((_, n) => {
      $(n).contents().each((_, c) => {
        if (c.type === 'text' && norm(c.data).length > 1) texts.push(c);
      });
    });
    if (texts[0]) texts[0].data = r.title;
    if (texts[1]) texts[1].data = r.name;
    if (texts[2]) texts[2].data = r.role;
    $s.find('img').attr('src', localOf.attila || '').removeAttr('srcset').removeAttr('sizes');
  });
  return REFERENCES.length;
}

/* A hero kis kártyája a főoldalon: valódi referencia */
function fixHeroCard($) {
  const $card = $('.hero-home-b-section').find('.case-small').first();
  if (!$card.length) return;
  $card.find('h6, h5, h4').first().text('Kiberbiztonsági irányítás és digitális ellenállóképesség');
  if (localOf.refEva) {
    $card.find('img').first().attr('src', localOf.refEva)
      .removeAttr('srcset').removeAttr('sizes').attr('loading', 'eager');
  }
}

/* CSS: eszköz-logók fehérré, Webflow-badge el, referencia-képek illesztése */
const EXTRA_CSS = `
<style id="bn-overrides">
  .bn-tool-logo{filter:brightness(0) invert(1);opacity:.82}
  .bn-tool-logo:hover{opacity:1}
  .w-webflow-badge{display:none !important}
</style>`;

/* ----------------------------------------------------------------------- */

const PAGES = [
  {
    src: 'index.html', out: 'index.html', text: HOME_TEXT, img: HOME_IMG,
    title: 'Business Native — AI-alapú rendszerek egyéni vállalkozóknak',
    desc: 'Szolgáltatási rendszert építek a vállalkozásod köré, amely láthatóvá és értékesíthetővé teszi a szakmai tudásodat.',
  },
  {
    src: 'service/service-a.html', out: 'szolgaltatas.html', text: SERVICE_TEXT, img: SERVICE_IMG,
    title: 'Szolgáltatás — Business Native',
    desc: 'Három pillér, egy vállalkozás: ügyfélszerzés, kiszolgálás és háttérműködés egyetlen összehangolt rendszerben.',
  },
  {
    src: 'about.html', out: 'rolam.html', text: ABOUT_TEXT, img: ABOUT_IMG,
    title: 'Rólam — Business Native',
    desc: 'Nagy Attila vagyok. Egyéni vállalkozóknak segítek AI-alapú rendszerekkel — mert magam is az vagyok.',
  },
  {
    src: 'contact/contact-a.html', out: 'kapcsolat.html', text: CONTACT_TEXT, img: CONTACT_IMG,
    title: 'Kapcsolat — Business Native',
    desc: 'Beszéljünk a vállalkozásodról. Díjmentes konzultáció, ami után konkrét irányt kapsz.',
  },
];

// szekciók, amiket eltávolítunk (nincs rá valós BN-tartalom)
const REMOVE = {
  'rolam.html': ['.about-numbers-section', '.leadership-section'],
  'kapcsolat.html': ['.leadership-section'],
};

await fetchAssets();

for (const page of PAGES) {
  const srcPath = join(OUT, page.src);
  if (!existsSync(srcPath)) { console.log(`SKIP (nincs meg): ${page.src}`); continue; }
  const $ = cheerio.load(readFileSync(srcPath, 'utf8'));

  // kapcsolat-oldal: irodák + térkép szekció ki (nincs iroda)
  if (page.out === 'kapcsolat.html') {
    const $off = $('.offices-halves');
    if ($off.length) $off.closest('section').remove();
  }
  for (const sel of REMOVE[page.out] || []) $(sel).remove();

  const t1 = applyText($, page.text);
  const t2 = applyText($, GLOBAL_TEXT);
  const i1 = applyImages($, page.img);
  const i2 = swapToolLogos($);
  if (page.out === 'index.html') { fixTestimonials($); fixHeroCard($); }
  cleanup($);
  rewriteNav($);
  rewriteFooter($);
  const t3 = brandSweep($);

  $('title').text(page.title);
  // meta-adatok (SEO + megosztás)
  $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]')
    .attr('content', page.desc);
  $('meta[property="og:title"], meta[name="twitter:title"]').attr('content', page.title);
  $('head').append(EXTRA_CSS);

  const outPath = join(OUT, page.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, $.html());
  console.log(`BN ${page.out}: ${t1} oldal-szöveg, ${t2} globális, ${t3} márka-söprés, ${i1} kép, ${i2} eszköz-logó`);
}

console.log('BN tartalom kész.');
