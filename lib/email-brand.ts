// Sdílené brandové prvky pro e-maily (úvěr i pojištění). Žádná byznys logika –
// jen branding Sjednej.cz, logo a HTML helpery, aby se flow nemíchaly.
import { readFileSync } from "fs";
import { join } from "path";

// Odesílací adresa. V sandboxu Resend (bez ověřené domény) musí zůstat
// onboarding@resend.dev; po ověření domény přepiš na vlastní, např.
// "Sjednej.cz <kontrola@sjednej.cz>".
export const FROM = process.env.EMAIL_FROM || "Sjednej.cz <onboarding@resend.dev>";
export const REPLY_TO = process.env.EMAIL_REPLY_TO; // volitelné

// --- Brand Sjednej.cz (z brand manuálu) ---
export const BRAND = {
  blue: "#2ea8de",
  blueDark: "#1b87bb",
  ink: "#2c2e35",
  black: "#080b0d",
  tint: "#eaf6fc",
  muted: "#6b7280",
  border: "#e3eef4",
};

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: string };

// Zdroj loga v hlavičce: buď hostovaná URL (EMAIL_LOGO_URL), nebo inline příloha (cid:logo).
const LOGO_SRC = process.env.EMAIL_LOGO_URL || "cid:logo";

// Inline příloha s logem (bílá varianta). Vrací undefined, pokud se používá
// hostovaná URL nebo soubor nelze načíst – e-mail se i tak odešle (jen s alt textem).
export function logoAttachments():
  | { filename: string; content: Buffer; contentId: string; contentType: string }[]
  | undefined {
  if (process.env.EMAIL_LOGO_URL) return undefined;
  try {
    const content = readFileSync(join(process.cwd(), "public", "sjednej-logo-white.png"));
    return [{ filename: "sjednej-logo.png", content, contentId: "logo", contentType: "image/png" }];
  } catch {
    return undefined;
  }
}

// Hlavička s oficiálním logem Sjednej.cz (bílá varianta na modrém pozadí).
export function header(): string {
  return `<tr><td style="background:${BRAND.blue};padding:24px 32px;">
    <img src="${LOGO_SRC}" alt="Sjednej.cz" height="32" style="height:32px;width:auto;display:block;border:0;">
  </td></tr>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function esc(v: string | null): string {
  return v ? escapeHtml(v) : "—";
}
