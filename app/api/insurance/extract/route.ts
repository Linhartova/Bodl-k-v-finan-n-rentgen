import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedInsurance } from "@/lib/insurance/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// JSON schema pro vynucené strukturované vytažení dat z pojistné smlouvy majetku.
const TOOL = {
  name: "ulozit_data_pojistky",
  description:
    "Ulož strukturovaná data vytažená z pojistné smlouvy nemovitosti / domácnosti.",
  input_schema: {
    type: "object" as const,
    properties: {
      typNemovitosti: {
        type: ["string", "null"],
        description: 'Typ nemovitosti: "byt", "dům" nebo "rekreační objekt".',
      },
      adresa: {
        type: ["string", "null"],
        description: "Adresa pojištěné nemovitosti.",
      },
      rokVystavby: {
        type: ["number", "null"],
        description: "Rok výstavby nemovitosti (jen rok, např. 1998).",
      },
      rokRekonstrukce: {
        type: ["number", "null"],
        description: "Rok poslední rekonstrukce, pokud je uveden (jen rok).",
      },
      obytnaPlocha: {
        type: ["number", "null"],
        description: "Obytná / podlahová plocha v m² (jen číslo).",
      },
      pojistnaCastkaNemovitost: {
        type: ["number", "null"],
        description: "Pojistná částka stavby / nemovitosti v Kč (jen číslo).",
      },
      pojistnaCastkaDomacnost: {
        type: ["number", "null"],
        description: "Pojistná částka domácnosti (vybavení) v Kč (jen číslo).",
      },
      rocniPojistne: {
        type: ["number", "null"],
        description: "Roční pojistné v Kč (jen číslo). Měsíční přepočti na rok.",
      },
      spoluucast: {
        type: ["string", "null"],
        description: 'Spoluúčast, např. "1 %" nebo "5 000 Kč".',
      },
      pojistenaRizika: {
        type: ["string", "null"],
        description:
          "Výčet pojištěných rizik (např. požár, voda z potrubí, vichřice, krádež).",
      },
      datumSjednani: {
        type: ["string", "null"],
        description: "Datum sjednání smlouvy ve formátu YYYY-MM-DD, pokud lze.",
      },
      datumAktualizace: {
        type: ["string", "null"],
        description:
          "Datum poslední aktualizace / dodatku smlouvy ve formátu YYYY-MM-DD, pokud lze.",
      },
      pojistovna: {
        type: ["string", "null"],
        description: "Název pojišťovny.",
      },
      jePojistnaSmlouva: {
        type: "boolean",
        description: "True, pokud dokument je čitelná pojistná smlouva majetku.",
      },
      poznamka: {
        type: ["string", "null"],
        description: "Krátká poznámka, např. která pole byla nečitelná.",
      },
    },
    required: ["jePojistnaSmlouva"],
  },
};

// Vrací media content blok. PDF používá "document" blok.
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

  // DEMO REŽIM: bez API klíče vrátíme ukázková data, která uživatel přepíše.
  if (!apiKey) {
    const demo: ExtractedInsurance = {
      typNemovitosti: "dům",
      adresa: "",
      rokVystavby: 1998,
      rokRekonstrukce: null,
      obytnaPlocha: 140,
      pojistnaCastkaNemovitost: 3500000,
      pojistnaCastkaDomacnost: 800000,
      rocniPojistne: 6200,
      spoluucast: "1 %",
      pojistenaRizika: "požár, voda z potrubí, vichřice, krádež",
      datumSjednani: null,
      datumAktualizace: null,
      pojistovna: "",
      jePojistnaSmlouva: true,
      poznamka:
        "DEMO režim (chybí ANTHROPIC_API_KEY) – údaje nejsou z dokumentu. Přepiš je prosím podle své smlouvy.",
    };
    return NextResponse.json({ insurance: demo, demo: true });
  }

  const base64 = bytes.toString("base64");
  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
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
                "Toto je pojistná smlouva nemovitosti / domácnosti (případně přehled pojištění). " +
                "Pečlivě z ní vytáhni: typ nemovitosti (byt / dům / rekreační objekt), adresu, " +
                "rok výstavby a rok rekonstrukce, obytnou plochu v m², pojistnou částku nemovitosti, " +
                "pojistnou částku domácnosti, roční pojistné, spoluúčast, pojištěná rizika, " +
                "datum sjednání, datum poslední aktualizace a název pojišťovny. " +
                "Pokud nějaký údaj v dokumentu není, vrať pro něj null. Nic si nevymýšlej. " +
                "Pak zavolej nástroj ulozit_data_pojistky.",
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

    const insurance = toolUse.input as ExtractedInsurance;
    return NextResponse.json({ insurance });
  } catch (err: any) {
    const detail = err?.message || "Neznámá chyba";
    return NextResponse.json({ error: `Chyba při zpracování dokumentu: ${detail}` }, { status: 502 });
  }
}
