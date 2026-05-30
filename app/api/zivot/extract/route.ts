import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedLife } from "@/lib/zivot/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const num = (description: string) => ({ type: ["number", "null"] as const, description });
const str = (description: string) => ({ type: ["string", "null"] as const, description });
const bool = (description: string) => ({ type: ["boolean", "null"] as const, description });

// JSON schema pro vynucené strukturované vytažení dat ze smlouvy o životním pojištění.
const TOOL = {
  name: "ulozit_data_zivotniho_pojisteni",
  description: "Ulož strukturovaná data vytažená ze smlouvy o životním pojištění.",
  input_schema: {
    type: "object" as const,
    properties: {
      // Údaje ze smlouvy
      mesicniPojistne: num("Měsíční pojistné v Kč (jen číslo). Roční přepočti na měsíc (÷12)."),
      pojistovna: str("Název pojišťovny."),
      nazevProduktu: str("Obchodní název pojistného produktu."),
      datumSjednani: str("Datum sjednání smlouvy ve formátu YYYY-MM-DD, pokud lze."),
      dobaTrvani: str('Doba trvání smlouvy, např. "do 65 let" nebo "30 let".'),
      datumKonce: str("Datum konce pojištění ve formátu YYYY-MM-DD, pokud lze."),
      pojisteneOsoby: str("Jména / výčet pojištěných osob."),
      vek: num("Věk hlavní pojištěné osoby (jen číslo)."),
      kurak: str('"kuřák" nebo "nekuřák", pokud je uvedeno.'),

      // Smrt
      smrtJakakolivPricina: num("Pojistná částka pro smrt z jakékoliv příčiny v Kč (jen číslo)."),
      smrtUrazem: num("Pojistná částka pro smrt úrazem v Kč (jen číslo)."),

      // Invalidita
      invalidita1: num("Pojistná částka invalidita 1. stupně v Kč (jen číslo)."),
      invalidita2: num("Pojistná částka invalidita 2. stupně v Kč (jen číslo)."),
      invalidita3: num("Pojistná částka invalidita 3. stupně v Kč (jen číslo)."),
      invaliditaOd1: bool("True, pokud je invalidita krytá už od 1. stupně."),

      // Závažná onemocnění
      zavazneNemociCastka: num("Pojistná částka pro závažná onemocnění v Kč (jen číslo)."),
      zavazneNemociRozsah: str("Rozsah krytých diagnóz (počet nebo výčet), pokud je uveden."),

      // Dlouhodobá pracovní neschopnost
      pracovniNeschopnostDenniDavka: num("Denní dávka při pracovní neschopnosti v Kč/den (jen číslo)."),
      pracovniNeschopnostKarence: str('Karenční doba, např. "od 29. dne".'),

      // Hospitalizace
      hospitalizaceDenniDavka: num("Denní dávka při hospitalizaci v Kč/den (jen číslo)."),

      // Trvalé následky úrazu
      trvaleNasledkyCastka: num("Pojistná částka trvalé následky úrazu v Kč (jen číslo)."),
      trvaleNasledkyProgrese: str('Progrese plnění, např. "až 500 %".'),

      // Invalidita následkem úrazu
      invaliditaUrazCastka: num("Pojistná částka invalidita následkem úrazu v Kč (jen číslo)."),

      // Ošetřování člena rodiny
      osetrovaniClena: bool("True, pokud je kryto ošetřování člena rodiny."),

      // Parametry produktu
      typPojisteni: str('Typ: "investiční (IŽP)", "rizikové ŽP" nebo "kapitálové (KŽP)".'),
      sporiciSlozka: num("Měsíční spořicí / investiční složka v Kč (jen číslo)."),
      mimoradnePoplatky: str("Popis mimořádných poplatků, pokud jsou uvedeny."),
      pripojisteniDeti: bool("True, pokud jsou pojištěny i děti."),
      vyluky: str("Důležité výluky z pojištění (stručně)."),

      jePojistnaSmlouva: {
        type: "boolean",
        description: "True, pokud dokument je čitelná smlouva o životním pojištění.",
      },
      poznamka: str("Krátká poznámka, např. která pole byla nečitelná."),
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
    const demo: ExtractedLife = {
      mesicniPojistne: 950,
      pojistovna: "",
      nazevProduktu: "",
      datumSjednani: null,
      dobaTrvani: "do 65 let",
      datumKonce: null,
      pojisteneOsoby: "",
      vek: 38,
      kurak: "nekuřák",
      smrtJakakolivPricina: 500000,
      smrtUrazem: 1000000,
      invalidita1: null,
      invalidita2: null,
      invalidita3: null,
      invaliditaOd1: false,
      zavazneNemociCastka: 300000,
      zavazneNemociRozsah: "základní rozsah",
      pracovniNeschopnostDenniDavka: 300,
      pracovniNeschopnostKarence: "od 29. dne",
      hospitalizaceDenniDavka: 200,
      trvaleNasledkyCastka: 400000,
      trvaleNasledkyProgrese: "až 500 %",
      invaliditaUrazCastka: null,
      osetrovaniClena: false,
      typPojisteni: "investiční (IŽP)",
      sporiciSlozka: 400,
      mimoradnePoplatky: null,
      pripojisteniDeti: false,
      vyluky: null,
      jePojistnaSmlouva: true,
      poznamka:
        "DEMO režim (chybí ANTHROPIC_API_KEY) – údaje nejsou z dokumentu. Přepiš je prosím podle své smlouvy.",
      rocniPrijem: null,
      dluhy: null,
    };
    return NextResponse.json({ life: demo, demo: true });
  }

  const base64 = bytes.toString("base64");
  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
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
                "Toto je smlouva o životním pojištění (případně přehled pojištění / pojistka). " +
                "Pečlivě a kompletně z ní vytáhni VŠECHNA pole nástroje:\n" +
                "• Údaje ze smlouvy: měsíční pojistné, pojišťovna, název produktu, datum sjednání, " +
                "doba trvání, konec pojištění, pojištěné osoby, věk, kuřák/nekuřák.\n" +
                "• Smrt: zvlášť smrt z jakékoliv příčiny a smrt úrazem.\n" +
                "• Invalidita: pojistné částky pro 1., 2. a 3. stupeň a zda je krytá už od 1. stupně.\n" +
                "• Závažná onemocnění: pojistná částka a rozsah diagnóz.\n" +
                "• Dlouhodobá pracovní neschopnost: denní dávka a karenční doba.\n" +
                "• Hospitalizace: denní dávka.\n" +
                "• Trvalé následky úrazu: pojistná částka a progrese.\n" +
                "• Invalidita následkem úrazu: pojistná částka.\n" +
                "• Ošetřování člena rodiny: kryto ano/ne.\n" +
                "• Parametry produktu: typ (investiční IŽP / rizikové ŽP / kapitálové KŽP), " +
                "spořicí složka, mimořádné poplatky, připojištění dětí, výluky.\n" +
                "Pokud nějaký údaj v dokumentu není, vrať pro něj null. Nic si nevymýšlej. " +
                "Pak zavolej nástroj ulozit_data_zivotniho_pojisteni.",
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

    // Personalizační pole nejsou na smlouvě – doplní je klient v kroku kontroly.
    const life = { ...(toolUse.input as object), rocniPrijem: null, dluhy: null } as ExtractedLife;
    return NextResponse.json({ life });
  } catch (err: any) {
    const detail = err?.message || "Neznámá chyba";
    return NextResponse.json({ error: `Chyba při zpracování dokumentu: ${detail}` }, { status: 502 });
  }
}
