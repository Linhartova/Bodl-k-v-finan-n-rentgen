import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Žádost o bezplatnou konzultaci z výsledkové stránky (po zobrazení skóre).
interface KonzultaceReq {
  jmeno: string;
  email: string;
  telefon: string;
  produkt: string; // "uver" | "nemovitost" | "zivot" – odkud žádost přišla
  termin: string; // preferovaný termín hovoru (volný text / select)
  zprava: string; // nepovinná poznámka klienta
}

function validate(d: Partial<KonzultaceReq>): string | null {
  if (!d?.jmeno || d.jmeno.trim().length < 2) return "Vyplň prosím jméno.";
  if (!d?.telefon && !d?.email) return "Vyplň prosím telefon nebo e-mail.";
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "E-mail nemá platný formát.";
  return null;
}

const PRODUKT_NAZEV: Record<string, string> = {
  uver: "úvěr / hypotéka",
  nemovitost: "pojištění nemovitosti",
  zivot: "životní pojištění",
};

// Pipeline v Pipedrive podle produktu: půjčky→2, majetek→7, životní→8.
const PRODUKT_PIPELINE: Record<string, number> = {
  uver: 2,
  nemovitost: 7,
  zivot: 8,
};

async function saveLocally(d: KonzultaceReq) {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "konzultace.json");
  await fs.mkdir(dir, { recursive: true });
  let existing: any[] = [];
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    existing = [];
  }
  existing.push({ ...d, ulozeno: new Date().toISOString() });
  await fs.writeFile(file, JSON.stringify(existing, null, 2), "utf8");
}

function popis(d: KonzultaceReq): string {
  return [
    `Žádost o bezplatnou konzultaci`,
    `Oblast: ${PRODUKT_NAZEV[d.produkt] ?? d.produkt ?? "—"}`,
    `Preferovaný termín hovoru: ${d.termin || "neuvedeno"}`,
    d.zprava ? `Zpráva: ${d.zprava}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendToPipedrive(d: KonzultaceReq): Promise<{ leadId: string }> {
  const token = process.env.PIPEDRIVE_API_TOKEN!;
  const domain = process.env.PIPEDRIVE_DOMAIN!;
  const base = `https://${domain}.pipedrive.com/api/v1`;
  const q = `api_token=${encodeURIComponent(token)}`;

  const personRes = await fetch(`${base}/persons?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: d.jmeno,
      email: d.email ? [{ value: d.email, primary: true }] : undefined,
      phone: d.telefon ? [{ value: d.telefon, primary: true }] : undefined,
    }),
  });
  const personJson = await personRes.json();
  if (!personRes.ok || !personJson?.data?.id) {
    throw new Error(`Pipedrive person: ${personJson?.error || personRes.status}`);
  }
  const personId = personJson.data.id;

  const titulek = `Konzultace zdarma – ${d.jmeno} (${PRODUKT_NAZEV[d.produkt] ?? d.produkt})`;
  const dealBody: any = { title: titulek, person_id: personId };
  const pipelineId = PRODUKT_PIPELINE[d.produkt];
  if (pipelineId) dealBody.pipeline_id = pipelineId;
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

  try {
    await fetch(`${base}/notes?${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, content: popis(d).replace(/\n/g, "<br>") }),
    });
  } catch {
    /* ignore */
  }

  return { leadId: dealId };
}

export async function POST(req: NextRequest) {
  let d: KonzultaceReq;
  try {
    d = (await req.json()) as KonzultaceReq;
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const err = validate(d);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const hasPipedrive = !!process.env.PIPEDRIVE_API_TOKEN && !!process.env.PIPEDRIVE_DOMAIN;

  if (!hasPipedrive) {
    await saveLocally(d);
    return NextResponse.json({ ok: true, mode: "local" }, { status: 200 });
  }
  try {
    const { leadId } = await sendToPipedrive(d);
    return NextResponse.json({ ok: true, mode: "pipedrive", leadId }, { status: 200 });
  } catch (e: any) {
    await saveLocally(d);
    return NextResponse.json({ ok: true, mode: "local-fallback" }, { status: 200 });
  }
}
