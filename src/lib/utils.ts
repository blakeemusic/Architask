import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge clsx + tailwind-merge — la base de tous les composants UI. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Initiales d'un nom d'entité (entreprise, MOA, personne).
 * Ponctuation et caractères spéciaux ignorés.
 *
 * Exemples :
 *   "SAS Beton+"        → "SB"
 *   "Toits & Co"        → "TC"
 *   "Volt & Co"         → "VC"
 *   "Villa Robineau"    → "VR"
 *   "Atelier Habria"    → "AH"
 *   "Vitrol"            → "VI"  (un seul mot → 2 premières lettres)
 */
export function getInitials(name: string, max = 2): string {
  if (!name) return "?";
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, max).toUpperCase();
  return words
    .slice(0, max)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Index de palette stable (1..8) dérivé d'un seed.
 * Deux noms identiques donnent toujours le même index — utile pour
 * que la même entreprise garde son gradient à travers l'app.
 */
export function getLogoPalette(seed: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  if (!seed) return 1;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ((hash % 8) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}
