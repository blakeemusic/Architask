/**
 * Suggestion de catégorie à partir du libellé d'une transaction bancaire.
 * Heuristique simple : regex sur des mots-clés.
 *
 * Pure côté client → on l'expose depuis un module séparé (pas un "use
 * server"), pour pouvoir l'importer dans les composants client.
 */

export function suggestCategoryFromLibelle(libelle: string): string | null {
  const lower = libelle.toLowerCase();
  if (/total|esso|shell|carburant|station|sogeti mobility/.test(lower))
    return "vehicules";
  if (/uber|sncf|train|taxi|déplacement/.test(lower)) return "deplacements";
  if (/castorama|leroy merlin|brico|fournit/.test(lower)) return "fournitures";
  if (/restaurant|bistrot|brasserie|repas|cafe |café /.test(lower))
    return "frais_de_bouche";
  if (/amazon|fnac|materiel|matériel|écran|ordinateur/.test(lower))
    return "fournitures";
  if (/autodesk|adobe|slack|notion|microsoft|google workspace/.test(lower))
    return "logiciels";
  if (/free|orange|sfr|bouygues|téléphonie|internet/.test(lower))
    return "telecom";
  if (/loyer|sci /.test(lower)) return "loyer_bureau";
  if (/salaire/.test(lower)) return "salaires";
  if (/urssaf|charges sociales/.test(lower)) return "charges_sociales";
  if (/assur|mma|axa|allianz/.test(lower)) return "assurances";
  if (/vir |virement/.test(lower) && /nh-/i.test(lower)) return "honoraires";
  return null;
}
