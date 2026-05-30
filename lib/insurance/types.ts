// ---------------------------------------------------------------------------
// POJIŠTĚNÍ MAJETKU – typy (samostatný modul, oddělené od úvěrového flow)
// ---------------------------------------------------------------------------

// Data vytažená OCR z pojistné smlouvy nemovitosti / domácnosti
export interface ExtractedInsurance {
  typNemovitosti: string | null; // "byt" | "dům" | "rekreační objekt" | …
  adresa: string | null; // adresa pojištěné nemovitosti
  rokVystavby: number | null; // rok výstavby
  rokRekonstrukce: number | null; // rok poslední rekonstrukce (pokud uveden)
  obytnaPlocha: number | null; // obytná / podlahová plocha v m²
  pojistnaCastkaNemovitost: number | null; // pojistná částka stavby v Kč
  pojistnaCastkaDomacnost: number | null; // pojistná částka domácnosti v Kč
  rocniPojistne: number | null; // roční pojistné v Kč
  spoluucast: string | null; // spoluúčast, např. "1 %" nebo "5 000 Kč"
  pojistenaRizika: string | null; // výčet rizik (požár, voda, vichřice …)
  datumSjednani: string | null; // datum sjednání, ISO YYYY-MM-DD pokud lze
  datumAktualizace: string | null; // datum poslední aktualizace smlouvy
  pojistovna: string | null; // název pojišťovny
  // důvěra modelu, zda šlo o čitelnou pojistnou smlouvu majetku
  jePojistnaSmlouva: boolean;
  poznamka: string | null; // cokoli, co model chce dodat (např. nečitelné pole)
}

// Výsledek analýzy podpojištění
export interface InsuranceResult {
  // Co smlouva kryje (stavba / domácnost / obojí)
  maStavbu: boolean; // smlouva má pojistnou částku stavby
  maDomacnost: boolean; // smlouva má pojistnou částku domácnosti

  // --- Stavba ---
  soucasnaHodnota: number | null; // odhad reprodukční (nové) hodnoty stavby v Kč
  cenaZaM2: number; // použitá jednotková cena stavby (Kč/m²)
  pojistnaCastka: number | null; // pojistná částka stavby ze smlouvy (Kč)
  pomerKryti: number | null; // pojistnaCastka / soucasnaHodnota (1 = plně kryto)
  podpojisteny: boolean; // true, pokud pojistná částka výrazně < hodnota
  spoluucastKc: number; // spoluúčast přepočtená na Kč pro totální škodu
  plneniProTotalniSkodu: number | null; // kolik klient reálně dostane (Kč)
  ztrataProKlienta: number | null; // o kolik peněz přijde při totální škodě (Kč)

  // --- Domácnost ---
  domacnostCastka: number | null; // pojistná částka domácnosti ze smlouvy (Kč)
  domacnostDoporucena: number | null; // orientační doporučená částka domácnosti (Kč)

  // Doporučení – chybějící nebo nízké krytí (texty k zobrazení klientovi)
  doporuceni: string[];
  predpoklady: string[]; // přehled předpokladů odhadu (pro transparentnost)
}

// Lead z kontroly pojištění majetku
export interface InsuranceLead {
  jmeno: string;
  email: string;
  telefon: string;
  insurance: ExtractedInsurance;
  result: InsuranceResult;
}
