import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Lead } from "@/lib/types";
import { formatKc } from "@/lib/savings";
import { sendConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

function validate(lead: Partial<Lead>): string | null {
  if (!lead?.jmeno || lead.jmeno.trim().length < 2) return "Vyplň prosím jméno.";
  if (!lead?.email && !lead?.telefon) return "Vyplň prosím e-mail nebo telefon.";
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return "E-mail nemá platný formát.";
  return null;
}

// Lokální fallback, když není nakonfigurovaný Pipedrive – ať demo funguje vždy.
async function saveLocally(lead: Lead) {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "leads.json");
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

function leadPopis(lead: Lead): string {
  const { loan, savings } = lead;
  return [
    `Produkt: ${loan.produkt ?? "?"}`,
    `Poskytovatel: ${loan.poskytovatel ?? "?"}`,
    `Výše úvěru: ${loan.vyseUveru != null ? formatKc(loan.vyseUveru) : "?"}`,
    `Sazba klienta: ${loan.sazba != null ? loan.sazba + " %" : "?"}`,
    `Tržní sazba: ${savings.trzniSazba} %`,
    `Konec fixace: ${loan.datumFixace ?? "?"}${savings.urgentni ? " (URGENTNÍ – do 12 měs.)" : ""}`,
    `Odhad roční úspory: ${formatKc(savings.rocniUspora)}`,
    savings.usporaDoFixace != null ? `Úspora do konce fixace: ${formatKc(savings.usporaDoFixace)}` : null,
    loan.poznamka ? `Poznámka OCR: ${loan.poznamka}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendToPipedrive(lead: Lead): Promise<{ leadId: string }> {
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
  const titulek = `Kontrola úvěru – ${lead.jmeno} (úspora ${formatKc(lead.savings.rocniUspora)}/rok)`;
  const dealBody: any = { title: titulek, person_id: personId, pipeline_id: 2 };
  if (lead.savings.rocniUspora > 0) {
    dealBody.value = lead.savings.rocniUspora;
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
  let lead: Lead;
  try {
    lead = (await req.json()) as Lead;
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
  const email = await sendConfirmationEmail(lead);
  result.emailSent = email.sent;
  if (!email.sent) result.emailReason = email.reason;

  return NextResponse.json(result, { status: 200 });
}
