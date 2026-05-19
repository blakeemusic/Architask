/**
 * Helpers de formatage (FR) pour les montants, pourcentages et dates.
 *
 * Convention :
 *  - formatMoney(value) : adaptatif (auto-condensation pour KPI big bold)
 *  - formatMoneyFull(value) : toujours la valeur complète (tableaux financiers)
 *  - formatPct(value) : "62 %", "100 %"
 *  - formatDateFr(date) : "15 mai 2026"
 *  - formatDateShort(date) : "15/05/26"
 *  - formatMonthShort(date) : "Mai 26"
 */

const FR_NUMBER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const FR_NUMBER_2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Montant adaptatif pour les KPI hero (big bold).
 * < 1k          → "850 €"
 * < 10k         → "8,5 k€"     (1 décimale)
 * < 100k        → "85 k€"      (entier)
 * < 1M          → "850 k€"
 * < 10M         → "2,01 M€"    (2 décimales)
 * >= 10M        → "12 M€"
 */
export function formatMoneyCompact(value: number | string | null | undefined): {
  display: string;
  unit: string;
} {
  const n = toNumber(value);
  if (n === null) return { display: "—", unit: "" };
  const abs = Math.abs(n);

  if (abs < 1_000) {
    return { display: FR_NUMBER.format(n), unit: "€" };
  }
  if (abs < 10_000) {
    const v = (n / 1_000).toFixed(1).replace(".", ",");
    return { display: v, unit: "k€" };
  }
  if (abs < 1_000_000) {
    return { display: FR_NUMBER.format(Math.round(n / 1_000)), unit: "k€" };
  }
  if (abs < 10_000_000) {
    const v = (n / 1_000_000).toFixed(2).replace(".", ",");
    return { display: v, unit: "M€" };
  }
  const v = (n / 1_000_000).toFixed(1).replace(".", ",");
  return { display: v, unit: "M€" };
}

/** Version "tout-en-un" si tu veux une string déjà concaténée. */
export function formatMoneyCompactString(
  value: number | string | null | undefined,
): string {
  const { display, unit } = formatMoneyCompact(value);
  return unit ? `${display} ${unit}` : display;
}

/** Montant complet : "1 234 567 €" (utilisé dans les tableaux). */
export function formatMoneyFull(
  value: number | string | null | undefined,
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${FR_NUMBER.format(Math.round(n))} €`;
}

/** Montant avec 2 décimales : "1 234 567,89 €". */
export function formatMoneyExact(
  value: number | string | null | undefined,
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${FR_NUMBER_2.format(n)} €`;
}

/**
 * Variante pour les PDF générés par @react-pdf/renderer.
 *
 * Bug @react-pdf/renderer : la police par défaut (Helvetica) ne sait pas
 * rendre U+202F (narrow no-break space) que Intl.NumberFormat('fr-FR')
 * insère comme séparateur de milliers — résultat : "149/120,00€" au lieu
 * de "149 120,00 €". On remplace U+00A0 et U+202F par un espace ASCII
 * U+0020 (que Helvetica sait rendre).
 *
 * À utiliser UNIQUEMENT dans les templates PDF. Côté UI web,
 * formatMoneyFull/Exact sont OK (Chrome/Safari rendent correctement le
 * narrow no-break space).
 *
 * Par défaut : 2 décimales, sans la devise "€" (le caller la concatène
 * lui-même pour rester flexible sur le rendu Text dans @react-pdf).
 */
export function formatMoneyForPdf(
  value: number | string | null | undefined,
  options: { decimals?: 0 | 2; withCurrency?: boolean } = {},
): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const decimals = options.decimals ?? 2;

  // Formatage 100 % manuel — aucun appel à Intl.NumberFormat (qui insère
  // des caractères Unicode invisibles non rendus par Helvetica).
  // Caractères utilisés : chiffres ASCII, virgule décimale, espace ASCII
  // U+0020 comme séparateur de milliers. Garanti compatible PDF.
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const intWithSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formatted = decimals === 0
    ? intWithSpaces
    : `${intWithSpaces},${decPart}`;
  return options.withCurrency
    ? `${sign}${formatted} €`
    : `${sign}${formatted}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)} %`;
}

export function formatDateFr(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatMonthShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

/**
 * Labels en français pour les enums Postgres "techniques".
 */
export const OPERATION_STATUS_LABEL: Record<string, string> = {
  en_preparation: "En préparation",
  signe: "Signée",
  en_execution: "En cours",
  en_reception: "En réception",
  dgd: "DGD",
  clos: "Clos",
};

export const LOT_STATUS_LABEL: Record<string, string> = {
  en_preparation: "Brouillon",
  signe: "Signé",
  en_execution: "En cours",
  en_reception: "En réception",
  solde: "Soldé",
};

export const AVENANT_STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  a_signer: "À signer",
  signe: "Signé",
};

// ---------------------------------------------------------------
// Internals
// ---------------------------------------------------------------

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}
