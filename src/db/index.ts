import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";

import * as schema from "./schema";

/**
 * Client Drizzle pour Neon (HTTP fetch).
 *
 * - Idéal pour Server Actions, RSC, Route Handlers (chaque query = un fetch HTTP).
 * - Pas de transactions multi-requêtes (limitation HTTP). Pour les jobs Trigger.dev
 *   qui ont besoin de transactions longues, on basculera sur `drizzle-orm/neon-serverless`
 *   avec un Pool — à introduire au sprint Trigger.dev.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
