// Potvrzovací e-mail pro úvěrové (refinanční) flow.
import { Resend } from "resend";
import type { Lead } from "./types";
import { formatKc } from "./savings";
import {
  BRAND,
  FROM,
  REPLY_TO,
  header,
  logoAttachments,
  escapeHtml,
  esc,
  type EmailResult,
} from "./email-brand";

export type { EmailResult };

function htmlTemplate(lead: Lead): string {
  const { loan, savings } = lead;
  const uspora = savings.rocniUspora > 0 ? `cca ${formatKc(savings.rocniUspora)}` : "—";
  const urgent =
    savings.urgentni && savings.mesicuDoFixace !== null
      ? `<tr><td style="padding:12px 16px;background:#fff7ed;color:#b45309;border:1px solid #fed7aa;border-radius:10px;font-size:14px;font-family:'Raleway',Arial,sans-serif;">
           ⏰ Fixace končí za ${savings.mesicuDoFixace} měsíců – ideální čas na refinancování.</td></tr>
         <tr><td style="height:14px"></td></tr>`
      : "";

  const radek = (k: string, v: string) =>
    `<tr>
       <td style="padding:9px 0;color:${BRAND.muted};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${k}</td>
       <td style="padding:9px 0;text-align:right;font-weight:600;color:${BRAND.ink};font-size:14px;font-family:'Raleway',Arial,sans-serif;">${v}</td>
     </tr>`;

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
            Zaznamenali jsme tvůj požadavek na nezávaznou kontrolu úvěru. Náš poradce se ti brzy ozve.
          </p>

          <table role="presentation" width="100%" style="background:${BRAND.tint};border:1px solid ${BRAND.border};border-radius:14px;padding:20px;margin-bottom:18px;">
            <tr><td style="text-align:center;color:${BRAND.muted};font-size:14px;">Tvůj potenciál úspory</td></tr>
            <tr><td style="text-align:center;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;font-size:40px;letter-spacing:1px;color:${BRAND.blueDark};padding:6px 0;">${uspora}</td></tr>
            <tr><td style="text-align:center;color:${BRAND.muted};font-size:13px;">ročně oproti tržní sazbě ${savings.trzniSazba} %</td></tr>
          </table>

          <table role="presentation" width="100%">${urgent}</table>

          <table role="presentation" width="100%" style="border-top:1px solid ${BRAND.border};margin-top:6px;">
            ${radek("Produkt", esc(loan.produkt))}
            ${radek("Poskytovatel", esc(loan.poskytovatel))}
            ${radek("Výše úvěru", loan.vyseUveru != null ? formatKc(loan.vyseUveru) : "—")}
            ${radek("Tvoje sazba", loan.sazba != null ? loan.sazba + " %" : "—")}
            ${radek("Tržní sazba", savings.trzniSazba + " %")}
            ${radek("Konec fixace", esc(loan.datumFixace))}
            ${savings.usporaDoFixace != null ? radek("Úspora do konce fixace", formatKc(savings.usporaDoFixace)) : ""}
          </table>

          <p style="margin:22px 0 4px;font-size:13px;color:#9aa3ad;line-height:1.5;">
            Odhad je orientační a vychází z údajů z nahraného dokumentu. Přesnou úsporu ti spočítá poradce.
          </p>
        </td></tr>
        <tr><td style="background:${BRAND.ink};padding:18px 32px;color:#aeb6bf;font-size:12px;text-align:center;font-family:'Raleway',Arial,sans-serif;">
          <span style="color:#fff;font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif;letter-spacing:1px;font-size:15px;">SJEDNEJ.CZ</span><br>
          Tento e-mail jsi dostal, protože jsi požádal o kontrolu úvěru zdarma.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textTemplate(lead: Lead): string {
  const { loan, savings } = lead;
  return [
    `SJEDNEJ.CZ`,
    ``,
    `Děkujeme, ${lead.jmeno}!`,
    ``,
    `Zaznamenali jsme tvůj požadavek na nezávaznou kontrolu úvěru. Poradce se ti brzy ozve.`,
    ``,
    `Tvůj potenciál úspory: ${savings.rocniUspora > 0 ? "cca " + formatKc(savings.rocniUspora) + " ročně" : "—"}`,
    `Tvoje sazba: ${loan.sazba ?? "—"} % | Tržní sazba: ${savings.trzniSazba} %`,
    savings.usporaDoFixace != null ? `Úspora do konce fixace: ${formatKc(savings.usporaDoFixace)}` : ``,
    ``,
    `Odhad je orientační a vychází z údajů z nahraného dokumentu.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendConfirmationEmail(lead: Lead): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY není nastaven" };
  if (!lead.email) return { sent: false, reason: "Klient nezadal e-mail" };

  const resend = new Resend(apiKey);
  const attachments = logoAttachments();
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: lead.email,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      ...(attachments ? { attachments } : {}),
      subject: `Tvoje kontrola úvěru: potenciál úspory ${
        lead.savings.rocniUspora > 0 ? formatKc(lead.savings.rocniUspora) + " ročně" : "zdarma"
      }`,
      html: htmlTemplate(lead),
      text: textTemplate(lead),
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true, id: data?.id || "" };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "Neznámá chyba e-mailu" };
  }
}
