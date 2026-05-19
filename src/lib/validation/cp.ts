import { Decimal } from "decimal.js";

import { err, ok, type ValidationResult } from "./_result";
import { sumMoney, toMoney, type MoneyInput } from "./money";

/**
 * Règle métier NF P03-001 critique (CLAUDE.md, ligne "Σ CP ≤ marché révisé +
 * travaux suppl. acceptés — assertion bloquante serveur").
 *
 * Avant d'insérer un nouveau CP, on vérifie que :
 *   Σ (CP existants hors brouillon en montant brut HT) + nouveauBrut HT
 *     ≤ marché initial HT + Σ avenants signés HT + travauxSupplAcceptes HT
 *
 * Les CP en statut "brouillon" sont exclus du cumul — ils peuvent être annulés.
 */

export type ExistingCp = {
  brutAPayerHt: MoneyInput;
  /** Statut : seuls les CP NON brouillon comptent dans le cumul. */
  statut: "brouillon" | "a_valider" | "signe" | "envoye" | "paye";
};

export type SignedAvenant = {
  /** Peut être négatif (avenant en moins). */
  montantHt: MoneyInput;
  /** Seuls les avenants signés modifient le plafond. */
  statut: "brouillon" | "a_signer" | "signe";
};

export type CpValidationInput = {
  marcheInitialHt: MoneyInput;
  avenants: ReadonlyArray<SignedAvenant>;
  /** Travaux suppl. acceptés hors avenants formels (ex. devis MOA validé). */
  travauxSupplAcceptesHt?: MoneyInput;
  existingCps: ReadonlyArray<ExistingCp>;
  /** Le CP qu'on veut insérer/valider — son montant brut HT. */
  newBrutAPayerHt: MoneyInput;
};

export type CpValidationData = {
  marcheReviseHt: string;
  cumulCpExistantsHt: string;
  cumulApresNouveauCpHt: string;
  margeRestanteHt: string;
};

export function assertCPWithinMarche(
  input: CpValidationInput,
): ValidationResult<CpValidationData> {
  const marcheInitial = toMoney(input.marcheInitialHt);
  const avenantsSignes = input.avenants.filter((a) => a.statut === "signe");
  const cumulAvenantsSignes = sumMoney(avenantsSignes.map((a) => a.montantHt));
  const travauxSuppl = input.travauxSupplAcceptesHt
    ? toMoney(input.travauxSupplAcceptesHt)
    : new Decimal(0);

  const marcheRevise = marcheInitial.plus(cumulAvenantsSignes).plus(travauxSuppl);

  // Cumul des CP existants (hors brouillon).
  const cpsRetenus = input.existingCps.filter((cp) => cp.statut !== "brouillon");
  const cumulCpExistants = sumMoney(cpsRetenus.map((cp) => cp.brutAPayerHt));

  const newBrut = toMoney(input.newBrutAPayerHt);

  if (newBrut.lt(0)) {
    return err(
      "cp_negative_amount",
      "Le montant brut du CP doit être positif ou nul.",
    );
  }

  const cumulApres = cumulCpExistants.plus(newBrut);

  if (cumulApres.gt(marcheRevise)) {
    const depassement = cumulApres.minus(marcheRevise);
    return err(
      "cp_exceeds_marche",
      `Le cumul des CP (${cumulApres.toFixed(2)} €) dépasserait le marché révisé (${marcheRevise.toFixed(2)} €) de ${depassement.toFixed(2)} €. Création bloquée.`,
    );
  }

  return ok({
    marcheReviseHt: marcheRevise.toFixed(2),
    cumulCpExistantsHt: cumulCpExistants.toFixed(2),
    cumulApresNouveauCpHt: cumulApres.toFixed(2),
    margeRestanteHt: marcheRevise.minus(cumulApres).toFixed(2),
  });
}
