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
 * Sert de fallback quand l'opération n'a pas encore de CP émis (cf.
 * computeAvancement ci-dessous).
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

/**
 * % d'avancement financier : Σ CP non-brouillon (brut HT) / marché révisé.
 * Renvoie null si aucun CP non-brouillon (le caller fallback sur temporel).
 */
export function computeFinancialAvancement(
  marcheReviseHt: string | number,
  cpsNonBrouillon: ReadonlyArray<{ brutAPayerHt: string | null }>,
): number | null {
  if (cpsNonBrouillon.length === 0) return null;
  const marche = Number(marcheReviseHt);
  if (Number.isNaN(marche) || marche === 0) return null;
  const cumul = cpsNonBrouillon.reduce(
    (s, cp) => s + Number(cp.brutAPayerHt ?? 0),
    0,
  );
  return Math.round((cumul / marche) * 100);
}

/**
 * Avancement hybride : financier si CP émis, sinon temporel.
 * C'est le helper que les pages doivent utiliser depuis le sprint CP.
 */
export function computeAvancement(opts: {
  marcheReviseHt: string | number;
  cpsNonBrouillon: ReadonlyArray<{ brutAPayerHt: string | null }>;
  dateOs: Date | null;
  dateReceptionCible: Date | null;
  today: Date;
}): { pct: number; source: "financier" | "temporel" } {
  const financier = computeFinancialAvancement(
    opts.marcheReviseHt,
    opts.cpsNonBrouillon,
  );
  if (financier !== null) return { pct: financier, source: "financier" };
  return {
    pct: computeTemporalAvancement(
      opts.dateOs,
      opts.dateReceptionCible,
      opts.today,
    ),
    source: "temporel",
  };
}
