import { sql } from "drizzle-orm";
import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Helpers réutilisables pour les colonnes communes à toutes les tables Architask.
 *
 * - id PK : UUID v4 généré par Postgres (gen_random_uuid()).
 * - timestamps : created_at, updated_at avec timezone.
 * - money(name) : numeric(14, 2) pour montants HT/TTC/TVA — plafond ~100M€.
 * - moneyOptional(name) : idem mais nullable.
 * - pctValue(name) : numeric(5, 2) pour pourcentages 0..100 (avec marge).
 */

// ---------------------------------------------------------------
// Colonnes systématiques
// ---------------------------------------------------------------

export const pk = () =>
  uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------
// Colonnes financières (numeric custom)
// ---------------------------------------------------------------

/** Montant non-null. Stockage Postgres : numeric(14, 2). Retour Drizzle : string. */
export const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2 }).notNull();

/** Montant nullable. */
export const moneyOptional = (name: string) =>
  numeric(name, { precision: 14, scale: 2 });

/** Pourcentage 0..100 (avec marge), 2 décimales. */
export const pctValue = (name: string) =>
  numeric(name, { precision: 5, scale: 2 });

/** Quantité (DPGF lines, etc.) — précision plus fine. */
export const quantity = (name: string) =>
  numeric(name, { precision: 12, scale: 4 });
