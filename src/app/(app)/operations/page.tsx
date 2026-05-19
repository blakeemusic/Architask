import {
  getOperationsKpis,
  listOperations,
  type OperationListItem,
} from "@/server/actions/operations/operations";
import { listMoas } from "@/server/actions/annuaire/moas";

import { OperationsGridClient } from "./_components/operations-grid-client";

export default async function OperationsPage() {
  const [kpisRes, opsRes, moasRes] = await Promise.all([
    getOperationsKpis(),
    listOperations({}),
    listMoas({}),
  ]);

  const kpis = kpisRes.data ?? {
    totalActive: 0,
    totalUpcoming: 0,
    volumeEngageHt: "0",
    alertsCount: 0,
  };
  const operations: OperationListItem[] = opsRes.data ?? [];
  const moas = moasRes.data ?? [];

  return (
    <OperationsGridClient kpis={kpis} operations={operations} moas={moas} />
  );
}
