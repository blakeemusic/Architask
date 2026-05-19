/**
 * Squelette pour l'extraction DPGF depuis un PDF (sprint Import DPGF à venir).
 *
 * À l'usage : envoyer le PDF de DPGF (Décompte Général Provisoire Forfait)
 * à Claude Sonnet 4.6 Vision avec un prompt système qui demande la
 * ventilation par poste (désignation, unité, quantité, PU, montant total).
 *
 * En attendant l'implémentation, ce module exporte uniquement les types
 * pour que d'autres fichiers puissent les importer.
 */

export type ExtractedDpgfLine = {
  ordre: number;
  designation: string;
  unite?: string;
  quantite?: number;
  prixUnitaireHt?: number;
  montantTotalHt?: number;
  confidence: number;
};

export type ExtractDPGFResult = {
  lines: ExtractedDpgfLine[];
  confidenceGlobale: number;
};

// TODO Sprint Import DPGF : copier le pattern de extractSituation.ts.
