// Charge .env.local AVANT de lire process.env (Next.js convention).
// process.loadEnvFile est natif Node 20.12+.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local absent — on tente .env par défaut (drizzle-kit le charge déjà).
}

import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL manquante. Renseigne-la dans .env.local (Neon connection string).",
  );
}

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;
