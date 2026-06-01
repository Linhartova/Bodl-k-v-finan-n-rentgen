import type { ExtractedLoan, SavingsResult } from "./types";

// Referenční tržní sazby (% p.a.) pro porovnání. Liší se podle typu úvěru,
// protože hypotéka a spotřebitelský úvěr mají úplně jiné sazby.
//  - Hypotéka: dosažitelná tržní sazba (Swiss Life Hypoindex ~5,2 %, mBank
//    ~5,1 %, nejlepší banky kolem 4 %; bereme realistických 4,9 %).
//  - Spotřebitelský úvěr: běžné bankovní rozpětí 6–10 % p.a. (bereme 8,9 %).
// Obě lze přepsat přes env (MARKET_RATE_HYPO / MARKET_RATE_SPOTREBITELSKY);
// kvůli zpětné kompatibilitě platí starší MARKET_RATE jako fallback pro hypotéku.
const DEFAULT_HYPO = 4.9;
const DEFAULT_SPOTREBITELSKY = 4.9;

// Pokud ze smlouvy nezjistíme zbývající splatnost, použijeme tento odhad (měsíce).
const FALLBACK_SPLATNOST_MESICU = 240; // 20 let

function envRate(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Je daný produkt hypotéka? (jinak ho bereme jako spotřebitelský úvěr)
function jeHypoteka(produkt: string | null): boolean {
  return /(hypot|úvěr na bydlení|uver na bydleni)/i.test(produkt || "");
}

// Referenční sazba podle produktu úvěru.
export function getMarketRate(produkt: string | null = "Hypotéka"): number {
  if (jeHypoteka(produkt)) {
    // MARKET_RATE_HYPO → starší MARKET_RATE → default
    const hypo = envRate("MARKET_RATE_HYPO", envRate("MARKET_RATE", DEFAULT_HYPO));
    return hypo;
  }
  return envRate("MARKET_RATE_SPOTREBITELSKY", DEFAULT_SPOTREBITELSKY);
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
  const trzniSazba = getMarketRate(loan.produkt);

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
