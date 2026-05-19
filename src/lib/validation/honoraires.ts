import { Decimal } from "decimal.js";

import { err, ok, type ValidationResult } from "./_result";
import { sumMoney, toMoney, type MoneyInput } from "./money";

/**
 * Règles métier honoraires (CLAUDE.md) :
 *  - Σ % missions = 100% (ou Σ montants = total) à la signature contrat
 *  - pct_avancement_nouveau ≥ pct_avancement_precedent (anti retour-arrière)
 *
 * Validations bloquantes, à appeler depuis les server actions.
 */

// ---------------------------------------------------------------
// Σ missions
// ---------------------------------------------------------------

export type MissionForValidation =
  | {
      typeValeur: "pct";
      pctDuTotal: string | number;
    }
  | {
      typeValeur: "montant";
      montantHt: MoneyInput;
    };

export type MissionsSumData = {
  modeDetected: "pct" | "montant";
  sum: string;
  expected: string;
};

/**
 * Vérifie l'intégrité de la liste de missions d'un contrat d'honoraires.
 *
 * - Toutes les missions doivent avoir le MÊME type (toutes pct OU toutes montant) :
 *   en MVP, on rejette les contrats mixtes pour rester simple.
 * - Si pct : Σ pct_du_total = 100.00 (tolérance ± 0.01).
 * - Si montant : Σ montant_ht = montant_total_ht (tolérance ± 0.01).
 */
export function assertMissionsSumValid(
  missions: ReadonlyArray<MissionForValidation>,
  montantTotalHt: MoneyInput,
): ValidationResult<MissionsSumData> {
  if (missions.length === 0) {
    return err(
      "missions_empty",
      "Le contrat doit comporter au moins une mission avant signature.",
    );
  }

  const allPct = missions.every((m) => m.typeValeur === "pct");
  const allMontant = missions.every((m) => m.typeValeur === "montant");

  if (!allPct && !allMontant) {
    return err(
      "missions_mixed_types",
      "Toutes les missions doivent être du même type (toutes en % OU toutes en montant).",
    );
  }

  if (allPct) {
    const sum = sumMoney(
      (missions as Array<Extract<MissionForValidation, { typeValeur: "pct" }>>).map(
        (m) => m.pctDuTotal,
      ),
    );
    if (sum.minus(100).abs().gt("0.01")) {
      return err(
        "missions_pct_not_100",
        `La somme des % missions doit être 100.00 % (actuel : ${sum.toFixed(2)} %).`,
      );
    }
    return ok({
      modeDetected: "pct",
      sum: sum.toFixed(2),
      expected: "100.00",
    });
  }

  // allMontant
  const sum = sumMoney(
    (missions as Array<Extract<MissionForValidation, { typeValeur: "montant" }>>).map(
      (m) => m.montantHt,
    ),
  );
  const expected = toMoney(montantTotalHt);
  if (sum.minus(expected).abs().gt("0.01")) {
    return err(
      "missions_total_mismatch",
      `La somme des montants missions (${sum.toFixed(2)} € HT) doit être égale au total contrat (${expected.toFixed(2)} € HT).`,
    );
  }
  return ok({
    modeDetected: "montant",
    sum: sum.toFixed(2),
    expected: expected.toFixed(2),
  });
}

// ---------------------------------------------------------------
// Avancement monotone
// ---------------------------------------------------------------

export type AvancementCheckData = {
  delta: string;
};

/**
 * Vérifie que le nouvel avancement d'une mission est ≥ avancement précédent.
 * Renvoie le delta (à appliquer pour le calcul du montant à facturer).
 */
export function assertAvancementMonotone(
  pctAvancementPrecedent: string | number,
  pctAvancementNouveau: string | number,
): ValidationResult<AvancementCheckData> {
  const prev = new Decimal(pctAvancementPrecedent);
  const next = new Decimal(pctAvancementNouveau);

  if (next.lt(0) || next.gt(100)) {
    return err(
      "avancement_out_of_range",
      `L'avancement doit être entre 0 et 100 % (reçu : ${next.toFixed(2)} %).`,
    );
  }

  if (next.lt(prev)) {
    return err(
      "avancement_decreased",
      `Le nouvel avancement (${next.toFixed(2)} %) ne peut pas être inférieur au précédent (${prev.toFixed(2)} %).`,
    );
  }

  return ok({ delta: next.minus(prev).toFixed(2) });
}
