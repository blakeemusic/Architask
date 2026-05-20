import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Architask",
  description:
    "Gestion de chantier pour PME d'architecture. UI premium fintech-grade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0B0B0F",
          colorText: "#0B0B0F",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#FFFFFF",
          colorInputText: "#0B0B0F",
          borderRadius: "16px",
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        },
        elements: {
          card: "shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-[28px]",
          formButtonPrimary:
            "bg-[var(--black)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all",
        },
      }}
    >
      <html
        lang="fr"
        className={`${inter.variable}`}
        suppressHydrationWarning
      >
        <body className="min-h-screen font-sans antialiased">
          <ThemeProvider>
            {children}
            <Toaster
              position="bottom-right"
              theme="system"
              toastOptions={{
                style: {
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  fontFamily:
                    "var(--font-inter), Inter, system-ui, sans-serif",
                },
              }}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
