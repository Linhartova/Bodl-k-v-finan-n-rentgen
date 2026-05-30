import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedLoan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// JSON schema pro vynucené strukturované vytažení dat ze smlouvy.
const TOOL = {
  name: "ulozit_data_smlouvy",
  description:
    "Ulož strukturovaná data vytažená z úvěrové / hypoteční smlouvy.",
  input_schema: {
    type: "object" as const,
    properties: {
      produkt: {
        type: ["string", "null"],
        description: 'Typ produktu, např. "Hypoteční úvěr", "Spotřebitelský úvěr".',
      },
      poskytovatel: {
        type: ["string", "null"],
        description: "Název banky / poskytovatele úvěru.",
      },
      vyseUveru: {
        type: ["number", "null"],
        description: "Výše / zůstatek jistiny úvěru v Kč (jen číslo).",
      },
      sazba: {
        type: ["number", "null"],
        description: "Úroková sazba v % p.a. (jen číslo, např. 5.89).",
      },
      datumFixace: {
        type: ["string", "null"],
        description: "Datum konce fixace ve formátu YYYY-MM-DD, pokud lze zjistit.",
      },
      splatnostMesicu: {
        type: ["number", "null"],
        description: "Zbývající splatnost v měsících, pokud lze zjistit.",
      },
      jeUverovaSmlouva: {
        type: "boolean",
        description: "True, pokud dokument je čitelná úvěrová/hypoteční smlouva.",
      },
      poznamka: {
        type: ["string", "null"],
        description: "Krátká poznámka, např. která pole byla nečitelná.",
      },
    },
    required: ["jeUverovaSmlouva"],
  },
};

// Vrací media content blok. PDF používá "document" blok, který SDK 0.32 podporuje
// za běhu, ale ještě nemá v typech – proto any.
function mediaBlock(mime: string, base64: string): any {
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: mime, data: base64 },
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Nepodařilo se načíst soubor." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Nahraj prosím soubor se smlouvou." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowed.includes(mime)) {
    return NextResponse.json(
      { error: `Nepodporovaný formát (${mime}). Nahraj PDF nebo obrázek (PNG/JPG).` },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Soubor je příliš velký (max 15 MB)." }, { status: 400 });
  }

  // DEMO REŽIM: bez API klíče nečteme dokument, ale vrátíme ukázková data,
  // která uživatel v dalším kroku přepíše podle své smlouvy. Po doplnění
  // ANTHROPIC_API_KEY se automaticky použije reálné OCR.
  if (!apiKey) {
    const demo: ExtractedLoan = {
      produkt: "Hypoteční úvěr",
      poskytovatel: "",
      vyseUveru: 3000000,
      sazba: 5.89,
      datumFixace: null,
      splatnostMesicu: 240,
      jeUverovaSmlouva: true,
      poznamka:
        "DEMO režim (chybí ANTHROPIC_API_KEY) – údaje nejsou z dokumentu. Přepiš je prosím podle své smlouvy.",
    };
    return NextResponse.json({ loan: demo, demo: true });
  }

  const base64 = bytes.toString("base64");

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            mediaBlock(mime, base64),
            {
              type: "text" as const,
              text:
                "Toto je úvěrová nebo hypoteční smlouva (případně její část / přehled). " +
                "Pečlivě z ní vytáhni: typ produktu, poskytovatele (banku), výši/zůstatek úvěru v Kč, " +
                "úrokovou sazbu v % p.a., datum konce fixace a zbývající splatnost v měsících. " +
                "Pokud nějaký údaj v dokumentu není, vrať pro něj null. Nic si nevymýšlej. " +
                "Pak zavolej nástroj ulozit_data_smlouvy.",
            },
          ],
        },
      ],
    });

    const toolUse = msg.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "Model nevrátil strukturovaná data. Zkus jiný / čitelnější dokument." },
        { status: 502 }
      );
    }

    const loan = toolUse.input as ExtractedLoan;
    return NextResponse.json({ loan });
  } catch (err: any) {
    const detail = err?.message || "Neznámá chyba";
    return NextResponse.json({ error: `Chyba při zpracování dokumentu: ${detail}` }, { status: 502 });
  }
}
