import type { ExtractedLoan, SavingsResult } from "./types";

// Výchozí referenční tržní sazba (%), lze přepsat přes env MARKET_RATE.
const DEFAULT_MARKET_RATE = 4.5;

// Pokud ze smlouvy nezjistíme zbývající splatnost, použijeme tento odhad (měsíce).
const FALLBACK_SPLATNOST_MESICU = 240; // 20 let

export function getMarketRate(): number {
  const raw = process.env.MARKET_RATE;
  const parsed = raw ? Number(raw.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MARKET_RATE;
}

// Měsíční anuitní splátka.
function annuity(principal: number, ratePct: number, months: number): number {
  const r = ratePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

function mesicuDoData(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return months; // může být i záporné (fixace už proběhla)
}

/**
 * Spočítá odhad roční úspory při refinancování na referenční tržní sazbu.
 * Robustní vůči chybějícím polím z OCR.
 */
export function calculateSavings(loan: ExtractedLoan): SavingsResult {
  const trzniSazba = getMarketRate();

  const sazba = loan.sazba ?? 0;
  const rozdilSazby = Math.max(0, Number((sazba - trzniSazba).toFixed(2)));

  const vyse = loan.vyseUveru;
  const mesicu = loan.splatnostMesicu ?? FALLBACK_SPLATNOST_MESICU;

  let rocniUspora = 0;
  if (vyse && vyse > 0 && rozdilSazby > 0) {
    const soucasna = annuity(vyse, sazba, mesicu);
    const nova = annuity(vyse, trzniSazba, mesicu);
    rocniUspora = Math.max(0, Math.round((soucasna - nova) * 12));
  }

  const mesicuDoFixace = mesicuDoData(loan.datumFixace);
  let usporaDoFixace: number | null = null;
  if (mesicuDoFixace !== null && mesicuDoFixace > 0) {
    usporaDoFixace = Math.round((rocniUspora / 12) * mesicuDoFixace);
  }

  const urgentni =
    mesicuDoFixace !== null && mesicuDoFixace >= 0 && mesicuDoFixace <= 12;

  return {
    trzniSazba,
    rozdilSazby,
    rocniUspora,
    usporaDoFixace,
    mesicuDoFixace,
    urgentni,
  };
}

// Formátování částky v Kč pro UI.
export function formatKc(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}
