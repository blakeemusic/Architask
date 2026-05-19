import { ZodError, type ZodType } from "zod";

import { getCurrentUser, type CurrentUser, UnauthenticatedError } from "@/lib/auth";

/**
 * Convention de retour des server actions Architask :
 *   { data: T }                             → succès, data typée
 *   { error: string; code?: string }        → échec, jamais throw côté client
 */
export type ActionResult<T> =
  | { data: T; error?: undefined }
  | { error: string; code?: string; data?: undefined };

export function ok<T>(data: T): { data: T; error?: undefined } {
  return { data };
}

export function err(message: string, code?: string): ActionResult<never> {
  return { error: message, code };
}

/**
 * Wrap une server action : récupère le user, parse l'input Zod, attrape
 * les erreurs prévisibles. À utiliser dans toutes les actions.
 *
 * Note : `runHandler` doit retourner soit `{ data }` soit `{ error }` —
 * pas un throw. Si on doit signaler une erreur métier, return err(...).
 */
export async function withAction<TInput, TOutput>(
  schema: ZodType<TInput>,
  rawInput: unknown,
  runHandler: (
    input: TInput,
    ctx: { user: CurrentUser },
  ) => Promise<ActionResult<TOutput>>,
): Promise<ActionResult<TOutput>> {
  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return err("Vous devez être connecté.", "unauthenticated");
    }
    throw e;
  }

  let input: TInput;
  try {
    input = schema.parse(rawInput);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return err(
        first ? `${first.path.join(".")} : ${first.message}` : "Données invalides.",
        "validation_error",
      );
    }
    throw e;
  }

  try {
    return await runHandler(input, { user });
  } catch (e) {
    console.error("[server action] unexpected error", e);
    return err(buildSafeErrorMessage(e), "server_error");
  }
}

/**
 * Transforme une erreur arbitraire (souvent Postgres/Neon) en un message
 * utilisable côté UI sans fuiter de SQL brut, paramètres, ni stack trace.
 *
 * - En dev : on garde le message technique pour debug.
 * - En prod : message générique + classification par code Postgres
 *   (23505 unique violation, 23503 FK violation, etc.).
 */
function buildSafeErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return "Erreur serveur inattendue.";

  // Heuristique : si le message Drizzle/Neon commence par "Failed query:"
  // ou contient "duplicate key value violates unique constraint", on
  // affiche un message lisible.
  const raw = e.message;
  const cause = (e as { cause?: { code?: string; constraint_name?: string } }).cause;
  const pgCode = cause?.code;

  if (pgCode === "23505" || /duplicate key value/.test(raw)) {
    return "Cet élément existe déjà. Vérifie qu'il n'y a pas de doublon.";
  }
  if (pgCode === "23503") {
    return "Référence invalide : l'élément lié n'existe pas (ou plus).";
  }
  if (pgCode === "23514") {
    return "Une contrainte métier a été violée (ex. montant négatif, % hors range).";
  }
  if (/Failed query/.test(raw) || pgCode) {
    // Ne JAMAIS exposer la requête SQL brute en UI.
    if (process.env.NODE_ENV === "development") {
      return `Erreur DB (dev) : ${raw.slice(0, 200)}`;
    }
    return "Erreur technique. Contacte le support.";
  }
  return raw;
}
