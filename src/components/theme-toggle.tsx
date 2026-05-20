"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * ThemeToggle — bouton dark/light branché sur next-themes.
 *
 * next-themes pose le bon data-theme sur <html> AVANT le premier paint
 * (script généré par <ThemeProvider>), ce qui supprime tout flash blanc.
 * On garde `data-theme` comme attribut pour rester compatible avec
 * @custom-variant dark dans globals.css.
 */
// Lecture de data-theme côté client via useSyncExternalStore : aligne le
// bouton sur ce que next-themes a posé sur <html> avant l'hydratation,
// sans `setState` dans un useEffect (interdit par les règles React 19).
const subscribe = (cb: () => void) => {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
};
const getSnapshot = (): "light" | "dark" =>
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
const getServerSnapshot = (): "light" | "dark" => "light";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="light"
      size="sm"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"
      }
      leftIcon={
        theme === "dark" ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )
      }
    >
      {theme === "dark" ? "Sombre" : "Clair"}
    </Button>
  );
}
