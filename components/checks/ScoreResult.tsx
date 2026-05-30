"use client";

import { useState } from "react";
import type { ScoreResult } from "@/lib/score";
import { pasmoSkore, formatKc } from "@/lib/score";

// Společný výstup analýzy: Bodlíkovo finanční skóre + spící peníze + rizika
// + doporučení + formulář pro bezplatnou konzultaci.
// Sdílí ho úvěr, nemovitost i životní pojištění.
export default function ScoreResultView({
  score,
  doneMsg,
  onReset,
  kontakt,
}: {
  score: ScoreResult;
  doneMsg: string;
  onReset: () => void;
  // Předvyplnění z lead formu (jméno + telefon/e-mail), ať klient nepíše dvakrát.
  kontakt?: { jmeno?: string; email?: string; telefon?: string };
}) {
  const pasmo = pasmoSkore(score.score);
  const pasmoLabel = pasmo === "good" ? "Dobré" : pasmo === "warn" ? "Co zlepšit" : "Pozor";

  // Headline "spící peníze": roční úspora, jinak riziková částka (mezera/ztráta).
  const headline = score.rocniUspora > 0 ? score.rocniUspora : score.rizikoCastka;
  const headlineJeUspora = score.rocniUspora > 0;

  // Kruhový ukazatel skóre (SVG).
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (score.score / 100) * C;

  // --- Formulář konzultace ---
  const [form, setForm] = useState({
    jmeno: kontakt?.jmeno ?? "",
    email: kontakt?.email ?? "",
    telefon: kontakt?.telefon ?? "",
    termin: "Kdykoliv",
    zprava: "",
  });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function odeslat() {
    setErr(null);
    if (form.jmeno.trim().length < 2) return setErr("Vyplň prosím jméno.");
    if (!form.telefon && !form.email) return setErr("Vyplň prosím telefon nebo e-mail.");
    setSending(true);
    try {
      const res = await fetch("/api/konzultace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, produkt: score.produkt }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Nepodařilo se odeslat.");
      setSent(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="result-view">
      {/* Finanční skóre */}
      <div className="score-block">
        <div className={"score-ring score-" + pasmo}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r={R} className="score-track" />
            <circle
              cx="60"
              cy="60"
              r={R}
              className="score-fill"
              strokeDasharray={`${dash} ${C - dash}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="score-num">
            <strong>{score.score}</strong>
            <span>/ 100</span>
          </div>
        </div>
        <div className="score-meta">
          <div className="score-title">Bodlíkovo finanční skóre</div>
          <div className={"score-badge score-" + pasmo}>{pasmoLabel}</div>
        </div>
      </div>

      {/* Spící peníze – největší font na stránce */}
      {headline > 0 && (
        <div className="sleeping">
          <div className="sleeping-label">💰 Našli jsme tvoje spící peníze</div>
          <div className="sleeping-amount">{formatKc(headline)}</div>
          <div className="sleeping-sub">
            {headlineJeUspora
              ? "Pokud bys doporučení zrealizoval, můžeš tuto částku získat zpět každý rok."
              : "Tolik aktuálně riskuješ kvůli chybějícímu krytí. Poradce ti pomůže to dorovnat."}
          </div>
          {score.mesicniUspora > 0 && (
            <div className="sleeping-grid">
              <div>
                <div className="sg-k">Měsíčně</div>
                <div className="sg-v">{formatKc(score.mesicniUspora)}</div>
              </div>
              <div>
                <div className="sg-k">Ročně</div>
                <div className="sg-v">{formatKc(score.rocniUspora)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hlavní rizika */}
      {score.risks.length > 0 && (
        <div className="risks">
          {score.risks.map((r, i) => (
            <div key={i} className={"risk risk-" + r.level}>
              <span className="risk-dot">
                {r.level === "good" ? "🟢" : r.level === "warn" ? "🟠" : "🔴"}
              </span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Doporučení */}
      {score.doporuceni.length > 0 && (
        <div className="recos">
          <div className="recos-title">💡 Doporučení Bodlíka</div>
          {score.doporuceni.map((d, i) => (
            <div key={i} className="reco">
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Konzultace – formulář */}
      <div className="consult">
        {sent ? (
          <div className="center">
            <div className="success-icon">✅</div>
            <h3 style={{ marginTop: 0 }}>Děkujeme!</h3>
            <p className="muted">
              Specialista Sjednej Finance se ti ozve v preferovaném čase a doporučení projde zdarma.
            </p>
            <button className="btn btn-ghost" onClick={onReset}>
              Zkontrolovat další smlouvu
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>Chci bezplatnou konzultaci</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              Specialista ti doporučení nezávazně projde a navrhne řešení na míru.
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
                <span>Telefon</span>
                <input
                  className="inp"
                  inputMode="tel"
                  value={form.telefon}
                  onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  placeholder="+420 777 123 456"
                />
              </label>
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
            </div>
            <label className="field">
              <span>Kdy se ti hodí zavolat?</span>
              <select
                className="inp"
                value={form.termin}
                onChange={(e) => setForm({ ...form, termin: e.target.value })}
              >
                <option>Kdykoliv</option>
                <option>Dopoledne (9–12)</option>
                <option>Odpoledne (12–17)</option>
                <option>Podvečer (17–20)</option>
              </select>
            </label>
            <label className="field">
              <span>Zpráva (nepovinné)</span>
              <input
                className="inp"
                value={form.zprava}
                onChange={(e) => setForm({ ...form, zprava: e.target.value })}
                placeholder="Na co se chceš zeptat?"
              />
            </label>

            {err && <div className="err">{err}</div>}
            <button className="btn btn-good mt" disabled={sending} onClick={odeslat}>
              {sending ? "Odesílám…" : "Chci bezplatnou konzultaci"}
            </button>
            <div className="center">
              <button className="btn btn-ghost" onClick={onReset}>
                Zkontrolovat další smlouvu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
