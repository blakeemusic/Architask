/**
 * Constantes pures Trésorerie / Charges récurrentes.
 *
 * IMPORTANT : ce fichier ne contient AUCUNE server action. Un fichier
 * marqué "use server" ne peut exporter que des async functions — toute
 * constante (array, objet, etc.) y est cassée. On garde donc les
 * constantes ici, importables côté serveur ET côté client.
 */

export const CHARGE_CATEGORIES = [
  "salaires",
  "charges_sociales",
  "loyer_bureau",
  "vehicules",
  "logiciels",
  "telecom",
  "comptable",
  "assurances",
  "autres",
] as const;

export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];
