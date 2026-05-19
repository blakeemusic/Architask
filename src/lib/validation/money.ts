import { Decimal } from "decimal.js";

/**
 * Arithmétique financière sans float drift.
 *
 * Convention NF P03-001 :
 *   - Tous les montants à 2 décimales.
 *   - Arrondi au **centime supérieur** (jamais inférieur).
 *
 * On utilise decimal.js pour éviter les imprécisions JS (ex. 0.1 + 0.2 ≠ 0.3).
 * En entrée : string (format Drizzle numeric) ou number ou Decimal.
 * En sortie : Decimal (à formater pour l'affichage avec formatMoney()).
 */

export type Money = Decimal;
export type MoneyInput = string | number | Decimal;

/** Convertit un input en Decimal. Lance si invalide. */
export function toMoney(input: MoneyInput): Money {
  if (input instanceof Decimal) return input;
  const d = new Decimal(input);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error(`Montant invalide : ${input}`);
  }
  return d;
}

/**
 * Arrondi au centime supérieur (ceil 2 décimales).
 * Ex: 64.3812 → 64.39, 64.3800 → 64.38, 64.3801 → 64.39.
 *
 * Decimal.ROUND_UP arrondit toujours vers l'extérieur de zéro :
 * pour 12.345 → 12.35, pour −12.345 → −12.35. Pour respecter la
 * convention "centime supérieur" (toujours vers +∞), on utilise
 * ROUND_CEIL qui arrondit toujours vers +∞.
 */
export function ceilToCent(input: MoneyInput): Money {
  return toMoney(input).toDecimalPlaces(2, Decimal.ROUND_CEIL);
}

/** Somme une liste de montants — résultat arrondi au centime supérieur. */
export function sumMoney(amounts: MoneyInput[]): Money {
  return amounts.reduce<Money>(
    (acc, n) => acc.plus(toMoney(n)),
    new Decimal(0),
  );
}

/** Test d'égalité avec tolérance d'un centime (pour comparaisons financières). */
export function eqWithinCent(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).minus(toMoney(b)).abs().lte("0.01");
}

/**
 * Formate un montant en français (1 234,56 €). N'arrondit pas — l'appelant
 * doit avoir appelé ceilToCent au préalable s'il veut le bon arrondi.
 */
export function formatMoney(input: MoneyInput, withSymbol = true): string {
  const d = toMoney(input).toFixed(2);
  const [intPart, decPart] = d.split(".");
  const intFr = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return withSymbol ? `${intFr},${decPart} €` : `${intFr},${decPart}`;
}

/**
 * Parse une chaîne FR ("1 234,56" ou "1234.56" ou "1.234,56 €") en Decimal.
 * Renvoie null si invalide (pas d'exception, plus pratique côté formulaire).
 */
export function parseMoneyFR(input: string): Money | null {
  if (!input) return null;
  const cleaned = input
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  try {
    const d = new Decimal(cleaned);
    if (d.isNaN() || !d.isFinite()) return null;
    return d;
  } catch {
    return null;
  }
}
