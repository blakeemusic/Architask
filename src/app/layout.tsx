import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { THEME_INIT_SCRIPT } from "@/components/theme-toggle";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Architask — Design System",
  description:
    "Gestion de chantier pour PME d'architecture. UI premium fintech-grade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="light"
      className={`${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Restaure le theme depuis localStorage avant le premier paint
            pour éviter le flash blanc en dark mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
