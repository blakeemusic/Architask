"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wrapper next-themes — gère l'anti-flash dark mode en Next 16 / React 19
 * sans nécessiter de <script> inline dans le JSX (cf. erreur "Encountered
 * a script tag while rendering React component").
 *
 * Config :
 *  - attribute="data-theme"   → pose data-theme="dark|light" sur <html>
 *    (cohérent avec @custom-variant dark dans globals.css).
 *  - storageKey               → même clé que l'ancien ThemeToggle pour
 *    conserver les préférences déjà sauvegardées.
 *  - defaultTheme="light"     → light par défaut, pas de "system" pour
 *    coller au comportement actuel.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="architask-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
