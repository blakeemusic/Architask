import { z } from "zod";

/**
 * Schéma typed des variables d'env nécessaires côté runtime.
 *
 * - Les vars critiques (DATABASE_URL) sont required.
 * - Les vars d'intégrations futures (Clerk, R2, Bridge, Yousign…) sont optional
 *   pour ne pas bloquer le démarrage tant qu'on n'a pas câblé chaque service.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL doit être une URL Postgres valide"),

  // Clerk (auth) — câblage à venir au sprint Clerk
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // R2 (storage) — sprint storage à venir
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Anthropic (OCR)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Resend (emails)
  RESEND_API_KEY: z.string().optional(),

  // Mode / environnement
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement invalides :\n${formatted}\n\nVérifie ton fichier .env.local`,
    );
  }
  return parsed.data;
}

export const env: Env = parseEnv();
