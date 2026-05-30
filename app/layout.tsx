import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bodlíkův rentgen – prosvítíme tvoje smlouvy",
  description:
    "Úvěr, pojištění nemovitosti i životní pojištění na jednom místě. Nahraj smlouvu a zjisti, kde zbytečně platíš víc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
