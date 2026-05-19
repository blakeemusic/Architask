import { Decimal } from "decimal.js";

import { ceilToCent, sumMoney, toMoney, type MoneyInput } from "@/lib/validation/money";

/**
 * Moteur de calcul d'un Certificat de Paiement selon la norme NF P03-001
 * (marché privé).
 *
 * Toutes les opérations en decimal.js — jamais de float. Tous les montants
 * arrondis au centime SUPÉRIEUR (cf. CLAUDE.md, règle NF P03-001 critique).
 *
 * Logique :
 *  1. marche_revise = montant_marche_initial + Σ avenants signés
 *  2. cumul_travaux_ht = Σ situation_lines.montant_cumule OU
 *                        (pct_global / 100) × marche_revise si pas de lignes
 *  3. cumul_cp_precedents_ht = Σ previousCPs.brut_a_payer_ht (CP non-brouillon)
 *  4. brut_a_payer_ht = cumul_travaux_ht − cumul_cp_precedents_ht (≥ 0 assert)
 *  5. retenue_garantie = brut_a_payer × (retenue_garantie_pct / 100)
 *     PLAFONNÉE pour que Σ retenues ≤ retenue_garantie_pct × marche_revise.
 *  6. revision_montant = brut_a_payer × (revisionCoefficient − 1)
 *  7. montant_ht = brut_a_payer − retenue + revision_montant
 *  8. tva = montant_ht × (taux_tva / 100), arrondi centime sup
 *  9. net_ttc = montant_ht + tva, arrondi centime sup
 *
 * @see PRD section 6 "Règles métier & conformité NF P03-001"
 */

export type ComputeCpLot = {
  montantMarcheHt: MoneyInput;
  retenueGarantiePct: MoneyInput;
  tauxTva: MoneyInput;
  avenantsSignes: ReadonlyArray<{ montantHt: MoneyInput }>;
};

export type ComputeCpSituation =
  | {
      mode: "lines";
      lines: ReadonlyArray<{ montantCumuleHt: MoneyInput }>;
    }
  | {
      mode: "global";
      pctGlobal: MoneyInput;
    };

export type ComputeCpPrevious = {
  brutAPayerHt: MoneyInput;
  retenueGarantie: MoneyInput;
  /** brouillon = ignoré, sinon compté. */
  statut: "brouillon" | "a_valider" | "signe" | "envoye" | "paye";
};

export type ComputeCpInput = {
  situation: ComputeCpSituation;
  lot: ComputeCpLot;
  previousCPs: ReadonlyArray<ComputeCpPrevious>;
  /** Ex. "1.025" pour révision +2.5% (BT01). Défaut : 1 (pas de révision). */
  revisionCoefficient?: MoneyInput;
};

export type ComputeCpResult = {
  marcheReviseHt: string;
  cumulTravauxHt: string;
  cumulCpPrecedentsHt: string;
  brutAPayerHt: string;
  retenueGarantie: string;
  /** Cumul des retenues (previous + nouveau). Utile pour le plafond. */
  cumulRetenues: string;
  revisionMontantHt: string;
  montantHt: string;
  tva: string;
  netTtc: string;
  warnings: string[];
};

export type ComputeCpError = {
  code:
    | "negative_brut"
    | "marche_zero_with_global_pct"
    | "invalid_pct"
    | "invalid_coefficient";
  error: string;
};

export type ComputeCpOutcome =
  | { ok: true; data: ComputeCpResult }
  | { ok: false; data: ComputeCpError };

/**
 * Calcule un CP. Pure fonction — pas d'accès DB. Retourne { ok, data }
 * (jamais throw côté caller) pour rester consistant avec les server actions.
 */
