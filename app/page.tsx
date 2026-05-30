"use client";

import { useState } from "react";
import LoanCheck from "@/components/checks/LoanCheck";
import PropertyCheck from "@/components/checks/PropertyCheck";
import LifeCheck from "@/components/checks/LifeCheck";
import BodlikBadge from "@/components/BodlikBadge";

type Tab = "uver" | "nemovitost" | "zivot";

const TABS: { id: Tab; emoji: string; label: string; desc: string; motiv: string }[] = [
  {
    id: "uver",
    emoji: "💳",
    label: "Hypotéka",
    desc: "Úvěr & půjčky",
    motiv: "Možná platíte vyšší úrok, než musíte.",
  },
  {
    id: "nemovitost",
    emoji: "🏠",
    label: "Nemovitost",
    desc: "Podpojištění",
    motiv: "8 z 10 nemovitostí je dnes podpojištěných.",
  },
  {
    id: "zivot",
    emoji: "🛡️",
    label: "Životní pojištění",
    desc: "Krytí rizik",
    motiv: "Mnoho lidí zjistí problém až ve chvíli, kdy potřebují plnění.",
  },
];

const KROKY = [
  { ikona: "📄", titulek: "Nahrajete smlouvu", text: "PDF nebo fotka stačí." },
  { ikona: "🦔", titulek: "Bodlík ji analyzuje", text: "Projde sazby, krytí i rizika." },
  { ikona: "📊", titulek: "Zobrazíme rizika a úspory", text: "Finanční skóre na míru." },
  { ikona: "🤝", titulek: "Poradce navrhne řešení", text: "Pokud budete chtít." },
];

export default function BodlikuvRentgen() {
  const [tab, setTab] = useState<Tab>("uver");
  const aktivni = TABS.find((t) => t.id === tab)!;

  return (
    <div className="wrap rentgen">
      <div className="hero">
        <img className="brand-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />
        <h1>Najdeme vám během 2 minut, kde můžete ušetřit tisíce korun ročně.</h1>
        <p>
          Nahrajte smlouvu a Bodlík zdarma zkontroluje, zda nepřeplácíte, nejste podpojištění
          nebo vám nehrozí zbytečná rizika.
        </p>
        <div className="hero-perks">
          <span>✓ Zdarma</span>
          <span>✓ Výsledek během několika minut</span>
          <span>✓ Bez závazků</span>
        </div>
        <BodlikBadge />
      </div>

      <div className="rentgen-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"rentgen-tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
            type="button"
          >
            <span className="rentgen-tab-emoji">{t.emoji}</span>
            <span className="rentgen-tab-label">{t.label}</span>
            <span className="rentgen-tab-desc">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Motivace pro vybraný produkt */}
      <div className="product-motiv">💬 {aktivni.motiv}</div>

      <div className="embedded">
        {tab === "uver" && <LoanCheck />}
        {tab === "nemovitost" && <PropertyCheck />}
        {tab === "zivot" && <LifeCheck />}
      </div>

      {/* Důvěra – statistiky */}
      <section className="trust">
        <div className="trust-card">
          <div className="trust-num">500–2 500 Kč</div>
          <div className="trust-text">
            Klienti díky kontrole smluv nejčastěji ušetří <strong>měsíčně</strong>.
          </div>
        </div>
        <div className="trust-card">
          <div className="trust-num">Nejde jen o cenu</div>
          <div className="trust-text">
            Často odhalíme <strong>podpojištění</strong> nebo chybějící krytí důležitých rizik.
          </div>
        </div>
      </section>

      {/* Jak to funguje */}
      <section className="how">
        <h2>Jak funguje Bodlíkův finanční rentgen?</h2>
        <div className="how-grid">
          {KROKY.map((k, i) => (
            <div key={i} className="how-card">
              <div className="how-num">{i + 1}</div>
              <div className="how-ikona">{k.ikona}</div>
              <div className="how-titulek">{k.titulek}</div>
              <div className="how-text">{k.text}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <img className="footer-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />
        <div className="footer-trust">
          <strong>Sjednej Finance</strong> – licencovaný finanční zprostředkovatel
        </div>
        <div className="footer-privacy">
          Vaše dokumenty používáme pouze pro účely analýzy a neposkytujeme je třetím stranám.
        </div>
        <nav className="footer-links">
          <a href="https://www.sjednej.cz/" target="_blank" rel="noopener noreferrer">
            Sjednej.cz
          </a>
          <a
            href="https://www.sjednej.cz/ochrana-osobnich-udaju"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ochrana osobních údajů (GDPR)
          </a>
          <a
            href="https://www.sjednej.cz/obchodni-podminky"
            target="_blank"
            rel="noopener noreferrer"
          >
            Obchodní podmínky
          </a>
        </nav>
        <div className="footer-copy">© {new Date().getFullYear()} Sjednej.cz</div>
      </footer>
    </div>
  );
}
