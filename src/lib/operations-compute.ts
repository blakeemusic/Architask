/**
 * Helpers purs (synchrones) liés aux opérations. Externalisés dans /lib pour
 * pouvoir être importés depuis n'importe où — y compris des fichiers
 * "use server" ne peuvent que ré-exporter des fonctions async.
 */

type LotWithAvenants = {
  montantMarcheHt: string | null;
  avenants: { montantHt: string | null; statut: string }[];
};

/**
 * Marché révisé = Σ montants initiaux des lots + Σ avenants signés.
 * Computed côté code, pas de colonne dénormalisée (cf. décision sprint).
 * Retourne une string formatée "X.XX" pour rester compatible numeric Drizzle.
 */
export function computeMarcheReviseFromLots(
  lotRows: LotWithAvenants[],
): string {
  let total = 0;
  for (const l of lotRows) {
    total += Number(l.montantMarcheHt ?? 0);
    for (const a of l.avenants) {
      if (a.statut === "signe") total += Number(a.montantHt ?? 0);
    }
  }
  return total.toFixed(2);
}

/**
 * % d'avancement temporel d'une opération (mois écoulés / mois totaux).
 * TODO Sprint CP : remplacer par Σ CP émis / marché révisé (pondération
 * financière, plus pertinente que purement temporelle).
 */
export function computeTemporalAvancement(
  dateOs: Date | null,
  dateReceptionCible: Date | null,
  today: Date,
): number {
  if (!dateOs || !dateReceptionCible) return 0;
  const total = dateReceptionCible.getTime() - dateOs.getTime();
  if (total <= 0) return 0;
  const elapsed = today.getTime() - dateOs.getTime();
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  return Math.round(pct);
}
