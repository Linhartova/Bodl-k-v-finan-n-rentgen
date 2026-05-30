// ---------------------------------------------------------------------------
// BODLÍKOVO FINANČNÍ SKÓRE – sdílená logika výsledku pro všechny tři kontroly.
// Sjednocuje výstup (skóre 0–100, měsíční/roční úspora, rizika, doporučení) tak,
// aby aplikace působila jako finanční asistent, ne jako kalkulačka.
// ---------------------------------------------------------------------------
import type { ExtractedLoan, SavingsResult } from "./types";
import type { ExtractedInsurance, InsuranceResult } from "./insurance/types";
import type { ExtractedLife, LifeResult } from "./zivot/types";

export type RiskLevel = "good" | "warn" | "bad"; // zelená / oranžová / červená

export interface ScoreRisk {
  level: RiskLevel;
  text: string;
}

export interface ScoreResult {
  produkt: "uver" | "nemovitost" | "zivot";
  score: number; // 0–100
  mesicniUspora: number; // Kč/měsíc, kolik lze získat zpět (0 = nerelevantní)
  rocniUspora: number; // Kč/rok – "spící peníze" (0 = nerelevantní)
  rizikoCastka: number; // Kč – kolik klient riskuje (podpojištění apod.), 0 = žádné
  risks: ScoreRisk[];
  doporuceni: string[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pasmoSkore(score: number): RiskLevel {
  if (score >= 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export function formatKc(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

// --- ÚVĚR -------------------------------------------------------------------
export function scoreLoan(loan: ExtractedLoan, savings: SavingsResult): ScoreResult {
  const rocniUspora = Math.max(0, savings.rocniUspora);
  const mesicniUspora = rocniUspora > 0 ? Math.round(rocniUspora / 12) : 0;
  const rozdil = savings.rozdilSazby;

  // Čím víc klient přeplácí, tím nižší skóre. Žádný rozdíl ⇒ skóre vysoké.
  let score = rozdil <= 0 ? 92 : clamp(Math.round(100 - rozdil * 22), 35, 88);
  if (savings.urgentni) score = clamp(score - 6, 30, 100);

  const risks: ScoreRisk[] = [];
  if (rozdil <= 0.3) {
    risks.push({ level: "good", text: "Úroková sazba odpovídá trhu" });
  } else if (rozdil <= 1) {
    risks.push({ level: "warn", text: "Hypotéka pravděpodobně přeplácená" });
  } else {
    risks.push({
      level: "bad",
      text: `Platíš výrazně víc, než je tržní sazba (o ${String(rozdil).replace(".", ",")} %)`,
    });
  }
  if (savings.urgentni && savings.mesicuDoFixace !== null) {
    risks.push({
      level: "warn",
      text: `Fixace končí za ${savings.mesicuDoFixace} měs. – ideální čas refinancovat`,
    });
  }

  const doporuceni: string[] = [];
  if (rocniUspora > 0) {
    doporuceni.push(
      `Refinancováním na tržní sazbu ${savings.trzniSazba} % můžeš snížit splátku a získat zpět ` +
        `až ${formatKc(rocniUspora)} ročně.`
    );
  } else {
    doporuceni.push(
      "Tvoje sazba je blízko trhu. Krátká kontrola u poradce přesto potvrdí, že neplatíš zbytečně."
    );
  }
  if (savings.urgentni) {
    doporuceni.push("Řeš refinancování ještě před koncem fixace – po něm bývají podmínky horší.");
  }

  return { produkt: "uver", score, mesicniUspora, rocniUspora, rizikoCastka: 0, risks, doporuceni };
}

// --- NEMOVITOST -------------------------------------------------------------
export function scoreProperty(ins: ExtractedInsurance, result: InsuranceResult): ScoreResult {
  const rizikoCastka =
    result.ztrataProKlienta != null && result.ztrataProKlienta > 0 ? result.ztrataProKlienta : 0;
  const kryti = result.pomerKryti;

  let score: number;
  if (!result.maStavbu) {
    score = 45;
  } else if (result.podpojisteny && kryti != null) {
    score = clamp(Math.round(kryti * 75), 25, 70);
  } else if (kryti != null) {
    score = clamp(Math.round(kryti * 100), 80, 98);
  } else {
    score = 70; // stavba pojištěná, ale neumíme spočítat poměr (chybí plocha)
  }
  if (!result.maDomacnost) score = clamp(score - 8, 20, 100);

  const risks: ScoreRisk[] = [];
  const isByt = /(byt|jednotk)/i.test(ins.typNemovitosti ?? "");
  if (result.maStavbu && !result.podpojisteny) {
    risks.push({ level: "good", text: "Krytí nemovitosti v pořádku" });
  } else if (result.maStavbu && result.podpojisteny) {
    risks.push({ level: "bad", text: "Nemovitost je podpojištěná – hrozí krácení plnění" });
  } else {
    risks.push({
      level: isByt ? "warn" : "bad",
      text: isByt ? "Smlouva kryje jen domácnost, ne stavbu" : "Smlouva nekryje samotnou stavbu",
    });
  }
  risks.push(
    result.maDomacnost
      ? { level: "good", text: "Domácnost (vybavení) je pojištěná" }
      : { level: "warn", text: "Vybavení domácnosti není pojištěné" }
  );

  return {
    produkt: "nemovitost",
    score,
    mesicniUspora: 0,
    rocniUspora: 0,
    rizikoCastka,
    risks,
    doporuceni: result.doporuceni,
  };
}

// --- ŽIVOTNÍ POJIŠTĚNÍ ------------------------------------------------------
export function scoreLife(life: ExtractedLife, result: LifeResult): ScoreResult {
  const rocniUspora =
    result.jeInvesticni && result.odhadUsporaPojistne ? result.odhadUsporaPojistne : 0;
  const mesicniUspora = rocniUspora > 0 ? Math.round(rocniUspora / 12) : 0;

  let score = 92;
  if (result.chybiInvalidita) score -= 38;
  else if (result.podpojistenyInvalidita) score -= 16;
  if (result.podpojistenySmrt) score -= 18;
  if (result.invaliditaNeOd1) score -= 6;
  if (result.jeInvesticni) score -= 10;
  score = clamp(Math.round(score), 18, 95);

  const risks: ScoreRisk[] = [];
  if (result.chybiInvalidita) {
    risks.push({ level: "bad", text: "Nedostatečné krytí invalidity 3. stupně" });
  } else if (result.podpojistenyInvalidita) {
    risks.push({
      level: "warn",
      text: `Krytí invalidity je nižší než doporučení (chybí ${formatKc(result.mezeraInvalidita)})`,
    });
  } else {
    risks.push({ level: "good", text: "Krytí invalidity v pořádku" });
  }
  if (result.podpojistenySmrt) {
    risks.push({
      level: "warn",
      text: `Krytí pro případ smrti je podpojištěné (chybí ${formatKc(result.mezeraSmrt)})`,
    });
  } else {
    risks.push({ level: "good", text: "Krytí pro případ smrti odpovídá doporučení" });
  }
  if (result.jeInvesticni && rocniUspora > 0) {
    risks.push({
      level: "warn",
      text: `Investiční pojištění – ~${formatKc(rocniUspora)} ročně jde mimo ochranu`,
    });
  }

  const doporuceni: string[] = [];
  if (result.chybiInvalidita) {
    doporuceni.push(
      "Doplň krytí invalidity 3. stupně – je to nejvážnější opomíjené riziko, výpadek příjmu na desítky let."
    );
  }
  if (result.celkovaMezera > 0) {
    doporuceni.push(
      `Navýšení krytí klíčových rizik o ${formatKc(result.celkovaMezera)} dorovná mezeru oproti doporučení.`
    );
  }
  if (rocniUspora > 0) {
    doporuceni.push(
      `Přechodem z investičního na rizikové pojištění získáš zpět až ${formatKc(rocniUspora)} ročně při stejné ochraně.`
    );
  }
  if (doporuceni.length === 0) {
    doporuceni.push("Tvoje životní pojištění vypadá dobře. Poradce ti nastavení zdarma potvrdí.");
  }

  // Riziková částka = mezera v krytí (kolik ti chybí), pro headline když není úspora.
  const rizikoCastka = rocniUspora > 0 ? 0 : result.celkovaMezera;

  return { produkt: "zivot", score, mesicniUspora, rocniUspora, rizikoCastka, risks, doporuceni };
}
