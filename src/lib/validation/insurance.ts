import { err, ok, type ValidationResult } from "./_result";

/**
 * Validation de la décennale d'une entreprise au moment de la signature
 * d'un marché — règle NF P03-001 bloquante.
 *
 * Deux conditions cumulatives doivent être remplies :
 *   1. Au moins une attestation de type "decennale" est valide à la date d'OS
 *      (date_debut <= dateOS <= date_fin).
 *   2. Les activités attendues sur le lot sont TOUTES couvertes par les
 *      activités déclarées de l'attestation valide.
 *
 * On valide aussi qu'aucune décennale couvrant ne va expirer avant la fin
 * estimée du chantier (warning non-bloquant — retourné dans data.warnings).
 */

export type InsuranceForValidation = {
  type: "decennale" | "rc_pro" | "gpa";
  dateDebut: Date;
  dateFin: Date;
  activitesCouvertes: string[];
};

export type InsuranceCheckData = {
  matchingInsurance: InsuranceForValidation;
  warnings: string[];
};

/**
 * Vérifie qu'une décennale valide couvre la date d'OS ET les activités du lot.
 *
 * @param insurances Toutes les attestations connues pour l'entreprise.
 * @param dateOs Date d'OS de l'opération (date début de la couverture requise).
 * @param activitesAttendues Activités prévues sur le lot (Qualibat ou libre).
 * @param dateFinChantier Date prévue de fin de chantier (pour warning expiration).
 */
export function assertInsuranceValidAtOS(
  insurances: ReadonlyArray<InsuranceForValidation>,
  dateOs: Date,
  activitesAttendues: ReadonlyArray<string>,
  dateFinChantier?: Date,
): ValidationResult<InsuranceCheckData> {
  const decennales = insurances.filter((i) => i.type === "decennale");

  if (decennales.length === 0) {
    return err(
      "no_decennale",
      "Aucune attestation de décennale enregistrée pour cette entreprise.",
    );
  }

  // 1. Filtrer celles qui sont valides à la date OS.
  const validAtOs = decennales.filter(
    (i) => i.dateDebut <= dateOs && dateOs <= i.dateFin,
  );

  if (validAtOs.length === 0) {
    return err(
      "decennale_expired",
      `Aucune décennale n'est valide à la date d'OS (${dateOs.toLocaleDateString("fr-FR")}).`,
    );
  }

  // 2. Vérifier la couverture des activités. On accepte un match si UNE des
  //    décennales valides couvre toutes les activités attendues.
  const matched = validAtOs.find((i) =>
    activitesAttendues.every((act) =>
      i.activitesCouvertes.some(
        (couverte) => couverte.toLowerCase() === act.toLowerCase(),
      ),
    ),
  );

  if (!matched) {
    const allCovered = new Set(
      validAtOs.flatMap((i) =>
        i.activitesCouvertes.map((a) => a.toLowerCase()),
      ),
    );
    const missing = activitesAttendues.filter(
      (act) => !allCovered.has(act.toLowerCase()),
    );
    return err(
      "decennale_activity_not_covered",
      `La décennale ne couvre pas les activités attendues : ${missing.join(", ")}.`,
    );
  }

  // 3. Warning si la décennale matchée expire avant la fin du chantier.
  const warnings: string[] = [];
  if (dateFinChantier && matched.dateFin < dateFinChantier) {
    warnings.push(
      `La décennale expire le ${matched.dateFin.toLocaleDateString("fr-FR")}, avant la fin prévue du chantier (${dateFinChantier.toLocaleDateString("fr-FR")}). Penser à demander une mise à jour.`,
    );
  }

  return ok({ matchingInsurance: matched, warnings });
}

/**
 * Calcule le statut d'une décennale par rapport à aujourd'hui.
 * - valide          : date_fin > now + 60 j
 * - expirant_60j    : 0 < (date_fin - now) <= 60 j
 * - expire          : date_fin <= now
 */
export function computeInsuranceStatus(
  insurance: Pick<InsuranceForValidation, "dateFin">,
  now: Date = new Date(),
): "valide" | "expirant_60j" | "expire" {
  const diffMs = insurance.dateFin.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "expire";
  if (diffDays <= 60) return "expirant_60j";
  return "valide";
}
