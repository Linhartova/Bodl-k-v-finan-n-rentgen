import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { LifeLead } from "@/lib/zivot/types";
import { formatKc } from "@/lib/zivot/calc";
import { sendLifeConfirmationEmail } from "@/lib/zivot/email";

export const runtime = "nodejs";

function validate(lead: Partial<LifeLead>): string | null {
  if (!lead?.jmeno || lead.jmeno.trim().length < 2) return "Vyplň prosím jméno.";
  if (!lead?.email && !lead?.telefon) return "Vyplň prosím e-mail nebo telefon.";
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return "E-mail nemá platný formát.";
  return null;
}

// Lokální fallback, když není nakonfigurovaný Pipedrive – ať demo funguje vždy.
async function saveLocally(lead: LifeLead) {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "leads-zivot.json");
  await fs.mkdir(dir, { recursive: true });
  let existing: any[] = [];
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    existing = [];
  }
  existing.push({ ...lead, ulozeno: new Date().toISOString() });
  await fs.writeFile(file, JSON.stringify(existing, null, 2), "utf8");
}

function kc(v: number | null): string {
  return v != null ? formatKc(v) : "?";
}

function leadPopis(lead: LifeLead): string {
  const { life, result } = lead;
  return [
    `Pojišťovna: ${life.pojistovna ?? "?"}`,
    `Produkt: ${life.nazevProduktu ?? "?"}`,
    `Typ pojištění: ${life.typPojisteni ?? "?"}`,
    `Pojištěné osoby: ${life.pojisteneOsoby ?? "?"}`,
    `Věk: ${life.vek != null ? life.vek : "?"}${life.kurak ? ` (${life.kurak})` : ""}`,
    `Doba trvání: ${life.dobaTrvani ?? "?"}`,
    ``,
    `-- Smrt --`,
    `Z jakékoliv příčiny: ${kc(life.smrtJakakolivPricina)} (doporučeno ${formatKc(result.doporucenaSmrt)})`,
    `Úrazem: ${kc(life.smrtUrazem)}`,
    `-- Invalidita --`,
    `1. st.: ${kc(life.invalidita1)} | 2. st.: ${kc(life.invalidita2)} | 3. st.: ${kc(life.invalidita3)} (doporučeno ${formatKc(result.doporucenaInvalidita)})`,
    `Krytí od 1. stupně: ${life.invaliditaOd1 == null ? "?" : life.invaliditaOd1 ? "ano" : "ne"}`,
    `Invalidita následkem úrazu: ${kc(life.invaliditaUrazCastka)}`,
    `-- Další rizika --`,
    `Závažná onemocnění: ${kc(life.zavazneNemociCastka)}${life.zavazneNemociRozsah ? ` (rozsah: ${life.zavazneNemociRozsah})` : ""}`,
    `Prac. neschopnost: ${kc(life.pracovniNeschopnostDenniDavka)}/den${life.pracovniNeschopnostKarence ? ` (karence ${life.pracovniNeschopnostKarence})` : ""}`,
    `Hospitalizace: ${kc(life.hospitalizaceDenniDavka)}/den`,
    `Trvalé následky úrazu: ${kc(life.trvaleNasledkyCastka)}${life.trvaleNasledkyProgrese ? ` (progrese ${life.trvaleNasledkyProgrese})` : ""}`,
    `Ošetřování člena rodiny: ${life.osetrovaniClena == null ? "?" : life.osetrovaniClena ? "ano" : "ne"}`,
    `-- Parametry produktu --`,
    `Měsíční pojistné: ${kc(life.mesicniPojistne)}`,
    life.sporiciSlozka != null ? `Spořicí složka: ${formatKc(life.sporiciSlozka)}/měs` : null,
    life.mimoradnePoplatky ? `Mimořádné poplatky: ${life.mimoradnePoplatky}` : null,
    `Připojištění dětí: ${life.pripojisteniDeti == null ? "?" : life.pripojisteniDeti ? "ano" : "ne"}`,
    life.vyluky ? `Výluky: ${life.vyluky}` : null,
    ``,
    `-- Klient --`,
    `Roční příjem: ${life.rocniPrijem != null ? formatKc(life.rocniPrijem) : "neuvedeno"}`,
    `Dluhy: ${life.dluhy != null ? formatKc(life.dluhy) : "neuvedeno"}`,
    ``,
    `-- Vyhodnocení --`,
    result.chybiInvalidita ? "CHYBÍ INVALIDITA 3. STUPNĚ!" : null,
    result.invaliditaNeOd1 ? "Invalidita není krytá od 1. stupně (není ideální)." : null,
    result.celkovaMezera > 0 ? `Mezera v krytí: ${formatKc(result.celkovaMezera)}` : "Krytí v pořádku.",
    result.jeInvesticni && result.odhadUsporaPojistne
      ? `Investiční pojištění – odhad roční úspory: ${formatKc(result.odhadUsporaPojistne)}`
      : null,
    life.poznamka ? `Poznámka OCR: ${life.poznamka}` : null,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}

async function sendToPipedrive(lead: LifeLead): Promise<{ leadId: string }> {
  const token = process.env.PIPEDRIVE_API_TOKEN!;
  const domain = process.env.PIPEDRIVE_DOMAIN!;
  const base = `https://${domain}.pipedrive.com/api/v1`;
  const q = `api_token=${encodeURIComponent(token)}`;

  // 1) Person
  const personRes = await fetch(`${base}/persons?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: lead.jmeno,
      email: lead.email ? [{ value: lead.email, primary: true }] : undefined,
      phone: lead.telefon ? [{ value: lead.telefon, primary: true }] : undefined,
    }),
  });
  const personJson = await personRes.json();
  if (!personRes.ok || !personJson?.data?.id) {
    throw new Error(`Pipedrive person: ${personJson?.error || personRes.status}`);
  }
  const personId = personJson.data.id;

  // 2) Deal (obchod)
  const mezera = lead.result.celkovaMezera;
  const titulek = mezera > 0
    ? `Kontrola životního pojištění – ${lead.jmeno} (mezera v krytí ${formatKc(mezera)})`
    : `Kontrola životního pojištění – ${lead.jmeno}`;
  const dealBody: any = { title: titulek, person_id: personId };
  if (mezera > 0) {
    dealBody.value = mezera;
    dealBody.currency = "CZK";
  }
  const dealRes = await fetch(`${base}/deals?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dealBody),
  });
  const dealJson = await dealRes.json();
  if (!dealRes.ok || !dealJson?.data?.id) {
    throw new Error(`Pipedrive deal: ${dealJson?.error || dealRes.status}`);
  }
  const dealId = dealJson.data.id as string;

  // 3) Note s detailem (best-effort, neblokuje úspěch)
  try {
    await fetch(`${base}/notes?${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, content: leadPopis(lead).replace(/\n/g, "<br>") }),
    });
  } catch {
    /* ignore */
  }

  return { leadId: dealId };
}

export async function POST(req: NextRequest) {
  let lead: LifeLead;
  try {
    lead = (await req.json()) as LifeLead;
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const err = validate(lead);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const hasPipedrive = !!process.env.PIPEDRIVE_API_TOKEN && !!process.env.PIPEDRIVE_DOMAIN;

  // 1) Ulož / odešli lead (Pipedrive s lokálním fallbackem).
  let result: Record<string, any>;
  if (!hasPipedrive) {
    await saveLocally(lead);
    result = { ok: true, mode: "local", message: "Lead uložen lokálně (Pipedrive není nakonfigurovaný)." };
  } else {
    try {
      const { leadId } = await sendToPipedrive(lead);
      result = { ok: true, mode: "pipedrive", leadId };
    } catch (e: any) {
      await saveLocally(lead); // i při selhání Pipedrive lead neztratíme
      result = { ok: true, mode: "local-fallback", message: `Pipedrive selhal (${e?.message}); lead uložen lokálně.` };
    }
  }

  // 2) Pošli klientovi potvrzovací e-mail (best-effort – neblokuje úspěch leadu).
  const email = await sendLifeConfirmationEmail(lead);
  result.emailSent = email.sent;
  if (!email.sent) result.emailReason = email.reason;

  return NextResponse.json(result, { status: 200 });
}
