"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

// Našeptávač adres – volá /api/address-suggest (debounce 250 ms), nabízí dropdown.
// Hodnota je plně řízená rodičem; výběr i psaní volají onChange.
export default function AddressAutocomplete({ value, onChange, placeholder }: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const interacted = useRef(false); // nefetchuj, dokud uživatel nezačne psát
  const skipNext = useRef(false); // po výběru přeskoč jeden fetch
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interacted.current) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        const labels: string[] = (json.suggestions || []).map((s: any) => s.label);
        setItems(labels);
        setOpen(labels.length > 0);
        setHi(-1);
      } catch {
        /* ignore (přerušený/selhal request) */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // zavři dropdown při kliknutí mimo
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(label: string) {
    interacted.current = true;
    skipNext.current = true;
    onChange(label);
    setItems([]);
    setOpen(false);
    setHi(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && hi >= 0) {
      e.preventDefault();
      select(items[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="ac-wrap" ref={boxRef}>
      <input
        className="inp"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          interacted.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 && (
        <ul className="ac-list">
          {items.map((it, i) => (
            <li
              key={it}
              className={"ac-item" + (i === hi ? " hi" : "")}
              onMouseDown={(e) => {
                e.preventDefault();
                select(it);
              }}
              onMouseEnter={() => setHi(i)}
            >
              📍 {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
