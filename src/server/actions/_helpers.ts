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
    return err(
      e instanceof Error ? e.message : "Erreur serveur inattendue.",
      "server_error",
    );
  }
}
