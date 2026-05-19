import { err, ok, type ValidationResult } from "./_result";

/**
 * Helpers liés aux opérations (code, validation de payload, etc.).
 */

const CODE_REGEX = /^[A-Z0-9-]{2,8}$/;
const STOP_WORDS = new Set([
  "la",
  "le",
  "les",
  "de",
  "du",
  "des",
  "et",
  "ou",
  "un",
  "une",
  "à",
  "au",
  "aux",
  "en",
  "sur",
  "sous",
  "par",
]);

/**
 * Propose un code court à partir du nom de l'opération.
 *
 * Stratégie :
 *   1. Retire les mots d'arrêt ("la", "le", "des"...).
 *   2. Prend les initiales des mots restants.
 *   3. Si moins de 2 lettres, complète avec les premières lettres du nom.
 *   4. Si collision avec un code existant dans la même org, ajoute un suffixe
 *      numérique (RC → RC2 → RC3...).
 *
 * Exemples :
 *   "Résidence Les Cèdres"   → "RC"
 *   "Villa Robineau"         → "VR"
 *   "École Marchand"         → "EM"
 *   "Réhabilitation Saint-Martin" → "RSM"
 *   "Crèche Cousteau"        → "CC"
 *   "Maison"                 → "MA"  (fallback : 2 premières lettres)
 */
export function proposeOperationCode(
  name: string,
  existingCodes: ReadonlyArray<string>,
): string {
  const base = computeBaseCode(name);
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));

  if (!taken.has(base)) return base;

  // Collision : suffixer 2, 3, 4… jusqu'à 99.
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base}${n}`.slice(0, 8);
    if (!taken.has(candidate)) return candidate;
  }

  // Très improbable : 99 opérations avec le même base code.
  throw new Error(
    `Impossible de proposer un code unique pour "${name}" (99 collisions).`,
  );
}

function computeBaseCode(name: string): string {
  if (!name) return "OP";

  // Normalise : enlève accents, ponctuation.
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .trim();

  // Split + filtre des stop-words.
  const words = cleaned
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return "OP";

  // Cas 1 seul mot : 2 premières lettres.
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase().padEnd(2, "X");
  }

  // Cas plusieurs mots : initiales (max 4 pour garder court).
  const initials = words
    .slice(0, 4)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Au minimum 2 caractères.
  if (initials.length < 2) {
    return (initials + words[0].slice(initials.length, 2)).toUpperCase();
  }

  return initials;
}

/**
 * Valide qu'un code respecte le format `[A-Z0-9-]{2,8}` et qu'il est unique
 * dans la liste fournie.
 */
export function validateOperationCode(
  code: string,
  existingCodes: ReadonlyArray<string>,
): ValidationResult<string> {
  const upper = code.toUpperCase();
  if (!CODE_REGEX.test(upper)) {
    return err(
      "code_format_invalid",
      `Le code "${code}" doit faire 2 à 8 caractères [A-Z0-9-].`,
    );
  }
  if (existingCodes.map((c) => c.toUpperCase()).includes(upper)) {
    return err(
      "code_collision",
      `Le code "${upper}" est déjà utilisé pour une autre opération.`,
    );
  }
  return ok(upper);
}
