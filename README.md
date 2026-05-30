# Kontrola úvěru – „kolik zbytečně platím?“

Webová aplikace, která:

1. **Nahraje smlouvu** o úvěru / hypotéce (PDF nebo fotka).
2. **Vytáhne data** přes Claude vision (OCR): produkt, poskytovatel, výše úvěru, sazba, datum fixace, splatnost.
3. **Spočítá úsporu** oproti referenční tržní sazbě (anuitní výpočet).
4. **Ukáže výsledek** – „U tebe vidíme potenciál úspory cca 18 400 Kč ročně.“
5. **Předá lead poradci** – klient klikne „Chci kontrolu zdarma“ → lead do **Pipedrive**.

## Stack

- Next.js 14 (App Router) + TypeScript
- `@anthropic-ai/sdk` – vision OCR z dokumentu
- Pipedrive REST API – tvorba Person + Lead + Note

## Spuštění

```bash
npm install
# vyplň klíče v .env.local
npm run dev
```

App běží na <http://localhost:3000>.

## Konfigurace (`.env.local`)

| Proměnná | Význam |
|---|---|
| `ANTHROPIC_API_KEY` | Klíč k Anthropic API (OCR). Bez něj krok extrakce vrátí chybu. |
| `ANTHROPIC_MODEL` | Volitelné, default `claude-sonnet-4-6`. |
| `MARKET_RATE` | Referenční tržní sazba v % (default `4.5`). |
| `PIPEDRIVE_API_TOKEN` | Token Pipedrive API. |
| `PIPEDRIVE_DOMAIN` | Subdoména instance (z `mojefirma.pipedrive.com` → `mojefirma`). |

### Fallback bez Pipedrive

Pokud `PIPEDRIVE_API_TOKEN` / `PIPEDRIVE_DOMAIN` nejsou vyplněné (nebo API selže),
lead se uloží lokálně do `data/leads.json`, takže demo funguje vždy.

## Jak funguje výpočet úspory

`lib/savings.ts` spočítá rozdíl měsíční anuitní splátky při aktuální sazbě klienta
vs. referenční tržní sazbě a vynásobí 12 → roční úspora. Pokud chybí zbývající
splatnost, použije se odhad 20 let. Když do konce fixace zbývá ≤ 12 měsíců,
lead se označí jako **urgentní**.

## Architektura

```
app/
  page.tsx              # celý flow (upload → kontrola → výsledek → lead)
  api/extract/route.ts  # Claude vision OCR → ExtractedLoan
  api/lead/route.ts     # validace → Pipedrive (Person+Lead+Note) / lokální fallback
lib/
  types.ts              # ExtractedLoan, SavingsResult, Lead
  savings.ts            # výpočet úspory + formátování Kč
```
