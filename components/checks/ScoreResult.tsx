"use client";

import type { ScoreResult } from "@/lib/score";
import { pasmoSkore, formatKc } from "@/lib/score";

// Společný výstup analýzy: Bodlíkovo finanční skóre + spící peníze + rizika
// + doporučení + CTA na konzultaci. Sdílí ho úvěr, nemovitost i životní pojištění.
export default function ScoreResultView({
  score,
  doneMsg,
  onReset,
}: {
  score: ScoreResult;
  doneMsg: string;
  onReset: () => void;
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

      {/* Potvrzení + konzultace */}
      <div className="consult">
        <div className="success-icon">✅</div>
        <p className="muted" style={{ marginTop: 0 }}>
          {doneMsg}
        </p>
        <a className="btn btn-good" href="tel:+420800100100">
          Chci bezplatnou konzultaci
        </a>
        <a
          className="btn btn-outline mt"
          href="https://www.sjednej.cz/kontakt"
          target="_blank"
          rel="noopener noreferrer"
        >
          Nechat zavolat specialistou
        </a>
        <div className="center">
          <button className="btn btn-ghost" onClick={onReset}>
            Zkontrolovat další smlouvu
          </button>
        </div>
      </div>
    </div>
  );
}
