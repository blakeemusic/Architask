/**
 * Format unifié de résultat des validations métier.
 *
 * Convention CLAUDE.md : les server actions retournent { data, error } typés,
 * jamais throw côté client. Les validations suivent le même contrat.
 *
 * Usage :
 *   const result = assertInsuranceValidAtOS(...);
 *   if (!result.ok) return { error: result.error };
 *   // result.data disponible et typé.
 */

export type ValidationOk<T = void> = { ok: true; data: T };
export type ValidationError = { ok: false; code: string; error: string };
export type ValidationResult<T = void> = ValidationOk<T> | ValidationError;

export function ok<T>(data: T): ValidationOk<T>;
export function ok(): ValidationOk<void>;
export function ok<T>(data?: T): ValidationOk<T | undefined> {
  return { ok: true, data: data as T };
}

export function err(code: string, error: string): ValidationError {
  return { ok: false, code, error };
}
