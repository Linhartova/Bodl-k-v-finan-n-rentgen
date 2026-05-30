// Potvrzovací e-mail pro kontrolu pojištění majetku (podpojištění).
import { Resend } from "resend";
import type { InsuranceLead } from "./types";
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

function insuranceHtml(lead: InsuranceLead): string {
  const { insurance: ins, result } = lead;
  const podpoj = result.podpojisteny;
  const ztrata =
    result.ztrataProKlienta != null && result.ztrataProKlienta > 0
      ? formatKc(result.ztrataProKlienta)
      : "—";

  const radek = (k: string, v: string) =>
    `<tr>
       <td style="padding:9px 0;color:${BRAND.muted};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${k}</td>
       <td style="padding:9px 0;text-align:right;font-weight:600;color:${BRAND.ink};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${v}</td>
     </tr>`;

  const warn = podpoj
    ? `<tr><td style="padding:12px 16px;background:#fff7ed;color:#b45309;border:1px solid #fed7aa;border-radius:10px;font-size:14px;font-family:'Raleway',Arial,sans-serif;">
         ⚠️ Jsi podpojištěný – při totální škodě bys přišel o ${ztrata}.</td></tr>
       <tr><td style="height:14px"></td></tr>`
    : "";

  const hlavni = podpoj ? `Při totální škodě bys přišel o` : `Tvoje pojistné krytí`;
  const hlavniHodnota = podpoj ? ztrata : "v pořádku ✅";

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
            Zaznamenali jsme tvůj požadavek na kontrolu pojištění nemovitosti. Náš poradce se ti brzy ozve.
          </p>

          <table role="presentation" width="100%" style="background:${BRAND.tint};border:1px solid ${BRAND.border};border-radius:14px;padding:20px;margin-bottom:18px;">
            <tr><td style="text-align:center;color:${BRAND.muted};font-size:14px;">${hlavni}</td></tr>
            <tr><td style="text-align:center;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;font-size:40px;letter-spacing:1px;color:${BRAND.blueDark};padding:6px 0;">${hlavniHodnota}</td></tr>
          </table>

          <table role="presentation" width="100%">${warn}</table>

          <table role="presentation" width="100%" style="border-top:1px solid ${BRAND.border};margin-top:6px;">
            ${radek("Typ nemovitosti", esc(ins.typNemovitosti))}
            ${radek("Pojišťovna", esc(ins.pojistovna))}
            ${radek("Pojistná částka stavby", ins.pojistnaCastkaNemovitost != null ? formatKc(ins.pojistnaCastkaNemovitost) : "—")}
            ${radek("Odhad hodnoty stavby", result.soucasnaHodnota != null ? formatKc(result.soucasnaHodnota) : "—")}
            ${radek("Krytí", result.pomerKryti != null ? Math.round(result.pomerKryti * 100) + " %" : "—")}
            ${radek("Plnění při totální škodě", result.plneniProTotalniSkodu != null ? formatKc(result.plneniProTotalniSkodu) : "—")}
          </table>

          <p style="margin:22px 0 4px;font-size:13px;color:#9aa3ad;line-height:1.5;">
            Odhad hodnoty je orientační a vychází z plochy a typu nemovitosti. Přesné posouzení provede poradce.
          </p>
        </td></tr>
        <tr><td style="background:${BRAND.ink};padding:18px 32px;color:#aeb6bf;font-size:12px;text-align:center;font-family:'Raleway',Arial,sans-serif;">
          <span style="color:#fff;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;letter-spacing:1px;font-size:15px;">SJEDNEJ.CZ</span><br>
          Tento e-mail jsi dostal, protože jsi požádal o kontrolu pojištění zdarma.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function insuranceText(lead: InsuranceLead): string {
  const { insurance: ins, result } = lead;
  return [
    `SJEDNEJ.CZ`,
    ``,
    `Děkujeme, ${lead.jmeno}!`,
    ``,
    `Zaznamenali jsme tvůj požadavek na kontrolu pojištění nemovitosti. Poradce se ti brzy ozve.`,
    ``,
    result.podpojisteny && result.ztrataProKlienta
      ? `POZOR: Jsi podpojištěný – při totální škodě bys přišel o ${formatKc(result.ztrataProKlienta)}.`
      : `Tvoje pojistné krytí vypadá v pořádku.`,
    `Pojistná částka stavby: ${ins.pojistnaCastkaNemovitost != null ? formatKc(ins.pojistnaCastkaNemovitost) : "—"}`,
    `Odhad hodnoty stavby: ${result.soucasnaHodnota != null ? formatKc(result.soucasnaHodnota) : "—"}`,
    result.pomerKryti != null ? `Krytí: ${Math.round(result.pomerKryti * 100)} %` : ``,
    ``,
    `Odhad je orientační a vychází z údajů z nahraného dokumentu.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendInsuranceConfirmationEmail(lead: InsuranceLead): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY není nastaven" };
  if (!lead.email) return { sent: false, reason: "Klient nezadal e-mail" };

  const resend = new Resend(apiKey);
  const attachments = logoAttachments();
  try {
    const podpoj = lead.result.podpojisteny && lead.result.ztrataProKlienta;
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: lead.email,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      ...(attachments ? { attachments } : {}),
      subject: podpoj
        ? `Pozor: u pojištění nemovitosti ti hrozí ztráta ${formatKc(lead.result.ztrataProKlienta!)}`
        : `Tvoje kontrola pojištění nemovitosti`,
      html: insuranceHtml(lead),
      text: insuranceText(lead),
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true, id: data?.id || "" };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "Neznámá chyba e-mailu" };
  }
}
