// ---------------------------------------------------------------------------
// ŽIVOTNÍ POJIŠTĚNÍ – typy (samostatný modul, oddělené od úvěru i majetku)
// ---------------------------------------------------------------------------

// Data vytažená OCR ze smlouvy o životním pojištění
export interface ExtractedLife {
  // --- Údaje ze smlouvy ---
  mesicniPojistne: number | null; // měsíční pojistné v Kč
  pojistovna: string | null; // název pojišťovny
  nazevProduktu: string | null; // obchodní název produktu
  datumSjednani: string | null; // datum sjednání, ISO YYYY-MM-DD pokud lze
  dobaTrvani: string | null; // doba trvání smlouvy ("do 65 let", "30 let")
  datumKonce: string | null; // konec pojištění, ISO YYYY-MM-DD pokud lze
  pojisteneOsoby: string | null; // jména / výčet pojištěných osob
  vek: number | null; // věk hlavní pojištěné osoby
  kurak: string | null; // "kuřák" | "nekuřák" | null

  // --- Smrt ---
  smrtJakakolivPricina: number | null; // pojistná částka smrt z jakékoliv příčiny (Kč)
  smrtUrazem: number | null; // pojistná částka smrt úrazem (Kč)

  // --- Invalidita ---
  invalidita1: number | null; // pojistná částka invalidita 1. stupně (Kč)
  invalidita2: number | null; // pojistná částka invalidita 2. stupně (Kč)
  invalidita3: number | null; // pojistná částka invalidita 3. stupně (Kč)
  invaliditaOd1: boolean | null; // krytí již od 1. stupně (ideální nastavení)

  // --- Závažná onemocnění ---
  zavazneNemociCastka: number | null; // pojistná částka závažná onemocnění (Kč)
  zavazneNemociRozsah: string | null; // rozsah diagnóz (např. "počet diagnóz / výčet")

  // --- Dlouhodobá pracovní neschopnost ---
  pracovniNeschopnostDenniDavka: number | null; // denní dávka (Kč/den)
  pracovniNeschopnostKarence: string | null; // karenční doba (např. "od 29. dne")

  // --- Hospitalizace ---
  hospitalizaceDenniDavka: number | null; // denní dávka při hospitalizaci (Kč/den)

  // --- Trvalé následky úrazu ---
  trvaleNasledkyCastka: number | null; // pojistná částka trvalé následky úrazu (Kč)
  trvaleNasledkyProgrese: string | null; // progrese plnění (např. "až 500 %")

  // --- Invalidita následkem úrazu ---
  invaliditaUrazCastka: number | null; // pojistná částka invalidita následkem úrazu (Kč)

  // --- Ošetřování člena rodiny ---
  osetrovaniClena: boolean | null; // kryto ano/ne

  // --- Parametry produktu ---
  typPojisteni: string | null; // "investiční (IŽP)" | "rizikové ŽP" | "kapitálové (KŽP)"
  sporiciSlozka: number | null; // měsíční spořicí / investiční složka (Kč)
  mimoradnePoplatky: string | null; // popis mimořádných poplatků
  pripojisteniDeti: boolean | null; // jsou pojištěny i děti ano/ne
  vyluky: string | null; // důležité výluky z pojištění

  // důvěra modelu, zda šlo o čitelnou smlouvu o životním pojištění
  jePojistnaSmlouva: boolean;
  poznamka: string | null; // cokoli, co model chce dodat (např. nečitelné pole)

  // --- Personalizace (NEjsou na smlouvě – doplní klient v kroku kontroly) ---
  rocniPrijem: number | null; // čistý roční příjem domácnosti (Kč)
  dluhy: number | null; // zbývající dluhy / hypotéka k zajištění (Kč)
}

// Výsledek analýzy nastavení životního pojištění
export interface LifeResult {
  rocniPojistne: number | null; // roční pojistné (z měsíčního × 12)

  // doporučené krytí klíčových rizik
  doporucenaSmrt: number; // doporučená pojistná částka pro případ smrti (Kč)
  doporucenaInvalidita: number; // doporučená pojistná částka invalidity 3. st. (Kč)

  // mezery v krytí (kolik chybí proti doporučení)
  mezeraSmrt: number; // max(0, doporučená − sjednaná) pro smrt (Kč)
  mezeraInvalidita: number; // max(0, doporučená − sjednaná) pro invaliditu (Kč)
  celkovaMezera: number; // headline: mezeraSmrt + mezeraInvalidita (Kč)

  // signály nevhodného nastavení
  chybiInvalidita: boolean; // invalidita 3. stupně není sjednaná / je 0
  podpojistenySmrt: boolean; // krytí smrti pod doporučením
  podpojistenyInvalidita: boolean; // krytí invalidity pod doporučením
  invaliditaNeOd1: boolean; // invalidita není krytá od 1. stupně (není ideální)

  // drahé investiční / kapitálové pojištění
  jeInvesticni: boolean; // typ je IŽP / KŽP (spoření v pojistce)
  odhadUsporaPojistne: number | null; // odhad roční úspory přechodem na rizikové (Kč)

  predpoklady: string[]; // přehled předpokladů odhadu (pro transparentnost)
}

// Lead z kontroly životního pojištění
export interface LifeLead {
  jmeno: string;
  email: string;
  telefon: string;
  life: ExtractedLife;
  result: LifeResult;
}
