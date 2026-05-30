// Potvrzovací e-mail pro kontrolu životního pojištění.
import { Resend } from "resend";
import type { LifeLead } from "./types";
import { formatKc } from "./calc";
import {
  BRAND,
  FROM,
  REPLY_TO,
  header,
  logoAttachments,
  escapeHtml,
  esc,
  type EmailResult,
} from "@/lib/email-brand";

export type { EmailResult };

// Hlavní zjištění do hlavičky e-mailu: priorita mezera v krytí, pak úspora.
function headline(lead: LifeLead): { popis: string; hodnota: string } {
  const { result } = lead;
  if (result.celkovaMezera > 0) {
    return { popis: "V krytí klíčových rizik ti chybí", hodnota: formatKc(result.celkovaMezera) };
  }
  if (result.jeInvesticni && result.odhadUsporaPojistne) {
    return { popis: "Můžeš ušetřit ročně", hodnota: formatKc(result.odhadUsporaPojistne) };
  }
  return { popis: "Tvoje životní pojištění", hodnota: "v pořádku ✅" };
}

function lifeHtml(lead: LifeLead): string {
  const { life, result } = lead;
  const h = headline(lead);

  const radek = (k: string, v: string) =>
    `<tr>
       <td style="padding:9px 0;color:${BRAND.muted};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${k}</td>
       <td style="padding:9px 0;text-align:right;font-weight:600;color:${BRAND.ink};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${v}</td>
     </tr>`;

  const warns: string[] = [];
  if (result.chybiInvalidita) {
    warns.push("⚠️ Nemáš sjednanou invaliditu 3. stupně – nejvážnější opomíjené riziko.");
  } else if (result.podpojistenyInvalidita) {
    warns.push(`⚠️ Krytí invalidity je nižší než doporučení (chybí ${formatKc(result.mezeraInvalidita)}).`);
  }
  if (result.podpojistenySmrt) {
    warns.push(`⚠️ Krytí pro případ smrti je podpojištěné (chybí ${formatKc(result.mezeraSmrt)}).`);
  }
  if (result.jeInvesticni && result.odhadUsporaPojistne) {
    warns.push(`💸 Investiční pojištění – odhadem ${formatKc(result.odhadUsporaPojistne)} ročně jde mimo ochranu.`);
  }
  const warnHtml = warns
    .map(
      (w) =>
        `<tr><td style="padding:12px 16px;background:#fff7ed;color:#b45309;border:1px solid #fed7aa;border-radius:10px;font-size:14px;font-family:'Raleway',Arial,sans-serif;">${w}</td></tr>
         <tr><td style="height:10px"></td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Raleway:wght@400;500;600;700&display=swap');</style>
</head>
<body style="margin:0;background:#eef4f8;font-family:'Raleway',Arial,Helvetica,sans-serif;color:${BRAND.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 34px rgba(8,11,13,.10);">
        ${header()}
        <tr><td style="padding:30px 32px 8px;">
          <div style="font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;font-size:30px;letter-spacing:1px;color:${BRAND.ink};">
            DĚKUJEME, ${escapeHtml(lead.jmeno).toUpperCase()}!
          </div>
          <p style="margin:10px 0 20px;font-size:15px;line-height:1.55;color:#4b5563;">
            Zaznamenali jsme tvůj požadavek na kontrolu životního pojištění. Náš poradce se ti brzy ozve.
          </p>

          <table role="presentation" width="100%" style="background:${BRAND.tint};border:1px solid ${BRAND.border};border-radius:14px;padding:20px;margin-bottom:18px;">
            <tr><td style="text-align:center;color:${BRAND.muted};font-size:14px;">${h.popis}</td></tr>
            <tr><td style="text-align:center;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;font-size:40px;letter-spacing:1px;color:${BRAND.blueDark};padding:6px 0;">${h.hodnota}</td></tr>
          </table>

          <table role="presentation" width="100%">${warnHtml}</table>

          <table role="presentation" width="100%" style="border-top:1px solid ${BRAND.border};margin-top:6px;">
            ${radek("Pojišťovna", esc(life.pojistovna))}
            ${radek("Produkt", esc(life.nazevProduktu))}
            ${radek("Typ pojištění", esc(life.typPojisteni))}
            ${radek("Smrt z jakékoliv příčiny", life.smrtJakakolivPricina != null ? formatKc(life.smrtJakakolivPricina) : "—")}
            ${radek("Doporučeno – smrt", formatKc(result.doporucenaSmrt))}
            ${radek("Invalidita 3. stupně", life.invalidita3 != null ? formatKc(life.invalidita3) : "—")}
            ${radek("Doporučeno – invalidita 3. st.", formatKc(result.doporucenaInvalidita))}
            ${radek("Měsíční pojistné", life.mesicniPojistne != null ? formatKc(life.mesicniPojistne) : "—")}
          </table>

          <p style="margin:22px 0 4px;font-size:13px;color:#9aa3ad;line-height:1.5;">
            Doporučené částky jsou orientační a vycházejí z údajů ze smlouvy a zadaného příjmu. Přesné posouzení provede poradce.
          </p>
        </td></tr>
        <tr><td style="background:${BRAND.ink};padding:18px 32px;color:#aeb6bf;font-size:12px;text-align:center;font-family:'Raleway',Arial,sans-serif;">
          <span style="color:#fff;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;letter-spacing:1px;font-size:15px;">SJEDNEJ.CZ</span><br>
          Tento e-mail jsi dostal, protože jsi požádal o kontrolu životního pojištění zdarma.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function lifeText(lead: LifeLead): string {
  const { life, result } = lead;
  const h = headline(lead);
  return [
    `SJEDNEJ.CZ`,
    ``,
    `Děkujeme, ${lead.jmeno}!`,
    ``,
    `Zaznamenali jsme tvůj požadavek na kontrolu životního pojištění. Poradce se ti brzy ozve.`,
    ``,
    `${h.popis}: ${h.hodnota}`,
    result.chybiInvalidita ? `POZOR: Nemáš sjednanou invaliditu 3. stupně.` : ``,
    `Smrt z jakékoliv příčiny: ${life.smrtJakakolivPricina != null ? formatKc(life.smrtJakakolivPricina) : "—"} (doporučeno ${formatKc(result.doporucenaSmrt)})`,
    `Invalidita 3. st.: ${life.invalidita3 != null ? formatKc(life.invalidita3) : "—"} (doporučeno ${formatKc(result.doporucenaInvalidita)})`,
    `Měsíční pojistné: ${life.mesicniPojistne != null ? formatKc(life.mesicniPojistne) : "—"}`,
    ``,
    `Odhad je orientační a vychází z údajů z nahraného dokumentu.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendLifeConfirmationEmail(lead: LifeLead): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY není nastaven" };
  if (!lead.email) return { sent: false, reason: "Klient nezadal e-mail" };

  const resend = new Resend(apiKey);
  const attachments = logoAttachments();
  try {
    const h = headline(lead);
    const mezera = lead.result.celkovaMezera > 0;
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: lead.email,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      ...(attachments ? { attachments } : {}),
      subject: mezera
        ? `Pozor: v životním pojištění ti chybí krytí ${h.hodnota}`
        : `Tvoje kontrola životního pojištění`,
      html: lifeHtml(lead),
      text: lifeText(lead),
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true, id: data?.id || "" };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "Neznámá chyba e-mailu" };
  }
}
