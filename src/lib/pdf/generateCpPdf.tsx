import { renderToBuffer } from "@react-pdf/renderer";

import { getInitials } from "@/lib/utils";
import { CpDocument, type CpPdfData } from "./cp-template";

/**
 * Génère le PDF d'un CP en Buffer. Appelé :
 *  - à la volée par /api/cps/[id]/pdf tant que le CP est brouillon/à_valider
 *  - une fois par signCP() qui fige le PDF dans .uploads/ (statut signé+).
 */

export type GenerateCpPdfInput = {
  cp: {
    numero: string;
    periodeMois: number;
    periodeAnnee: number;
    createdAt: Date;
    dueDate: Date | null;
    cumulTravauxHt: string;
    cumulCpPrecedentsHt: string;
    brutAPayerHt: string;
    retenueGarantie: string;
    revisionMontantHt: string | null;
    netTtc: string;
    tva: string;
  };
  lot: {
    numero: string;
    libelle: string;
    tauxTva: string;
    delaiPaiementJours: number;
    company:
      | {
          raisonSociale: string;
          siret: string | null;
        }
      | null;
  };
  operation: {
    name: string;
  };
  situation:
    | {
        lines: Array<{
          pctAvancement: string;
          montantCumuleHt: string | null;
          dpgfLine?: {
            designation: string;
            unite: string | null;
          } | null;
        }>;
      }
    | null;
  organization: { name: string };
  signedAt?: Date;
  signedByName?: string;
};

export async function generateCpPdf(input: GenerateCpPdfInput): Promise<Buffer> {
  console.info("[PDF] generateCpPdf start", {
    numero: input.cp.numero,
    netTtc: input.cp.netTtc,
  });

  const montantHt = (
    Number(input.cp.brutAPayerHt) -
    Number(input.cp.retenueGarantie) +
    Number(input.cp.revisionMontantHt ?? 0)
  ).toFixed(2);

  const ventilation: CpPdfData["ventilation"] =
    input.situation?.lines.flatMap((line) => {
      // On affiche uniquement les lignes avec un poste DPGF identifié — sinon
      // on tombe en mode "avancement global" (table vide, le bloc calcul suffit).
      if (!line.dpgfLine) return [];
      return [
        {
          designation: line.dpgfLine.designation,
          unite: line.dpgfLine.unite,
          quantite: null,
          pctAvancement: line.pctAvancement,
          montantCumuleHt: line.montantCumuleHt ?? "0",
        },
      ];
    }) ?? [];

  const data: CpPdfData = {
    numero: input.cp.numero,
    periodeMois: input.cp.periodeMois,
    periodeAnnee: input.cp.periodeAnnee,
    emissionDate: input.cp.createdAt,
    dueDate: input.cp.dueDate,
    cumulTravauxHt: input.cp.cumulTravauxHt,
    cumulCpPrecedentsHt: input.cp.cumulCpPrecedentsHt,
    brutAPayerHt: input.cp.brutAPayerHt,
    retenueGarantie: input.cp.retenueGarantie,
    revisionMontantHt: input.cp.revisionMontantHt,
    montantHt,
    tva: input.cp.tva,
    netTtc: input.cp.netTtc,
    tauxTva: input.lot.tauxTva,
    delaiPaiementJours: input.lot.delaiPaiementJours,
    ventilation,
    operationName: input.operation.name,
    lotNumero: input.lot.numero,
    lotLibelle: input.lot.libelle,
    entrepriseNom: input.lot.company?.raisonSociale ?? "—",
    entrepriseSiret: input.lot.company?.siret ?? null,
    agency: {
      name: input.organization.name,
      initials: getInitials(input.organization.name),
    },
    signedAt: input.signedAt,
    signedByName: input.signedByName,
  };

  // Debug : log les montants formatés juste avant le render PDF pour
  // pouvoir confirmer que la chaîne sortie de formatMoneyForPdf est bien
  // en ASCII pur (espaces U+0020 normaux).
  const { formatMoneyForPdf } = await import("@/lib/format");
  const formattedNetTtc = formatMoneyForPdf(data.netTtc);
  console.info("[PDF] generateCpPdf render", {
    numero: data.numero,
    rawNetTtc: data.netTtc,
    formattedNetTtc,
    hexCheck: Buffer.from(formattedNetTtc).toString("hex"),
  });

  return await renderToBuffer(<CpDocument data={data} />);
}