export function computeCP(input: ComputeCpInput): ComputeCpOutcome {
  const warnings: string[] = [];

  // 1. Marché révisé
  const marcheInitial = toMoney(input.lot.montantMarcheHt);
  const cumulAvenantsSignes = sumMoney(
    input.lot.avenantsSignes.map((a) => a.montantHt),
  );
  const marcheRevise = marcheInitial.plus(cumulAvenantsSignes);

  // 2. Cumul travaux exécutés HT
  let cumulTravaux: Decimal;
  if (input.situation.mode === "lines") {
    cumulTravaux = sumMoney(
      input.situation.lines.map((l) => l.montantCumuleHt),
    );
  } else {
    const pct = toMoney(input.situation.pctGlobal);
    if (pct.lt(0) || pct.gt(100)) {
      return {
        ok: false,
        data: {
          code: "invalid_pct",
          error: `% d'avancement global hors range : ${pct.toFixed(2)} %.`,
        },
      };
    }
    if (marcheRevise.eq(0)) {
      return {
        ok: false,
        data: {
          code: "marche_zero_with_global_pct",
          error: "Marché révisé à 0 € — impossible de calculer un avancement global.",
        },
      };
    }
    cumulTravaux = marcheRevise.times(pct).dividedBy(100);
  }

  // 3. Cumul CP précédents — brouillons exclus
  const cpsRetenus = input.previousCPs.filter((cp) => cp.statut !== "brouillon");
  const cumulCpPrecedents = sumMoney(cpsRetenus.map((cp) => cp.brutAPayerHt));
  const cumulRetenuesPrevious = sumMoney(
    cpsRetenus.map((cp) => cp.retenueGarantie),
  );

  // 4. Brut à payer HT
  const brutRaw = cumulTravaux.minus(cumulCpPrecedents);
  if (brutRaw.lt(0)) {
    return {
      ok: false,
      data: {
        code: "negative_brut",
        error: `Brut à payer négatif (${brutRaw.toFixed(2)} €) — le cumul travaux est inférieur aux CP précédents.`,
      },
    };
  }
  const brutAPayer = ceilToCent(brutRaw);
  if (brutAPayer.eq(0)) {
    warnings.push("Brut à payer nul — aucun avancement depuis le dernier CP.");
  }

  // 5. Retenue garantie + plafond
  const retenuePctRaw = toMoney(input.lot.retenueGarantiePct);
  if (retenuePctRaw.lt(0) || retenuePctRaw.gt(100)) {
    return {
      ok: false,
      data: {
        code: "invalid_pct",
        error: `Retenue garantie % hors range : ${retenuePctRaw.toFixed(2)} %.`,
      },
    };
  }
  const retenuePct = retenuePctRaw.dividedBy(100);
  const retenueRow = ceilToCent(brutAPayer.times(retenuePct));
  const plafondRetenues = marcheRevise.times(retenuePct);
  const margeRetenue = plafondRetenues.minus(cumulRetenuesPrevious);
  let retenueFinale = retenueRow;
  if (retenueFinale.gt(margeRetenue)) {
    retenueFinale = Decimal.max(0, margeRetenue).toDecimalPlaces(
      2,
      Decimal.ROUND_FLOOR,
    );
    if (retenueRow.gt(retenueFinale)) {
      warnings.push(
        `Retenue garantie plafonnée à ${retenueFinale.toFixed(2)} € (plafond ${plafondRetenues.toFixed(2)} € atteint).`,
      );
    }
  }
  const cumulRetenues = cumulRetenuesPrevious.plus(retenueFinale);

  // 6. Révision (formule BT01 ou autre, coefficient déjà calculé en amont)
  let revisionMontant = new Decimal(0);
  if (input.revisionCoefficient !== undefined) {
    const coef = toMoney(input.revisionCoefficient);
    if (coef.lte(0) || coef.gt(10)) {
      return {
        ok: false,
        data: {
          code: "invalid_coefficient",
          error: `Coefficient de révision invalide : ${coef.toFixed(4)} (attendu entre 0 et 10).`,
        },
      };
    }
    revisionMontant = ceilToCent(brutAPayer.times(coef.minus(1)));
    if (revisionMontant.lt(0)) {
      warnings.push(
        `Révision négative ${revisionMontant.toFixed(2)} € (déflation BT01 admise).`,
      );
    }
  }

  // 7. Montant HT
  const montantHt = brutAPayer.minus(retenueFinale).plus(revisionMontant);

  // 8. TVA
  const tauxTvaRaw = toMoney(input.lot.tauxTva);
  if (tauxTvaRaw.lt(0) || tauxTvaRaw.gt(100)) {
    return {
      ok: false,
      data: {
        code: "invalid_pct",
        error: `Taux TVA hors range : ${tauxTvaRaw.toFixed(2)} %.`,
      },
    };
  }
  const tva = ceilToCent(montantHt.times(tauxTvaRaw).dividedBy(100));

  // 9. Net TTC
  const netTtc = ceilToCent(montantHt.plus(tva));

  return {
    ok: true,
    data: {
      marcheReviseHt: marcheRevise.toFixed(2),
      cumulTravauxHt: cumulTravaux.toFixed(2),
      cumulCpPrecedentsHt: cumulCpPrecedents.toFixed(2),
      brutAPayerHt: brutAPayer.toFixed(2),
      retenueGarantie: retenueFinale.toFixed(2),
      cumulRetenues: cumulRetenues.toFixed(2),
      revisionMontantHt: revisionMontant.toFixed(2),
      montantHt: montantHt.toFixed(2),
      tva: tva.toFixed(2),
      netTtc: netTtc.toFixed(2),
      warnings,
    },
  };
}
