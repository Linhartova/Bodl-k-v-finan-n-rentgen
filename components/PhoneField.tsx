"use client";

// Sdílené telefonní pole s výběrem předvolby (úvěr i obě pojištění).
// Předvolby: CZ/SK první, pak okolní země.
export const PREDVOLBY = [
  { code: "+420", flag: "🇨🇿" },
  { code: "+421", flag: "🇸🇰" },
  { code: "+43", flag: "🇦🇹" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+48", flag: "🇵🇱" },
  { code: "+36", flag: "🇭🇺" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+1", flag: "🇺🇸" },
];

// Výchozí předvolba pro inicializaci / reset formuláře.
export const VYCHOZI_PREDVOLBA = "+420";

// Složí předvolbu a číslo do jednoho řetězce ("+420 777 123 456");
// vrátí prázdný řetězec, když uživatel číslo nezadal.
export function formatPhone(predvolba: string, telefon: string): string {
  return telefon.trim() ? `${predvolba} ${telefon.trim()}` : "";
}

interface PhoneFieldProps {
  predvolba: string;
  telefon: string;
  onPredvolbaChange: (value: string) => void;
  onTelefonChange: (value: string) => void;
}

export default function PhoneField({
  predvolba,
  telefon,
  onPredvolbaChange,
  onTelefonChange,
}: PhoneFieldProps) {
  return (
    <label className="field">
      <span>Telefon</span>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          className="inp"
          style={{ flex: "0 0 96px" }}
          value={predvolba}
          onChange={(e) => onPredvolbaChange(e.target.value)}
        >
          {PREDVOLBY.map((p) => (
            <option key={p.code} value={p.code}>
              {p.flag} {p.code}
            </option>
          ))}
        </select>
        <input
          className="inp"
          style={{ flex: 1, minWidth: 0 }}
          inputMode="tel"
          value={telefon}
          onChange={(e) => onTelefonChange(e.target.value)}
          placeholder="777 123 456"
        />
      </div>
    </label>
  );
}
