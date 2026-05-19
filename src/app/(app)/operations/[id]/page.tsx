import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { listCPsByOperation } from "@/server/actions/operations/cps";
import { listCompanies } from "@/server/actions/annuaire/companies";
import {
  getPvByOperation,
  listReservesByOperation,
} from "@/server/actions/operations/pv-reception";
import { listDGDsByOperation } from "@/server/actions/operations/dgd";

import { OperationRecapClient } from "./_components/operation-recap-client";

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, cpsRes, companiesRes, pvRes, reservesRes, dgdLotsRes] =
    await Promise.all([
      getOperationById({ id }),
      listCPsByOperation({ operationId: id }),
      listCompanies({}),
      getPvByOperation({ operationId: id }),
      listReservesByOperation({ operationId: id }),
      listDGDsByOperation({ operationId: id }),
    ]);
  if (opRes.error || !opRes.data) notFound();

  // Build a map lotId → dgd statut (pour la colonne DGD du tableau récap).
  const dgdByLot = new Map<string, "brouillon" | "a_valider" | "signe">();
  for (const l of dgdLotsRes.data ?? []) {
    if (l.dgd) dgdByLot.set(l.id, l.dgd.statut);
  }

  return (
    <OperationRecapClient
      operation={opRes.data}
      cps={cpsRes.data ?? []}
      companies={companiesRes.data ?? []}
      pv={pvRes.data ?? null}
      reserves={reservesRes.data ?? []}
      dgdByLot={Array.from(dgdByLot.entries())}
    />
  );
}
