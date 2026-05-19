/**
 * Index unique des schémas Drizzle. Re-export de tout ce que drizzle-kit doit
 * voir pour générer les migrations, et que le client Drizzle utilise.
 *
 * Conventions :
 * - 1 fichier par grand domaine fonctionnel.
 * - Toutes les tables référencent organization_id (RLS-ready en V1).
 * - Tous les montants en numeric(14, 2) — voir _shared.ts.
 */

export * from "./auth";
export * from "./permissions";
export * from "./files";
export * from "./annuaire";
export * from "./operations";
export * from "./finance";
export * from "./cr";
export * from "./honoraires";
export * from "./tresorerie";
