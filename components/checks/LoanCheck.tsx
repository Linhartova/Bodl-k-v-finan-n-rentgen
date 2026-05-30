"use client";

import { useMemo, useRef, useState } from "react";
import type { ExtractedLoan, SavingsResult, Lead } from "@/lib/types";
import { calculateSavings, formatKc } from "@/lib/savings";
import { scoreLoan } from "@/lib/score";
import BodlikBadge from "@/components/BodlikBadge";
import PhoneField, { formatPhone, VYCHOZI_PREDVOLBA } from "@/components/PhoneField";
import LeadForm from "@/components/checks/LeadForm";
import ScoreResultView from "@/components/checks/ScoreResult";

type Step = "upload" | "extracting" | "review" | "result" | "done";

export default function LoanCheck() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loan, setLoan] = useState<ExtractedLoan | null>(null);
  const [form, setForm] = useState({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
  const [gdpr, setGdpr] = useState(false);
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string>("");
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const savings: SavingsResult | null = useMemo(
    () => (loan ? calculateSavings(loan) : null),
    [loan]
  );

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    setFile(f);
  }

  async function handleExtract() {
    if (!file) return;
    setError(null);
    setManual(false);
    setStep("extracting");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nepodařilo se zpracovat dokument.");
      if (!json.loan?.jeUverovaSmlouva) {
        setLoan(json.loan);
        setError(
          "Dokument se nepodařilo rozpoznat jako úvěrovou smlouvu. Zkontroluj prosím údaje níže ručně."
        );
      }
      setLoan(json.loan as ExtractedLoan);
      setStep("review");
    } catch (e: any) {
      setError(e.message);
      setStep("upload");
    }
  }

  // Klient nechce nahrávat smlouvu – přeskočí rovnou na ruční vyplnění formuláře.
  function startManual() {
    setError(null);
    setFile(null);
    setManual(true);
    setLoan({
      produkt: "Hypotéka",
      poskytovatel: null,
      vyseUveru: null,
      sazba: null,
      datumFixace: null,
      splatnostMesicu: null,
      jeUverovaSmlouva: true,
      poznamka: null,
    });
    setStep("review");
  }

  function updateLoan<K extends keyof ExtractedLoan>(key: K, raw: string) {
    setLoan((prev) => {
      if (!prev) return prev;
      let value: any = raw;
      if (key === "vyseUveru" || key === "sazba" || key === "splatnostMesicu") {
        const n = Number(raw.replace(",", "."));
        value = raw === "" ? null : Number.isFinite(n) ? n : prev[key];
      } else if (raw === "") {
        value = null;
      }
      return { ...prev, [key]: value };
    });
  }

  async function handleSendLead() {
    if (!loan || !savings) return;
    setError(null);
    if (form.jmeno.trim().length < 2) return setError("Vyplň prosím jméno.");
    if (!form.email && !form.telefon) return setError("Vyplň e-mail nebo telefon.");
    if (!gdpr) return setError("Potvrď prosím souhlas se zpracováním údajů.");
    setSending(true);
    try {
      const payload: Lead = {
        jmeno: form.jmeno,
        email: form.email,
        telefon: formatPhone(form.predvolba, form.telefon),
        loan,
        savings,
      };
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Nepodařilo se odeslat.");
      setDoneMsg(
        json.mode === "pipedrive"
          ? "Předali jsme tě poradci. Ozve se ti co nejdřív."
          : "Tvůj požadavek jsme zaznamenali. Ozveme se ti co nejdřív."
      );
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setLoan(null);
    setForm({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
    setGdpr(false);
    setError(null);
    setManual(false);
  }

  const stepIndex = { upload: 0, extracting: 0, review: 1, result: 2, done: 3 }[step];

  return (
    <div className="wrap">
      <div className="hero">
        <img className="brand-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />

        <h1>Kolik zbytečně platíš za úvěr?</h1>
        <p>Nahraj smlouvu a během chvíle uvidíš svůj potenciál úspory.</p>
        <BodlikBadge />
      </div>

      <div className="card">
        <div className="steps">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={"dot " + (i < stepIndex ? "done" : i === stepIndex ? "active" : "")}
            />
          ))}
        </div>

        {/* KROK 1 – upload */}
        {step === "upload" && (
          <>
            <div
              className={"drop" + (over ? " over" : "")}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <div className="icon">📄</div>
              <h3>Nahraj smlouvu o úvěru</h3>
              <p>PDF nebo fotka (PNG/JPG). Přetáhni sem nebo klikni.</p>
              {file && <div className="filename">✓ {file.name}</div>}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary mt" disabled={!file} onClick={handleExtract}>
              Zjistit moji úsporu
            </button>
            <div className="or">nebo</div>
            <button className="btn btn-outline" onClick={startManual}>
              Nemám smlouvu po ruce – zadat údaje ručně
            </button>
            <p className="legal">
              Dokument zpracujeme jen pro výpočet úspory. Žádný spam.
            </p>
          </>
        )}

        {/* KROK 1b – extrakce */}
        {step === "extracting" && (
          <div className="center">
            <div className="spinner" />
            <h3>Čtu tvoji smlouvu…</h3>
            <p className="muted">Vytahuju sazbu, fixaci a výši úvěru.</p>
          </div>
        )}

        {/* KROK 2 – kontrola dat */}
        {step === "review" && loan && (
          <>
            <h3 style={{ marginTop: 0 }}>{manual ? "Zadej údaje o úvěru" : "Zkontroluj vytažené údaje"}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              {manual
                ? "Vyplň, co víš – co nevíš, nech prázdné. Výpočet se počítá průběžně."
                : "Cokoli můžeš opravit – výpočet se hned přepočítá."}
            </p>
            {loan.poznamka && <div className="muted">ℹ️ {loan.poznamka}</div>}

            <div className="mt">
              <div className="grid2">
                <label className="field">
                  <span>Produkt</span>
                  {manual ? (
                    <select
                      className="inp"
                      value={loan.produkt ?? ""}
                      onChange={(e) => updateLoan("produkt", e.target.value)}
                    >
                      <option value="Spotřebitelský úvěr">Spotřebitelský úvěr</option>
                      <option value="Hypotéka">Hypotéka</option>
                    </select>
                  ) : (
                    <input
                      className="inp"
                      value={loan.produkt ?? ""}
                      onChange={(e) => updateLoan("produkt", e.target.value)}
                    />
                  )}
                </label>
                <label className="field">
                  <span>Poskytovatel</span>
                  <input
                    className="inp"
                    value={loan.poskytovatel ?? ""}
                    onChange={(e) => updateLoan("poskytovatel", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Výše úvěru (Kč)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={loan.vyseUveru ?? ""}
                    onChange={(e) => updateLoan("vyseUveru", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Úroková sazba (% p.a.)</span>
                  <input
                    className="inp"
                    inputMode="decimal"
                    value={loan.sazba ?? ""}
                    onChange={(e) => updateLoan("sazba", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Konec fixace</span>
                  <input
                    className="inp"
                    type="date"
                    value={loan.datumFixace ?? ""}
                    onChange={(e) => updateLoan("datumFixace", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Zbývá splatnost (měsíců)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={loan.splatnostMesicu ?? ""}
                    onChange={(e) => updateLoan("splatnostMesicu", e.target.value)}
                  />
                </label>
              </div>
            </div>

            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary mt" onClick={() => setStep("result")}>
              Spočítat úsporu →
            </button>
            <div className="center">
              <button className="btn btn-ghost" onClick={reset}>
                {manual ? "← Zpět" : "← Nahrát jiný dokument"}
              </button>
            </div>
          </>
        )}

        {/* KROK 3 – zamčený teaser + lead form */}
        {step === "result" && savings && loan && (
          <>
            <div className="savings">
              <div className="label">🔒 Bodlíkovo finanční skóre je spočítané</div>
              <div className="amount" style={{ fontSize: 40 }}>•••</div>
              <div className="sub">Vyplň formulář a hned ti odhalíme skóre i spící peníze.</div>
            </div>

            <LeadForm
              form={form}
              setForm={setForm}
              gdpr={gdpr}
              setGdpr={setGdpr}
              error={error}
              sending={sending}
              onSubmit={handleSendLead}
              onBack={() => setStep("review")}
              submitLabel="Zobrazit moje finanční skóre →"
            />
          </>
        )}

        {/* KROK 4 – odhalení skóre + spící peníze + konzultace */}
        {step === "done" && savings && loan && (
          <ScoreResultView
            score={scoreLoan(loan, savings)}
            doneMsg={doneMsg}
            onReset={reset}
            kontakt={{ jmeno: form.jmeno, email: form.email, telefon: formatPhone(form.predvolba, form.telefon) }}
          />
        )}
      </div>
    </div>
  );
}
