"use client";

import { useState } from "react";
import LoanCheck from "@/components/checks/LoanCheck";
import PropertyCheck from "@/components/checks/PropertyCheck";
import LifeCheck from "@/components/checks/LifeCheck";
import BodlikBadge from "@/components/BodlikBadge";

type Tab = "uver" | "nemovitost" | "zivot";

const TABS: { id: Tab; emoji: string; label: string; desc: string }[] = [
  { id: "uver", emoji: "💳", label: "Úvěr", desc: "Hypotéka & půjčky" },
  { id: "nemovitost", emoji: "🏠", label: "Nemovitost", desc: "Podpojištění" },
  { id: "zivot", emoji: "🛡️", label: "Životní pojištění", desc: "Krytí rizik" },
];

export default function BodlikuvRentgen() {
  const [tab, setTab] = useState<Tab>("uver");

  return (
    <div className="wrap rentgen">
      <div className="hero">
        <img className="brand-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />
        <h1>Bodlíkův rentgen</h1>
        <p>Prosvítíme tvoje smlouvy a ukážeme, kde zbytečně platíš víc.</p>
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

      <div className="embedded">
        {tab === "uver" && <LoanCheck />}
        {tab === "nemovitost" && <PropertyCheck />}
        {tab === "zivot" && <LifeCheck />}
      </div>

      <footer className="site-footer">
        <img className="footer-logo" src="/sjednej-logo-white.png" alt="Sjednej.cz" />
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
