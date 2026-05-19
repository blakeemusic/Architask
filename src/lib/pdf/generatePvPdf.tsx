import { renderToBuffer } from "@react-pdf/renderer";

import { getInitials } from "@/lib/utils";
import { PvDocument, type PvPdfData } from "./pv-template";

export type GeneratePvPdfInput = {
  pv: {
    dateReception: Date;
    avecReserves: string;
  };
  operation: {
    name: string;
    adresseLigne1: string | null;
    codePostal: string | null;
    ville: string | null;
    moa: { raisonSociale: string } | null;
  };
  reserves: Array<{
    lot: { numero: string; libelle: string };
    description: string;
    statut: "a_lever" | "en_cours" | "levee";
    dateLevee: Date | null;
  }>;
  organization: { name: string };
  signedAt?: Date;
  signedByName?: string;
};

export async function generatePvPdf(input: GeneratePvPdfInput): Promise<Buffer> {
  const adresseFull = [
    input.operation.adresseLigne1,
    [input.operation.codePostal, input.operation.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const data: PvPdfData = {
    dateReception: input.pv.dateReception,
    avecReserves: input.pv.avecReserves === "oui",
    operationName: input.operation.name,
    operationAdresse: adresseFull || null,
    moaName: input.operation.moa?.raisonSociale ?? null,
    reserves: input.reserves.map((r) => ({
      lotNumero: r.lot.numero,
      lotLibelle: r.lot.libelle,
      description: r.description,
      statut: r.statut,
      dateLevee: r.dateLevee,
    })),
    agency: {
      name: input.organization.name,
      initials: getInitials(input.organization.name),
    },
    signedAt: input.signedAt,
    signedByName: input.signedByName,
  };

  console.info("[PDF] generatePvPdf", {
    operation: data.operationName,
    nbReserves: data.reserves.length,
  });

  return await renderToBuffer(<PvDocument data={data} />);
}
