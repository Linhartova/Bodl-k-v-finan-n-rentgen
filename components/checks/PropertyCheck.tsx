"use client";

import { useMemo, useRef, useState } from "react";
import type { ExtractedInsurance, InsuranceResult, InsuranceLead } from "@/lib/insurance/types";
import { analyzeInsurance, formatKc } from "@/lib/insurance/calc";
import BodlikBadge from "@/components/BodlikBadge";
import PhoneField, { formatPhone, VYCHOZI_PREDVOLBA } from "@/components/PhoneField";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type Step = "upload" | "extracting" | "review" | "result" | "done";

export default function PropertyCheck() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ins, setIns] = useState<ExtractedInsurance | null>(null);
  const [form, setForm] = useState({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string>("");
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result: InsuranceResult | null = useMemo(
    () => (ins ? analyzeInsurance(ins) : null),
    [ins]
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
      const res = await fetch("/api/insurance/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nepodařilo se zpracovat dokument.");
      if (!json.insurance?.jePojistnaSmlouva) {
        setError(
          "Dokument se nepodařilo rozpoznat jako pojistnou smlouvu. Zkontroluj prosím údaje níže ručně."
        );
      }
      setIns(json.insurance as ExtractedInsurance);
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
    setIns({
      typNemovitosti: null,
      adresa: null,
      rokVystavby: null,
      rokRekonstrukce: null,
      obytnaPlocha: null,
      pojistnaCastkaNemovitost: null,
      pojistnaCastkaDomacnost: null,
      rocniPojistne: null,
      spoluucast: null,
      pojistenaRizika: null,
      datumSjednani: null,
      datumAktualizace: null,
      pojistovna: null,
      jePojistnaSmlouva: true,
      poznamka: null,
    });
    setStep("review");
  }

  function updateIns<K extends keyof ExtractedInsurance>(key: K, raw: string) {
    setIns((prev) => {
      if (!prev) return prev;
      const numKeys: (keyof ExtractedInsurance)[] = [
        "rokVystavby",
        "rokRekonstrukce",
        "obytnaPlocha",
        "pojistnaCastkaNemovitost",
        "pojistnaCastkaDomacnost",
        "rocniPojistne",
      ];
      let value: any = raw;
      if (numKeys.includes(key)) {
        const n = Number(raw.replace(/\s/g, "").replace(",", "."));
        value = raw === "" ? null : Number.isFinite(n) ? n : prev[key];
      } else if (raw === "") {
        value = null;
      }
      return { ...prev, [key]: value };
    });
  }

  async function handleSendLead() {
    if (!ins || !result) return;
    setError(null);
    if (form.jmeno.trim().length < 2) return setError("Vyplň prosím jméno.");
    if (!form.email && !form.telefon) return setError("Vyplň e-mail nebo telefon.");
    setSending(true);
    try {
      const payload: InsuranceLead = {
        jmeno: form.jmeno,
        email: form.email,
        telefon: formatPhone(form.predvolba, form.telefon),
        insurance: ins,
        result,
      };
      const res = await fetch("/api/insurance/lead", {
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
    setIns(null);
    setForm({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
    setError(null);
    setManual(false);
  }

  const stepIndex = { upload: 0, extracting: 0, review: 1, result: 2, done: 3 }[step];
  const krytiPct = result?.pomerKryti != null ? Math.round(result.pomerKryti * 100) : null;
  const isByt = /(byt|jednotk)/i.test(ins?.typNemovitosti ?? "");

  return (
    <div className="wrap">
      <div className="hero">
        <img className="brand-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />

        <h1>Není tvoje nemovitost podpojištěná?</h1>
        <p>Nahraj pojistnou smlouvu a zjisti, o kolik bys přišel při totální škodě.</p>
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
              <div className="icon">🏠</div>
              <h3>Nahraj pojistnou smlouvu nemovitosti</h3>
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
              Zkontrolovat pojištění
            </button>
            <div className="or">nebo</div>
            <button className="btn btn-outline" onClick={startManual}>
              Nemám smlouvu po ruce – zadat údaje ručně
            </button>
            <p className="legal">Dokument zpracujeme jen pro kontrolu pojištění. Žádný spam.</p>
          </>
        )}

        {/* KROK 1b – extrakce */}
        {step === "extracting" && (
          <div className="center">
            <div className="spinner" />
            <h3>Čtu tvoji smlouvu…</h3>
            <p className="muted">Vytahuju pojistné částky, plochu a rizika.</p>
          </div>
        )}

        {/* KROK 2 – kontrola dat */}
        {step === "review" && ins && (
          <>
            <h3 style={{ marginTop: 0 }}>{manual ? "Zadej údaje o pojištění" : "Zkontroluj vytažené údaje"}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              {manual
                ? "Vyplň, co víš – co nevíš, nech prázdné. Výpočet se počítá průběžně."
                : "Cokoli můžeš opravit – výpočet se hned přepočítá."}
            </p>
            {ins.poznamka && <div className="muted">ℹ️ {ins.poznamka}</div>}

            <div className="mt">
              <div className="grid2">
                <label className="field">
                  <span>Typ nemovitosti</span>
                  <input
                    className="inp"
                    value={ins.typNemovitosti ?? ""}
                    placeholder="byt / dům / rekreační objekt"
                    onChange={(e) => updateIns("typNemovitosti", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Pojišťovna</span>
                  <input
                    className="inp"
                    value={ins.pojistovna ?? ""}
                    onChange={(e) => updateIns("pojistovna", e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span>Adresa nemovitosti</span>
                <AddressAutocomplete
                  value={ins.adresa ?? ""}
                  onChange={(v) => updateIns("adresa", v)}
                  placeholder="Začni psát ulici a město…"
                />
              </label>
              <div className="grid2">
                <label className="field">
                  <span>Obytná plocha (m²)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.obytnaPlocha ?? ""}
                    onChange={(e) => updateIns("obytnaPlocha", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Rok výstavby</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.rokVystavby ?? ""}
                    onChange={(e) => updateIns("rokVystavby", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Rok rekonstrukce</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.rokRekonstrukce ?? ""}
                    onChange={(e) => updateIns("rokRekonstrukce", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Spoluúčast</span>
                  <input
                    className="inp"
                    value={ins.spoluucast ?? ""}
                    placeholder='např. "1 %" nebo "5 000 Kč"'
                    onChange={(e) => updateIns("spoluucast", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Pojistná částka nemovitosti (Kč)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.pojistnaCastkaNemovitost ?? ""}
                    onChange={(e) => updateIns("pojistnaCastkaNemovitost", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Pojistná částka domácnosti (Kč)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.pojistnaCastkaDomacnost ?? ""}
                    onChange={(e) => updateIns("pojistnaCastkaDomacnost", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Roční pojistné (Kč)</span>
                  <input
                    className="inp"
                    inputMode="numeric"
                    value={ins.rocniPojistne ?? ""}
                    onChange={(e) => updateIns("rocniPojistne", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Datum sjednání</span>
                  <input
                    className="inp"
                    type="date"
                    value={ins.datumSjednani ?? ""}
                    onChange={(e) => updateIns("datumSjednani", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Poslední aktualizace smlouvy</span>
                  <input
                    className="inp"
                    type="date"
                    value={ins.datumAktualizace ?? ""}
                    onChange={(e) => updateIns("datumAktualizace", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Pojištěná rizika</span>
                  <input
                    className="inp"
                    value={ins.pojistenaRizika ?? ""}
                    onChange={(e) => updateIns("pojistenaRizika", e.target.value)}
                  />
                </label>
              </div>
            </div>

            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary mt" onClick={() => setStep("result")}>
              Vyhodnotit podpojištění →
            </button>
            <div className="center">
              <button className="btn btn-ghost" onClick={reset}>
                {manual ? "← Zpět" : "← Nahrát jiný dokument"}
              </button>
            </div>
          </>
        )}

        {/* KROK 3 – výsledek + lead */}
        {step === "result" && result && ins && (
          <>
            <div className="savings">
              <div className="label">🔒 Analýza pojištění je hotová</div>
              <div className="amount" style={{ fontSize: 40 }}>•••</div>
              <div className="sub">
                Vyplň formulář a hned uvidíš, jestli nejsi podpojištěný a o kolik bys přišel.
              </div>
            </div>

            <div className="mt" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
              <h3 style={{ marginTop: 0 }}>Chceš znát výsledek?</h3>
              <p className="muted" style={{ marginTop: -6 }}>
                Nech nám kontakt – výsledek uvidíš hned a poradce ti pojištění nezávazně projde.
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

              {error && <div className="err">{error}</div>}
              <button className="btn btn-good mt" disabled={sending} onClick={handleSendLead}>
                {sending ? "Odesílám…" : "Zobrazit výsledek →"}
              </button>
              <div className="center">
                <button className="btn btn-ghost" onClick={() => setStep("review")}>
                  ← Upravit údaje
                </button>
              </div>
            </div>
          </>
        )}

        {/* KROK 4 – odhalení výsledku */}
        {step === "done" && result && ins && (
          <>
            <div className="cover">
              <span className={"chip " + (result.maStavbu ? "on" : "off")}>
                {result.maStavbu ? "✓" : "✗"} Stavba
              </span>
              <span className={"chip " + (result.maDomacnost ? "on" : "off")}>
                {result.maDomacnost ? "✓" : "✗"} Domácnost
              </span>
            </div>

            <div className="savings">
              {result.maStavbu && result.podpojisteny && result.ztrataProKlienta && result.ztrataProKlienta > 0 ? (
                <>
                  <div className="label">⚠️ Jsi podpojištěný – při totální škodě bys přišel o</div>
                  <div className={"amount" + (result.ztrataProKlienta > 1 ? " red" : "")}>
                    {formatKc(result.ztrataProKlienta)}
                  </div>
                  <div className="sub">
                    pojišťovna by ti vyplatila jen {result.plneniProTotalniSkodu != null
                      ? formatKc(result.plneniProTotalniSkodu)
                      : "—"}{" "}
                    místo plné hodnoty
                  </div>
                  {krytiPct != null && (
                    <div className="badge warn">
                      Tvoje pojistná částka kryje jen {krytiPct} % hodnoty nemovitosti
                    </div>
                  )}
                </>
              ) : !result.maStavbu ? (
                <>
                  <div className="label">
                    {isByt
                      ? "Tvoje smlouva kryje domácnost, ne samotnou stavbu"
                      : "⚠️ Tvoje smlouva nekryje stavbu"}
                  </div>
                  <div className="amount" style={{ fontSize: 34 }}>
                    {result.maDomacnost ? "Jen domácnost" : "—"}
                  </div>
                  <div className="sub">
                    {isByt
                      ? "U bytu bývá stavba pojištěná přes SVJ – mrkni na doporučení níže."
                      : "Riziko: opravu budovy bys při škodě platil ze svého. Viz doporučení níže."}
                  </div>
                </>
              ) : result.soucasnaHodnota == null ? (
                <>
                  <div className="label">Kontrola pojištění stavby</div>
                  <div className="amount" style={{ fontSize: 34 }}>—</div>
                  <div className="sub">
                    Pro výpočet doplň prosím obytnou plochu nemovitosti.
                  </div>
                </>
              ) : (
                <>
                  <div className="label">Pojištění stavby odpovídá hodnotě</div>
                  <div className="amount">V pořádku ✅</div>
                  <div className="sub">
                    Pojistná částka kryje {krytiPct} % odhadované hodnoty – riziko krácení je nízké.
                  </div>
                </>
              )}
            </div>

            <div className="facts">
              <div className="fact">
                <div className="k">Odhad hodnoty stavby</div>
                <div className="v">
                  {result.soucasnaHodnota != null ? formatKc(result.soucasnaHodnota) : "—"}
                </div>
              </div>
              <div className="fact">
                <div className="k">Pojistná částka stavby</div>
                <div className="v">
                  {result.pojistnaCastka != null ? formatKc(result.pojistnaCastka) : "—"}
                </div>
              </div>
              <div className="fact">
                <div className="k">Krytí stavby</div>
                <div className="v">{krytiPct != null ? `${krytiPct} %` : "—"}</div>
              </div>
              <div className="fact">
                <div className="k">Plnění při totální škodě</div>
                <div className="v">
                  {result.plneniProTotalniSkodu != null
                    ? formatKc(result.plneniProTotalniSkodu)
                    : "—"}
                </div>
              </div>
              <div className="fact">
                <div className="k">Pojistná částka domácnosti</div>
                <div className="v">
                  {result.maDomacnost && result.domacnostCastka != null
                    ? formatKc(result.domacnostCastka)
                    : "Nepojištěno"}
                </div>
              </div>
            </div>

            {result.doporuceni.length > 0 && (
              <div className="recos">
                <div className="recos-title">💡 Doporučujeme doplnit</div>
                {result.doporuceni.map((d, i) => (
                  <div key={i} className="reco">
                    {d}
                  </div>
                ))}
              </div>
            )}

            <div className="center mt" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
              <div className="success-icon">✅</div>
              <p className="muted">{doneMsg}</p>
              <button className="btn btn-primary mt" onClick={reset}>
                Zkontrolovat další smlouvu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
