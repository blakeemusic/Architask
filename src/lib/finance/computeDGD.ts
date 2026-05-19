import { Decimal } from "decimal.js";

import { ceilToCent, sumMoney, toMoney, type MoneyInput } from "@/lib/validation/money";

/**
 * Moteur de calcul du Décompte Général Définitif (DGD) selon NF P03-001.
 *
 * Formule :
 *   marche_revise = montant_marche_initial + Σ avenants signés
 *   cumul_cp_verses = Σ CP non-brouillon.brut_a_payer_ht
 *   solde_ht = marche_revise + travaux_suppl_acceptes − penalites − cumul_cp_verses
 *   solde_ttc = solde_ht × (1 + taux_tva / 100)
 *
 * Cas positif (solde > 0) : reste dû à l'entreprise — c'est le cas habituel
 * (la retenue garantie 5% reste à libérer ou les travaux suppl. à payer).
 *
 * Cas négatif (solde < 0) : trop versé — l'entreprise doit rembourser. Rare.
 *
 * Toutes les opérations en decimal.js, arrondi centime supérieur sur le HT
 * et le TTC pour cohérence NF P03-001.
 */

export type ComputeDgdLot = {
  montantMarcheHt: MoneyInput;
  tauxTva: MoneyInput;
  avenantsSignes: ReadonlyArray<{ montantHt: MoneyInput }>;
};

export type ComputeDgdCp = {
  brutAPayerHt: MoneyInput;
  statut: "brouillon" | "a_valider" | "signe" | "envoye" | "paye";
};

export type ComputeDgdInput = {
  lot: ComputeDgdLot;
  cps: ReadonlyArray<ComputeDgdCp>;
  /** Travaux suppl. acceptés hors avenants formels (devis MOA validé). */
  travauxSupplAcceptesHt?: MoneyInput;
  /** Pénalités déclaratives (input archi, suggéré par la formule 1/1000/j). */
  penalitesHt?: MoneyInput;
};

export type ComputeDgdResult = {
  marcheReviseHt: string;
  travauxSupplAcceptesHt: string;
  penalitesHt: string;
  cumulCpVersesHt: string;
  soldeHt: string;
  soldeTtc: string;
  /** true si solde > 0 : reste dû à l'entreprise (cas habituel). */
  isDuEntreprise: boolean;
  /** true si solde < 0 : trop versé, remboursement entreprise. */
  isDuMoa: boolean;
  warnings: string[];
};

export type ComputeDgdError = {
  code: "invalid_amount" | "invalid_pct";
  error: string;
};

export type ComputeDgdOutcome =
  | { ok: true; data: ComputeDgdResult }
  | { ok: false; data: ComputeDgdError };

/**
 * Calcule un DGD. Pure function — pas d'accès DB. Retourne { ok, data }.
 */
export function computeDGD(input: ComputeDgdInput): ComputeDgdOutcome {
  const warnings: string[] = [];

  const marcheInitial = toMoney(input.lot.montantMarcheHt);
  if (marcheInitial.lt(0)) {
    return {
      ok: false,
      data: { code: "invalid_amount", error: "Marché initial négatif." },
    };
  }

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

  // Marché révisé = initial + Σ avenants signés (peuvent être négatifs).
  const cumulAvenantsSignes = sumMoney(
    input.lot.avenantsSignes.map((a) => a.montantHt),
  );
  const marcheRevise = marcheInitial.plus(cumulAvenantsSignes);

  // Travaux suppl. acceptés (déclaratif, défaut 0).
  const travauxSuppl = input.travauxSupplAcceptesHt
    ? toMoney(input.travauxSupplAcceptesHt)
    : new Decimal(0);
  if (travauxSuppl.lt(0)) {
    return {
      ok: false,
      data: {
        code: "invalid_amount",
        error: "Travaux suppl. acceptés négatif.",
      },
    };
  }

  // Pénalités (déclaratives, défaut 0).
  const penalites = input.penalitesHt
    ? toMoney(input.penalitesHt)
    : new Decimal(0);
  if (penalites.lt(0)) {
    return {
      ok: false,
      data: { code: "invalid_amount", error: "Pénalités négatives." },
    };
  }

  // Cumul CP versés = Σ CP non-brouillon. On accepte 0 CP (lot vide) →
  // soldeHt = marche_revise + travaux_suppl − penalites, sans déduction.
  const cpsRetenus = input.cps.filter((cp) => cp.statut !== "brouillon");
  const cumulCpVerses = sumMoney(cpsRetenus.map((cp) => cp.brutAPayerHt));

  // Solde HT
  const soldeHt = marcheRevise
    .plus(travauxSuppl)
    .minus(penalites)
    .minus(cumulCpVerses);

  // Solde TTC = soldeHt × (1 + tva/100)
  const soldeTtc = ceilToCent(
    soldeHt.times(new Decimal(1).plus(tauxTvaRaw.dividedBy(100))),
  );

  const isDuEntreprise = soldeHt.gt(0);
  const isDuMoa = soldeHt.lt(0);

  if (isDuMoa) {
    warnings.push(
      `Solde négatif (${soldeHt.toFixed(2)} €) : trop versé à l'entreprise — remboursement à demander.`,
    );
  }
  if (cpsRetenus.length === 0) {
    warnings.push(
      "Aucun CP émis sur ce lot — DGD calculé sans déduction de versement.",
    );
  }
  if (penalites.gt(0) && marcheInitial.gt(0)) {
    const pct = penalites.times(100).dividedBy(marcheInitial);
    if (pct.gt(15)) {
      warnings.push(
        `Pénalités élevées (${pct.toFixed(1)} % du marché initial) — vérifier le calcul.`,
      );
    }
  }

  return {
    ok: true,
    data: {
      marcheReviseHt: marcheRevise.toFixed(2),
      travauxSupplAcceptesHt: travauxSuppl.toFixed(2),
      penalitesHt: penalites.toFixed(2),
      cumulCpVersesHt: cumulCpVerses.toFixed(2),
      soldeHt: soldeHt.toFixed(2),
      soldeTtc: soldeTtc.toFixed(2),
      isDuEntreprise,
      isDuMoa,
      warnings,
    },
  };
}

/**
 * Helper informatif : suggère un montant de pénalités basé sur la règle
 * standard NF P03-001 (1/1000 du marché par jour ouvré de retard).
 * L'archi reste libre d'appliquer 0, le montant suggéré, ou un autre
 * (négociation MOA).
 */
export function suggestPenalitesPourRetard(opts: {
  marcheReviseHt: MoneyInput;
  dateReceptionPrevue: Date | null;
  dateReceptionReelle: Date | null;
  ratePerDay?: number;
}): {
  suggested: string;
  daysRetard: number;
  ratePerDay: number;
} {
  const rate = opts.ratePerDay ?? 1 / 1000;
  if (!opts.dateReceptionPrevue || !opts.dateReceptionReelle) {
    return { suggested: "0.00", daysRetard: 0, ratePerDay: rate };
  }
  const diffMs =
    opts.dateReceptionReelle.getTime() - opts.dateReceptionPrevue.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const marche = toMoney(opts.marcheReviseHt);
  const suggested = ceilToCent(marche.times(rate).times(days));
  return { suggested: suggested.toFixed(2), daysRetard: days, ratePerDay: rate };
}
