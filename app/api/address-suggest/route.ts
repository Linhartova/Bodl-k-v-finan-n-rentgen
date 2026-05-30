import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Našeptávač adres. Proxy přes server, ať jde provider snadno přepnout:
// - když je nastaven MAPY_API_KEY → použije Mapy.cz Suggest (nejlepší pro ČR),
// - jinak fallback na Photon (komoot, OSM) – zdarma, bez klíče, filtrováno na ČR.
// Vrací { suggestions: [{ label }] }.

type Suggestion = { label: string };

async function fromMapy(q: string, key: string): Promise<Suggestion[]> {
  const url =
    `https://api.mapy.cz/v1/suggest?lang=cs&limit=6&type=regional.address` +
    `&query=${encodeURIComponent(q)}&apikey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("mapy " + res.status);
  const json = await res.json();
  return (json.items || [])
    .map((it: any) => ({
      label: it.name && it.location ? `${it.name}, ${it.location}` : it.name || it.label,
    }))
    .filter((s: Suggestion) => s.label);
}

async function fromPhoton(q: string): Promise<Suggestion[]> {
  // bias na ČR (lat/lon střed) + limit; filtrujeme na countrycode CZ
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=8&lang=default&lat=49.8&lon=15.5`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("photon " + res.status);
  const json = await res.json();
  const out: Suggestion[] = [];
  for (const f of json.features || []) {
    const p = f.properties || {};
    if (p.countrycode && p.countrycode !== "CZ") continue;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const cityLine = [p.postcode, p.city || p.district || p.county].filter(Boolean).join(" ");
    const main = street || p.name;
    const label = [main, cityLine].filter(Boolean).join(", ");
    if (label && !out.some((s) => s.label === label)) out.push({ label });
  }
  return out.slice(0, 6);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  try {
    const key = process.env.MAPY_API_KEY;
    const suggestions = key ? await fromMapy(q, key) : await fromPhoton(q);
    return NextResponse.json({ suggestions });
  } catch (e: any) {
    // Při výpadku našeptávače radši vrátíme prázdno než chybu – pole jde vyplnit ručně.
    return NextResponse.json({ suggestions: [], error: e?.message });
  }
}
