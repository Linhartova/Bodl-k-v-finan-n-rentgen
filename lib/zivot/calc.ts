import type { ExtractedLife, LifeResult } from "./types";

// Výchozí doporučené pojistné částky klíčových rizik (Kč), pokud klient nezadá
// vlastní příjem/dluhy. Lze přepsat přes env. Hodnoty odpovídají běžným
// doporučením finančních poradců v ČR (2026):
//  - smrt: pokrýt dluhy + překlenout výpadek příjmu rodině,
//  - invalidita 3. stupně: nejvážnější riziko – výpadek příjmu na desítky let.
const DEFAULT_SMRT = 1_500_000;
const DEFAULT_INVALIDITA = 2_000_000;

// Kolika lety příjmu se násobí roční příjem při výpočtu doporučeného krytí.
const ROKY_PRIJMU_SMRT = 3;
const ROKY_PRIJMU_INVALIDITA = 5;

// Odhadovaný podíl pojistného, který u investičního/kapitálového pojištění jde
// mimo ochranu (poplatky + spoření) a dá se ušetřit přechodem na rizikové.
const DEFAULT_PODIL_INVESTICE = 0.4;

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw.replace(/\s/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPodilInvestice(): number {
  const v = envNum("PODIL_INVESTICE", DEFAULT_PODIL_INVESTICE);
  return v > 0 && v < 1 ? v : DEFAULT_PODIL_INVESTICE;
}

// Rozpozná, zda jde o investiční / kapitálové životní pojištění (spoření v pojistce).
function jeInvesticniTyp(typ: string | null): boolean {
  const t = (typ || "").toLowerCase();
  return /(invest|kapitál|kapital|ižp|izp|kžp|kzp|spoř|spor)/.test(t);
}

/**
 * Posoudí nastavení životního pojištění:
 *  1) Mezera v krytí – porovná sjednané částky pro smrt (z jakékoliv příčiny)
 *     a invaliditu 3. stupně s doporučením (z příjmu a dluhů klienta, nebo
 *     z výchozích hodnot).
 *  2) Drahé investiční/kapitálové pojištění – odhadne, kolik ročně jde mimo
 *     ochranu a dá se ušetřit přechodem na čistě rizikové pojištění.
 */
export function analyzeLife(life: ExtractedLife): LifeResult {
  const predpoklady: string[] = [];

  const prijem = life.rocniPrijem && life.rocniPrijem > 0 ? life.rocniPrijem : null;
  const dluhy = life.dluhy && life.dluhy > 0 ? life.dluhy : null;

  // Roční pojistné z měsíčního.
  const rocniPojistne =
    life.mesicniPojistne && life.mesicniPojistne > 0
      ? Math.round(life.mesicniPojistne * 12)
      : null;

  // --- Doporučené krytí ---
  let doporucenaSmrt = envNum("DOPORUCENA_CASTKA_SMRT", DEFAULT_SMRT);
  if (prijem || dluhy) {
    doporucenaSmrt = Math.round((dluhy ?? 0) + (prijem ?? 0) * ROKY_PRIJMU_SMRT);
    predpoklady.push(
      `Doporučené krytí smrti = dluhy ${formatKc(dluhy ?? 0)}` +
        (prijem ? ` + ${ROKY_PRIJMU_SMRT}× roční příjem (${formatKc(prijem)})` : "") +
        "."
    );
  } else {
    predpoklady.push(
      `Použito výchozí doporučené krytí smrti ${formatKc(doporucenaSmrt)} ` +
        "(pro přesnější výpočet doplň roční příjem a dluhy)."
    );
  }

  let doporucenaInvalidita = envNum("DOPORUCENA_CASTKA_INVALIDITA", DEFAULT_INVALIDITA);
  if (prijem) {
    doporucenaInvalidita = Math.max(
      doporucenaInvalidita,
      Math.round(prijem * ROKY_PRIJMU_INVALIDITA)
    );
    predpoklady.push(
      `Doporučené krytí invalidity 3. st. = ${ROKY_PRIJMU_INVALIDITA}× roční příjem ` +
        `(min. ${formatKc(envNum("DOPORUCENA_CASTKA_INVALIDITA", DEFAULT_INVALIDITA))}).`
    );
  } else {
    predpoklady.push(
      `Použito výchozí doporučené krytí invalidity 3. st. ${formatKc(doporucenaInvalidita)}.`
    );
  }

  // --- Mezery v krytí ---
  // Pro adekvátnost počítáme s krytím smrti z jakékoliv příčiny (smrt úrazem
  // plní jen při úrazu, takže ji do hlavního krytí nezapočítáváme).
  const sjednanaSmrt = life.smrtJakakolivPricina ?? 0;
  const sjednanaInvalidita = life.invalidita3 ?? 0;
  const mezeraSmrt = Math.max(0, doporucenaSmrt - sjednanaSmrt);
  const mezeraInvalidita = Math.max(0, doporucenaInvalidita - sjednanaInvalidita);
  const celkovaMezera = mezeraSmrt + mezeraInvalidita;

  const chybiInvalidita = !life.invalidita3 || life.invalidita3 <= 0;
  const podpojistenySmrt = mezeraSmrt > 0;
  const podpojistenyInvalidita = mezeraInvalidita > 0;
  // Ideální je mít invaliditu krytou už od 1. stupně. Upozorníme, pokud krytí
  // 3. stupně existuje, ale od 1. stupně potvrzeno není.
  const invaliditaNeOd1 = !chybiInvalidita && life.invaliditaOd1 !== true;

  if (chybiInvalidita) {
    predpoklady.push(
      "Pozor: invalidita 3. stupně není ve smlouvě nalezena – jde o nejvážnější opomíjené riziko."
    );
  } else if (invaliditaNeOd1) {
    predpoklady.push(
      "Invalidita není potvrzena už od 1. stupně – ideální nastavení kryje invaliditu od 1. stupně."
    );
  }
  if (life.smrtJakakolivPricina == null && life.smrtUrazem != null) {
    predpoklady.push(
      "Kryta je jen smrt úrazem, ne smrt z jakékoliv příčiny – ta pokrývá výrazně víc situací."
    );
  }

  // --- Drahé investiční / kapitálové pojištění ---
  const jeInvesticni = jeInvesticniTyp(life.typPojisteni);
  let odhadUsporaPojistne: number | null = null;
  if (jeInvesticni) {
    if (life.sporiciSlozka && life.sporiciSlozka > 0) {
      // Známe-li spořící složku, ušetřené pojistné ≈ 12× spořící složka za rok.
      odhadUsporaPojistne = Math.round(life.sporiciSlozka * 12);
      predpoklady.push(
        `Spořící/investiční složka ${formatKc(life.sporiciSlozka)}/měs jde mimo ochranu ` +
          "– u čistě rizikového pojištění bys ji neplatil."
      );
    } else if (rocniPojistne && rocniPojistne > 0) {
      const podil = getPodilInvestice();
      odhadUsporaPojistne = Math.round(rocniPojistne * podil);
      predpoklady.push(
        `Investiční/kapitálové pojištění: odhadem ${Math.round(podil * 100)} % pojistného ` +
          "jde na poplatky a spoření – stejnou ochranu lze pořídit jako rizikové levněji."
      );
    } else {
      predpoklady.push(
        "Investiční/kapitálové pojištění: stejnou ochranu obvykle pořídíš jako rizikové levněji."
      );
    }
  }

  return {
    rocniPojistne,
    doporucenaSmrt,
    doporucenaInvalidita,
    mezeraSmrt,
    mezeraInvalidita,
    celkovaMezera,
    chybiInvalidita,
    podpojistenySmrt,
    podpojistenyInvalidita,
    invaliditaNeOd1,
    jeInvesticni,
    odhadUsporaPojistne,
    predpoklady,
  };
}

// Formátování částky v Kč pro UI (vlastní kopie, ať modul nezávisí na ostatních).
export function formatKc(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}
