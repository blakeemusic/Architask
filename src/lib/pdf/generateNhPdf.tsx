import { Decimal } from "decimal.js";
import { renderToBuffer } from "@react-pdf/renderer";

import { getInitials } from "@/lib/utils";
import { NhDocument, type NhPdfData } from "./nh-template";

export type GenerateNhPdfInput = {
  situation: {
    numero: string;
    dateEmission: Date;
    pctAvancementPrecedent: string;
    pctAvancementNouveau: string;
    montantHt: string | null;
    montantTva: string | null;
    montantTtc: string | null;
  };
  mission: {
    libelle: string;
    typeValeur: "pct" | "montant";
    pctDuTotal: string | null;
    montantHt: string | null;
  };
  contract: {
    montantTotalHt: string | null;
    tauxTva: string;
    delaiPaiementJours: number;
  };
  operation: { code: string; name: string };
  moa: { raisonSociale: string } | null;
  organization: { name: string };
  signedAt?: Date;
  signedByName?: string;
};

export async function generateNhPdf(input: GenerateNhPdfInput): Promise<Buffer> {
  const montantTotalHt = input.contract.montantTotalHt ?? "0";
  const montantMissionHt =
    input.mission.typeValeur === "pct"
      ? new Decimal(montantTotalHt)
          .mul(input.mission.pctDuTotal ?? "0")
          .div(100)
          .toFixed(2)
      : input.mission.montantHt ?? "0";

  const data: NhPdfData = {
    numero: input.situation.numero,
    emissionDate: input.situation.dateEmission,
    missionLibelle: input.mission.libelle,
    pctAvancementPrecedent: input.situation.pctAvancementPrecedent,
    pctAvancementNouveau: input.situation.pctAvancementNouveau,
    montantMissionHt,
    montantHt: input.situation.montantHt ?? "0",
    tauxTva: input.contract.tauxTva,
    montantTva: input.situation.montantTva ?? "0",
    montantTtc: input.situation.montantTtc ?? "0",
    delaiPaiementJours: input.contract.delaiPaiementJours,
    operationName: input.operation.name,
    operationCode: input.operation.code,
    moaNom: input.moa?.raisonSociale ?? "—",
    agency: {
      name: input.organization.name,
      initials: getInitials(input.organization.name),
    },
    signedAt: input.signedAt,
    signedByName: input.signedByName,
  };

  console.info("[PDF] generateNhPdf", {
    numero: data.numero,
    montantTtc: data.montantTtc,
  });

  return await renderToBuffer(<NhDocument data={data} />);
}
