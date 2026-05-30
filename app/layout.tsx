import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bodlíkův finanční rentgen | Kontrola hypotéky, pojištění a majetku zdarma",
  description:
    "Nahrajte smlouvu a zjistěte, zda nepřeplácíte, nejste podpojištění nebo vám nechybí důležité krytí. Zdarma od Sjednej Finance.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
