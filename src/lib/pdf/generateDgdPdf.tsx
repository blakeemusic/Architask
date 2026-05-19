import { renderToBuffer } from "@react-pdf/renderer";

import { getInitials } from "@/lib/utils";
import { DgdDocument, type DgdPdfData } from "./dgd-template";

export type GenerateDgdPdfInput = {
  dgd: {
    marcheReviseHt: string;
    travauxSupplAcceptesHt: string;
    penalitesHt: string;
    cumulCpVersesHt: string;
    soldeHt: string;
    soldeTtc: string;
    computedAt: Date | null;
  };
  lot: {
    numero: string;
    libelle: string;
    company: { raisonSociale: string; siret: string | null } | null;
  };
  operation: { id: string; name: string };
  organization: { name: string };
  signedAt?: Date;
  signedByName?: string;
};

export async function generateDgdPdf(input: GenerateDgdPdfInput): Promise<Buffer> {
  const data: DgdPdfData = {
    numero: `DGD-${input.operation.name.slice(0, 2).toUpperCase()}-${input.lot.numero}`,
    emissionDate: input.dgd.computedAt ?? new Date(),
    marcheReviseHt: input.dgd.marcheReviseHt,
    travauxSupplAcceptesHt: input.dgd.travauxSupplAcceptesHt,
    penalitesHt: input.dgd.penalitesHt,
    cumulCpVersesHt: input.dgd.cumulCpVersesHt,
    soldeHt: input.dgd.soldeHt,
    soldeTtc: input.dgd.soldeTtc,
    isDuMoa: Number(input.dgd.soldeHt) < 0,
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

  console.info("[PDF] generateDgdPdf", {
    numero: data.numero,
    soldeHt: data.soldeHt,
  });

  return await renderToBuffer(<DgdDocument data={data} />);
}
