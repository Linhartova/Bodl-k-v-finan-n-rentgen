"use client";

import { useMemo, useRef, useState } from "react";
import type { ExtractedLife, LifeResult, LifeLead } from "@/lib/zivot/types";
import { analyzeLife, formatKc } from "@/lib/zivot/calc";
import BodlikBadge from "@/components/BodlikBadge";
import PhoneField, { formatPhone, VYCHOZI_PREDVOLBA } from "@/components/PhoneField";

type Step = "upload" | "extracting" | "review" | "result" | "done";

// Všechna číselná pole (pro převod stringu z inputu na number | null).
const NUM_KEYS: (keyof ExtractedLife)[] = [
  "mesicniPojistne",
  "vek",
  "smrtJakakolivPricina",
  "smrtUrazem",
  "invalidita1",
  "invalidita2",
  "invalidita3",
  "zavazneNemociCastka",
  "pracovniNeschopnostDenniDavka",
  "hospitalizaceDenniDavka",
  "trvaleNasledkyCastka",
  "invaliditaUrazCastka",
  "sporiciSlozka",
  "rocniPrijem",
  "dluhy",
];

// Boolean pole (rendrují se jako select ano/ne/—).
const BOOL_KEYS: (keyof ExtractedLife)[] = [
  "invaliditaOd1",
  "osetrovaniClena",
  "pripojisteniDeti",
];

const EMPTY: ExtractedLife = {
  mesicniPojistne: null,
  pojistovna: null,
  nazevProduktu: null,
  datumSjednani: null,
  dobaTrvani: null,
  datumKonce: null,
  pojisteneOsoby: null,
  vek: null,
  kurak: null,
  smrtJakakolivPricina: null,
  smrtUrazem: null,
  invalidita1: null,
  invalidita2: null,
  invalidita3: null,
  invaliditaOd1: null,
  zavazneNemociCastka: null,
  zavazneNemociRozsah: null,
  pracovniNeschopnostDenniDavka: null,
  pracovniNeschopnostKarence: null,
  hospitalizaceDenniDavka: null,
  trvaleNasledkyCastka: null,
  trvaleNasledkyProgrese: null,
  invaliditaUrazCastka: null,
  osetrovaniClena: null,
  typPojisteni: null,
  sporiciSlozka: null,
  mimoradnePoplatky: null,
  pripojisteniDeti: null,
  vyluky: null,
  jePojistnaSmlouva: true,
  poznamka: null,
  rocniPrijem: null,
  dluhy: null,
};

