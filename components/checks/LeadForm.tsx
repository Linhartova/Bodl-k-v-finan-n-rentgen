"use client";

import PhoneField from "@/components/PhoneField";

export interface LeadFormState {
  jmeno: string;
  email: string;
  telefon: string;
  predvolba: string;
}

// Sdílený lead formulář (jméno + e-mail + telefon + GDPR) před odhalením reportu.
// Texty cílí na konverzi: "Pošleme vám kompletní report a doporučení zdarma."
export default function LeadForm({
  form,
  setForm,
  gdpr,
  setGdpr,
  error,
  sending,
  onSubmit,
  onBack,
  submitLabel,
}: {
  form: LeadFormState;
  setForm: (f: LeadFormState) => void;
  gdpr: boolean;
  setGdpr: (v: boolean) => void;
  error: string | null;
  sending: boolean;
  onSubmit: () => void;
  onBack: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Pošleme ti kompletní report a doporučení zdarma</h3>
      <p className="muted" style={{ marginTop: -6 }}>
        Nech nám kontakt – výsledek uvidíš hned a poradce ti ho nezávazně ověří.
      </p>
      <label className="field">
        <span>Jméno a příjmení</span>
        <input
          className="inp"
          value={form.jmeno}
          onChange={(e) => setForm({ ...form, jmeno: e.target.value })}
          placeholder="Jan Novák"
        />
      </label>
      <div className="grid2">
        <label className="field">
          <span>E-mail</span>
          <input
            className="inp"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jan@email.cz"
          />
        </label>
        <PhoneField
          predvolba={form.predvolba}
          telefon={form.telefon}
          onPredvolbaChange={(v) => setForm({ ...form, predvolba: v })}
          onTelefonChange={(v) => setForm({ ...form, telefon: v })}
        />
      </div>

      <label className="gdpr">
        <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} />
        <span>
          Souhlasím se zpracováním osobních údajů pro účely nezávazné konzultace.{" "}
          <a
            href="https://www.sjednej.cz/ochrana-osobnich-udaju"
            target="_blank"
            rel="noopener noreferrer"
          >
            Více
          </a>
        </span>
      </label>

      {error && <div className="err">{error}</div>}
      <button className="btn btn-good mt" disabled={sending} onClick={onSubmit}>
        {sending ? "Odesílám…" : submitLabel}
      </button>
      <div className="center">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Upravit údaje
        </button>
      </div>
    </div>
  );
}
