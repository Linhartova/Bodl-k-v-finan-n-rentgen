// Data vytažená OCR ze smlouvy o úvěru
export interface ExtractedLoan {
  produkt: string | null; // např. "Hypoteční úvěr", "Spotřebitelský úvěr"
  poskytovatel: string | null; // banka / poskytovatel
  vyseUveru: number | null; // jistina / zůstatek úvěru v Kč
  sazba: number | null; // úroková sazba v % p.a.
  datumFixace: string | null; // konec fixace, ISO formát YYYY-MM-DD pokud lze
  splatnostMesicu: number | null; // zbývající splatnost v měsících (pokud lze zjistit)
  // důvěra modelu, zda šlo o čitelný úvěrový dokument
  jeUverovaSmlouva: boolean;
  poznamka: string | null; // cokoli, co model chce dodat (např. nečitelné pole)
}

// Výsledek výpočtu úspory
export interface SavingsResult {
  trzniSazba: number; // referenční sazba použitá pro výpočet (%)
  rozdilSazby: number; // o kolik % klient přeplácí (může být 0)
  rocniUspora: number; // odhad roční úspory v Kč
  usporaDoFixace: number | null; // úspora do konce fixace v Kč (pokud známe datum)
  mesicuDoFixace: number | null; // kolik měsíců zbývá do konce fixace
  urgentni: boolean; // fixace končí brzy (do 12 měsíců)
}

// Lead odesílaný poradci / do Pipedrive
export interface Lead {
  jmeno: string;
  email: string;
  telefon: string;
  loan: ExtractedLoan;
  savings: SavingsResult;
}

// Pozn.: celé flow pojištění majetku je v samostatné složce `lib/insurance/`
// (typy, výpočet, e-mail) + `app/api/insurance/`, aby se s úvěrem nemíchalo.
