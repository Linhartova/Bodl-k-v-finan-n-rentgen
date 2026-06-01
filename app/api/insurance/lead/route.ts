import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { InsuranceLead } from "@/lib/insurance/types";
import { formatKc } from "@/lib/insurance/calc";
import { sendInsuranceConfirmationEmail } from "@/lib/insurance/email";

export const runtime = "nodejs";

function validate(lead: Partial<InsuranceLead>): string | null {
  if (!lead?.jmeno || lead.jmeno.trim().length < 2) return "Vyplň prosím jméno.";
  if (!lead?.email && !lead?.telefon) return "Vyplň prosím e-mail nebo telefon.";
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return "E-mail nemá platný formát.";
  return null;
}

// Lokální fallback, když není nakonfigurovaný Pipedrive – ať demo funguje vždy.
async function saveLocally(lead: InsuranceLead) {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "leads-insurance.json");
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

function leadPopis(lead: InsuranceLead): string {
  const { insurance: ins, result } = lead;
  return [
    `Typ nemovitosti: ${ins.typNemovitosti ?? "?"}`,
    `Adresa: ${ins.adresa ?? "?"}`,
    `Obytná plocha: ${ins.obytnaPlocha != null ? ins.obytnaPlocha + " m²" : "?"}`,
    `Pojišťovna: ${ins.pojistovna ?? "?"}`,
    `Krytí smlouvy: ${[result.maStavbu ? "stavba" : null, result.maDomacnost ? "domácnost" : null].filter(Boolean).join(" + ") || "?"}`,
    `Pojistná částka nemovitosti: ${ins.pojistnaCastkaNemovitost != null ? formatKc(ins.pojistnaCastkaNemovitost) : "NEPOJIŠTĚNO"}`,
    `Pojistná částka domácnosti: ${ins.pojistnaCastkaDomacnost != null ? formatKc(ins.pojistnaCastkaDomacnost) : "NEPOJIŠTĚNO"}`,
    `Roční pojistné: ${ins.rocniPojistne != null ? formatKc(ins.rocniPojistne) : "?"}`,
    `Spoluúčast: ${ins.spoluucast ?? "?"}`,
    `Pojištěná rizika: ${ins.pojistenaRizika ?? "?"}`,
    `Odhad hodnoty stavby: ${result.soucasnaHodnota != null ? formatKc(result.soucasnaHodnota) : "?"}`,
    `Krytí: ${result.pomerKryti != null ? Math.round(result.pomerKryti * 100) + " %" : "?"}`,
    result.podpojisteny ? "PODPOJIŠTĚN – riziko krácení plnění!" : "Krytí v pořádku.",
    `Plnění při totální škodě: ${result.plneniProTotalniSkodu != null ? formatKc(result.plneniProTotalniSkodu) : "?"}`,
    result.ztrataProKlienta != null ? `Ztráta při totální škodě: ${formatKc(result.ztrataProKlienta)}` : null,
    result.doporuceni.length ? `DOPORUČENÍ: ${result.doporuceni.join(" | ")}` : null,
    ins.poznamka ? `Poznámka OCR: ${ins.poznamka}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendToPipedrive(lead: InsuranceLead): Promise<{ leadId: string }> {
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
  const ztrata = lead.result.ztrataProKlienta;
  const titulek = lead.result.podpojisteny && ztrata
    ? `Kontrola pojištění – ${lead.jmeno} (podpojištěn, ztráta ${formatKc(ztrata)})`
    : `Kontrola pojištění – ${lead.jmeno}`;
  const dealBody: any = { title: titulek, person_id: personId, pipeline_id: 7 };
  if (ztrata && ztrata > 0) {
    dealBody.value = ztrata;
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
  let lead: InsuranceLead;
  try {
    lead = (await req.json()) as InsuranceLead;
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
  const email = await sendInsuranceConfirmationEmail(lead);
  result.emailSent = email.sent;
  if (!email.sent) result.emailReason = email.reason;

  return NextResponse.json(result, { status: 200 });
}
