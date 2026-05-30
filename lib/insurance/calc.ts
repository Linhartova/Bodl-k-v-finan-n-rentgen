import type { ExtractedInsurance, InsuranceResult } from "./types";

// Výchozí jednotková cena výstavby (Kč/m²) pro odhad reprodukční (nové) hodnoty
// stavby. Lze přepsat přes env STAVEBNI_NAKLAD_M2. Hodnota odpovídá běžným
// nákladům na novou výstavbu rodinného domu v ČR (2026).
const DEFAULT_NAKLAD_M2 = 45000;

export function getNakladM2(): number {
  const raw = process.env.STAVEBNI_NAKLAD_M2;
  const parsed = raw ? Number(raw.replace(/\s/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NAKLAD_M2;
}

// Tolerance podpojištění – pojišťovny obvykle drobné podpojištění promíjí.
// Klienta označíme za podpojištěného, až když krytí klesne pod tuto hranici.
const PRAH_PODPOJISTENI = 0.95;

// Orientační hodnota vybavení domácnosti na m² (Kč/m²) pro doporučenou pojistnou
// částku domácnosti. Lze přepsat přes env DOMACNOST_NAKLAD_M2.
const DEFAULT_DOMACNOST_M2 = 12000;

export function getDomacnostM2(): number {
  const raw = process.env.DOMACNOST_NAKLAD_M2;
  const parsed = raw ? Number(raw.replace(/\s/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DOMACNOST_M2;
}

// Je nemovitost byt (jednotka)? U bytu bývá stavba pojištěná přes SVJ/družstvo,
// takže chybějící pojištění stavby na bytu hlásíme měkčeji než u domu.
function jeByt(typ: string | null): boolean {
  return /(byt|jednotk)/.test((typ || "").toLowerCase());
}

// Koeficient podle typu nemovitosti (rekreační objekty jsou levnější na stavbu,
// byty se počítají jako bytová jednotka bez podílu na pozemku).
function typKoeficient(typ: string | null): number {
  const t = (typ || "").toLowerCase();
  if (/(rekrea|chat|chalup|chata)/.test(t)) return 0.7;
  if (/(byt|jednotk)/.test(t)) return 0.9;
  return 1.0; // dům / rodinný dům / ostatní
}

// Regionální koeficient odvozený z adresy – stavební náklady se liší méně než
// tržní cena, takže rozdíly držíme mírné.
function regionKoeficient(adresa: string | null): number {
  const a = (adresa || "").toLowerCase();
  if (/praha|praa|prague|\b1\d\d \d\d\b/.test(a)) return 1.2;
  if (/(brno|plze|ostrava|liberec|olomouc|hradec|budjovic|budějovic)/.test(a)) return 1.1;
  return 1.0;
}

// Spoluúčast může být v % (ze škody) nebo pevná částka v Kč. Vrací Kč.
// Pozn.: text často obsahuje doplňkovou klauzuli "(min. 1 000 Kč)" – tu při
// parsování ignorujeme, ať se číslice neslepí (např. "1 % (min. 1 000 Kč)"
// nesmí dát 1,1 %, ale 1 %).
function spoluucastNaKc(raw: string | null, skoda: number): number {
  if (!raw) return 0;
  if (raw.includes("%")) {
    // Procento: vezmi číslo před znakem '%'.
    const m = raw.split("%")[0].match(/[0-9]+(?:[.,][0-9]+)?/);
    const pct = m ? parseFloat(m[0].replace(",", ".")) : NaN;
    return Number.isFinite(pct) && pct > 0 ? Math.round((skoda * pct) / 100) : 0;
  }
  // Pevná částka v Kč: ber jen část před "min"/"max" a spoj číslice (oddělovače tisíců).
  const digits = raw.split(/min|max/i)[0].replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Odhadne reprodukční (novou) hodnotu stavby a posoudí podpojištění.
 * Při totální škodě se uplatní pravidlo proporcionality: je-li pojistná částka
 * nižší než pojistná hodnota, pojišťovna krátí plnění ve stejném poměru, takže
 * klient nikdy nedostane víc, než je sjednaná pojistná částka.
 */
export function analyzeInsurance(ins: ExtractedInsurance): InsuranceResult {
  const cenaZaM2 = getNakladM2();
  const predpoklady: string[] = [];

  const typK = typKoeficient(ins.typNemovitosti);
  const regK = regionKoeficient(ins.adresa);

  let soucasnaHodnota: number | null = null;
  if (ins.obytnaPlocha && ins.obytnaPlocha > 0) {
    soucasnaHodnota = Math.round(ins.obytnaPlocha * cenaZaM2 * typK * regK);
    predpoklady.push(
      `Reprodukční hodnota = ${ins.obytnaPlocha} m² × ${formatKc(cenaZaM2)}/m²` +
        (typK !== 1 ? ` × ${typK} (typ nemovitosti)` : "") +
        (regK !== 1 ? ` × ${regK} (lokalita)` : "")
    );
  } else {
    predpoklady.push(
      "Obytná plocha nebyla ve smlouvě nalezena – hodnotu stavby nelze odhadnout."
    );
  }

  const pojistnaCastka = ins.pojistnaCastkaNemovitost;
  const domacnostCastka = ins.pojistnaCastkaDomacnost;

  // Co smlouva skutečně kryje.
  const maStavbu = !!(pojistnaCastka && pojistnaCastka > 0);
  const maDomacnost = !!(domacnostCastka && domacnostCastka > 0);

  let pomerKryti: number | null = null;
  let podpojisteny = false;
  let spoluucastKc = 0;
  let plneniProTotalniSkodu: number | null = null;
  let ztrataProKlienta: number | null = null;
  const doporuceni: string[] = [];

  // --- Analýza stavby (jen pokud je pojištěná) ---
  if (soucasnaHodnota && soucasnaHodnota > 0 && maStavbu) {
    pomerKryti = Number((pojistnaCastka! / soucasnaHodnota).toFixed(4));
    podpojisteny = pomerKryti < PRAH_PODPOJISTENI;

    // Totální škoda = celá reprodukční hodnota stavby.
    const skoda = soucasnaHodnota;
    spoluucastKc = spoluucastNaKc(ins.spoluucast, skoda);

    // Pravidlo proporcionality při totální škodě: plnění = škoda × (PČ / hodnota),
    // což se rovná pojistné částce (PČ je strop). Počítáme přímo ze stropu, ať se
    // nezanáší zaokrouhlení z pomerKryti.
    const plneniHrube = Math.min(skoda, pojistnaCastka!);
    plneniProTotalniSkodu = Math.max(0, Math.round(plneniHrube - spoluucastKc));
    ztrataProKlienta = Math.max(0, Math.round(skoda - plneniProTotalniSkodu));

    if (podpojisteny) {
      predpoklady.push(
        `Pojistná částka pokrývá jen ${Math.round(pomerKryti * 100)} % hodnoty – ` +
          "při totální škodě pojišťovna krátí plnění ve stejném poměru."
      );
    }
    if (spoluucastKc > 0) {
      predpoklady.push(`Spoluúčast ${formatKc(spoluucastKc)} odečtena od plnění.`);
    }
  } else if (soucasnaHodnota && !maStavbu) {
    predpoklady.push("Pojistná částka stavby nebyla ve smlouvě nalezena.");
  }

  // --- Doporučená částka domácnosti (orientačně z plochy) ---
  let domacnostDoporucena: number | null = null;
  if (ins.obytnaPlocha && ins.obytnaPlocha > 0) {
    domacnostDoporucena = Math.round(ins.obytnaPlocha * getDomacnostM2());
  }

  // --- Doporučení podle toho, co ve smlouvě chybí ---
  if (!maStavbu) {
    if (jeByt(ins.typNemovitosti)) {
      doporuceni.push(
        "Smlouva kryje jen domácnost (vybavení). U bytu bývá samotná stavba " +
          "pojištěná přes SVJ/družstvo – ověř, že máš krytí i na vlastní stavební " +
          "úpravy (kuchyně, podlahy, příčky)."
      );
    } else {
      const odhad =
        soucasnaHodnota != null ? ` Odhad hodnoty stavby je ${formatKc(soucasnaHodnota)}.` : "";
      doporuceni.push(
        "Smlouva nekryje samotnou stavbu. Při požáru, výbuchu či povodni bys na " +
          "obnovu budovy nedostal nic – doporučujeme doplnit pojištění stavby." +
          odhad
      );
    }
  }
  if (!maDomacnost) {
    const odhad =
      domacnostDoporucena != null
        ? ` Orientačně doporučujeme částku kolem ${formatKc(domacnostDoporucena)}.`
        : "";
    doporuceni.push(
      "Smlouva nekryje vybavení domácnosti. Nábytek, elektronika a osobní věci by " +
        "při škodě nebyly pojištěné – doporučujeme doplnit pojištění domácnosti." +
        odhad
    );
  } else if (
    domacnostDoporucena != null &&
    domacnostCastka! < domacnostDoporucena * 0.5
  ) {
    // Domácnost je pojištěná, ale částka je výrazně nízká – měkké doporučení.
    doporuceni.push(
      `Pojistná částka domácnosti (${formatKc(domacnostCastka!)}) je výrazně nižší ` +
        `než orientační hodnota vybavení (~${formatKc(domacnostDoporucena)}). Zvaž navýšení.`
    );
  }

  return {
    maStavbu,
    maDomacnost,
    soucasnaHodnota,
    cenaZaM2,
    pojistnaCastka: pojistnaCastka ?? null,
    pomerKryti,
    podpojisteny,
    spoluucastKc,
    plneniProTotalniSkodu,
    ztrataProKlienta,
    domacnostCastka: domacnostCastka ?? null,
    domacnostDoporucena,
    doporuceni,
    predpoklady,
  };
}

// Formátování částky v Kč pro UI (vlastní kopie, ať modul nezávisí na úvěrovém).
export function formatKc(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}