export default function LifeCheck() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [life, setLife] = useState<ExtractedLife | null>(null);
  const [form, setForm] = useState({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string>("");
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result: LifeResult | null = useMemo(
    () => (life ? analyzeLife(life) : null),
    [life]
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
      const res = await fetch("/api/zivot/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nepodařilo se zpracovat dokument.");
      if (!json.life?.jePojistnaSmlouva) {
        setError(
          "Dokument se nepodařilo rozpoznat jako smlouvu o životním pojištění. Zkontroluj prosím údaje níže ručně."
        );
      }
      setLife(json.life as ExtractedLife);
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
    setLife({ ...EMPTY });
    setStep("review");
  }

  function updateLife<K extends keyof ExtractedLife>(key: K, raw: string) {
    setLife((prev) => {
      if (!prev) return prev;
      let value: any = raw;
      if (NUM_KEYS.includes(key)) {
        const n = Number(raw.replace(/\s/g, "").replace(",", "."));
        value = raw === "" ? null : Number.isFinite(n) ? n : prev[key];
      } else if (BOOL_KEYS.includes(key)) {
        value = raw === "" ? null : raw === "ano";
      } else if (raw === "") {
        value = null;
      }
      return { ...prev, [key]: value };
    });
  }

  async function handleSendLead() {
    if (!life || !result) return;
    setError(null);
    if (form.jmeno.trim().length < 2) return setError("Vyplň prosím jméno.");
    if (!form.email && !form.telefon) return setError("Vyplň e-mail nebo telefon.");
    setSending(true);
    try {
      const payload: LifeLead = {
        jmeno: form.jmeno,
        email: form.email,
        telefon: formatPhone(form.predvolba, form.telefon),
        life,
        result,
      };
      const res = await fetch("/api/zivot/lead", {
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
    setLife(null);
    setForm({ jmeno: "", email: "", telefon: "", predvolba: VYCHOZI_PREDVOLBA });
    setError(null);
    setManual(false);
  }

  const stepIndex = { upload: 0, extracting: 0, review: 1, result: 2, done: 3 }[step];

  // Pomocné renderery polí – ať formulář není přebujelý.
  const txt = (key: keyof ExtractedLife, label: string, placeholder?: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="inp"
        value={(life?.[key] as any) ?? ""}
        placeholder={placeholder}
        onChange={(e) => updateLife(key, e.target.value)}
      />
    </label>
  );
  const number = (key: keyof ExtractedLife, label: string, placeholder?: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="inp"
        inputMode="numeric"
        value={(life?.[key] as any) ?? ""}
        placeholder={placeholder}
        onChange={(e) => updateLife(key, e.target.value)}
      />
    </label>
  );
  const yesno = (key: keyof ExtractedLife, label: string) => {
    const v = life?.[key];
    return (
      <label className="field">
        <span>{label}</span>
        <select
          className="inp"
          value={v == null ? "" : v ? "ano" : "ne"}
          onChange={(e) => updateLife(key, e.target.value)}
        >
          <option value="">—</option>
          <option value="ano">ano</option>
          <option value="ne">ne</option>
        </select>
      </label>
    );
  };
  const sekce = (t: string) => (
    <div
      className="mt"
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 12,
        marginBottom: 4,
        fontWeight: 700,
      }}
    >
      {t}
    </div>
  );

  return (
    <div className="wrap">
      <BodlikBadge />
      <div className="hero">
        <img className="brand-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />

        <h1>Máš životní pojištění nastavené správně?</h1>
        <p>Nahraj smlouvu a zjisti, jestli nejsi podpojištěný nebo zbytečně nepřeplácíš.</p>
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
              <div className="icon">🛡️</div>
              <h3>Nahraj smlouvu o životním pojištění</h3>
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
            <p className="muted">Vytahuju pojistné částky, rizika a parametry produktu.</p>
          </div>
        )}

        {/* KROK 2 – kontrola dat */}
        {step === "review" && life && (
          <>
            <h3 style={{ marginTop: 0 }}>
              {manual ? "Zadej údaje o pojištění" : "Zkontroluj vytažené údaje"}
            </h3>
            <p className="muted" style={{ marginTop: -6 }}>
              Cokoli můžeš opravit – výpočet se hned přepočítá. Co nevíš, nech prázdné.
            </p>
            {life.poznamka && <div className="muted">ℹ️ {life.poznamka}</div>}

            <div className="mt">
              {sekce("Smlouva")}
              <div className="grid2">
                {txt("pojistovna", "Pojišťovna")}
                {txt("nazevProduktu", "Název produktu")}
              </div>
              <div className="grid2">
                {number("mesicniPojistne", "Měsíční pojistné (Kč)")}
                {txt("dobaTrvani", "Doba trvání", 'např. "do 65 let"')}
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Datum sjednání</span>
                  <input
                    className="inp"
                    type="date"
                    value={life.datumSjednani ?? ""}
                    onChange={(e) => updateLife("datumSjednani", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Konec pojištění</span>
                  <input
                    className="inp"
                    type="date"
                    value={life.datumKonce ?? ""}
                    onChange={(e) => updateLife("datumKonce", e.target.value)}
                  />
                </label>
              </div>
              <div className="grid2">
                {txt("pojisteneOsoby", "Pojištěné osoby")}
                {number("vek", "Věk pojištěného")}
              </div>
              <div className="grid2">{txt("kurak", "Kuřák / nekuřák", "nekuřák")}</div>

              {sekce("Smrt")}
              <div className="grid2">
                {number("smrtJakakolivPricina", "Smrt z jakékoliv příčiny (Kč)")}
                {number("smrtUrazem", "Smrt úrazem (Kč)")}
              </div>

              {sekce("Invalidita")}
              <div className="grid2">
                {number("invalidita1", "Invalidita 1. stupně (Kč)")}
                {number("invalidita2", "Invalidita 2. stupně (Kč)")}
              </div>
              <div className="grid2">
                {number("invalidita3", "Invalidita 3. stupně (Kč)")}
                {yesno("invaliditaOd1", "Krytí už od 1. stupně?")}
              </div>
              <div className="grid2">
                {number("invaliditaUrazCastka", "Invalidita následkem úrazu (Kč)")}
              </div>

              {sekce("Závažná onemocnění")}
              <div className="grid2">
                {number("zavazneNemociCastka", "Pojistná částka (Kč)")}
                {txt("zavazneNemociRozsah", "Rozsah diagnóz")}
              </div>

              {sekce("Pracovní neschopnost a hospitalizace")}
              <div className="grid2">
                {number("pracovniNeschopnostDenniDavka", "Prac. neschopnost – denní dávka (Kč)")}
                {txt("pracovniNeschopnostKarence", "Karenční doba", 'např. "od 29. dne"')}
              </div>
              <div className="grid2">
                {number("hospitalizaceDenniDavka", "Hospitalizace – denní dávka (Kč)")}
              </div>

              {sekce("Úraz")}
              <div className="grid2">
                {number("trvaleNasledkyCastka", "Trvalé následky úrazu (Kč)")}
                {txt("trvaleNasledkyProgrese", "Progrese", "až 500 %")}
              </div>

              {sekce("Parametry produktu")}
              <div className="grid2">
                {txt("typPojisteni", "Typ pojištění", "investiční / rizikové / kapitálové")}
                {number("sporiciSlozka", "Spořicí složka (Kč/měs)")}
              </div>
              <div className="grid2">
                {yesno("osetrovaniClena", "Ošetřování člena rodiny?")}
                {yesno("pripojisteniDeti", "Připojištění dětí?")}
              </div>
              {txt("mimoradnePoplatky", "Mimořádné poplatky")}
              {txt("vyluky", "Výluky")}

              {sekce("Personalizace (nepovinné)")}
              <p className="muted" style={{ marginTop: 0 }}>
                Doplň pro přesnější doporučené krytí na míru tvé situaci.
              </p>
              <div className="grid2">
                {number("rocniPrijem", "Čistý roční příjem (Kč)", "např. 600 000")}
                {number("dluhy", "Dluhy / hypotéka (Kč)", "např. 2 500 000")}
              </div>
            </div>

            {error && <div className="err">{error}</div>}
            <button className="btn btn-primary mt" onClick={() => setStep("result")}>
              Vyhodnotit pojištění →
            </button>
            <div className="center">
              <button className="btn btn-ghost" onClick={reset}>
                {manual ? "← Zpět" : "← Nahrát jiný dokument"}
              </button>
            </div>
          </>
        )}

        {/* KROK 3 – výsledek + lead */}
        {step === "result" && result && life && (
          <>
            <div className="savings">
              <div className="label">🔒 Analýza životního pojištění je hotová</div>
              <div className="amount" style={{ fontSize: 40 }}>•••</div>
              <div className="sub">
                Vyplň formulář a hned uvidíš, kde máš mezeru v krytí a kolik můžeš ušetřit.
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
        {step === "done" && result && life && (
          <>
            <div className="savings">
              {result.celkovaMezera > 0 ? (
                <>
                  <div className="label">⚠️ V krytí klíčových rizik ti chybí</div>
                  <div className={"amount" + (result.celkovaMezera > 1 ? " red" : "")}>
                    {formatKc(result.celkovaMezera)}
                  </div>
                  <div className="sub">
                    {result.chybiInvalidita
                      ? "nemáš sjednanou invaliditu 3. stupně – nejvážnější opomíjené riziko"
                      : "tvé krytí je nižší než doporučení pro tvoji situaci"}
                  </div>
                  {result.jeInvesticni && result.odhadUsporaPojistne ? (
                    <div className="badge warn">
                      💸 Navíc přeplácíš ~{formatKc(result.odhadUsporaPojistne)} ročně za investiční složku
                    </div>
                  ) : null}
                </>
              ) : result.jeInvesticni && result.odhadUsporaPojistne ? (
                <>
                  <div className="label">Můžeš ušetřit na pojistném</div>
                  <div className={"amount" + (result.odhadUsporaPojistne > 1 ? " red" : "")}>
                    ~{formatKc(result.odhadUsporaPojistne)}
                  </div>
                  <div className="sub">
                    ročně přechodem z investičního na čistě rizikové pojištění – krytí zůstane stejné
                  </div>
                </>
              ) : (
                <>
                  <div className="label">Tvoje životní pojištění</div>
                  <div className="amount">V pořádku ✅</div>
                  <div className="sub">
                    Krytí klíčových rizik odpovídá doporučení a neplatíš zbytečně navíc.
                  </div>
                </>
              )}
            </div>

            <div className="facts">
              <div className="fact">
                <div className="k">Smrt (jakákoliv příčina)</div>
                <div className="v">
                  {life.smrtJakakolivPricina != null ? formatKc(life.smrtJakakolivPricina) : "—"}
                </div>
              </div>
              <div className="fact">
                <div className="k">Doporučeno smrt</div>
                <div className="v">{formatKc(result.doporucenaSmrt)}</div>
              </div>
              <div className="fact">
                <div className="k">Invalidita 3. stupně</div>
                <div className="v">
                  {life.invalidita3 != null ? formatKc(life.invalidita3) : "chybí"}
                </div>
              </div>
              <div className="fact">
                <div className="k">Doporučeno invalidita</div>
                <div className="v">{formatKc(result.doporucenaInvalidita)}</div>
              </div>
            </div>

            {result.predpoklady.length > 0 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
                {result.predpoklady.map((p, i) => (
                  <div key={i}>• {p}</div>
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
