import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { listCPsByOperation } from "@/server/actions/operations/cps";
import { listCompanies } from "@/server/actions/annuaire/companies";

import { OperationRecapClient } from "./_components/operation-recap-client";

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, cpsRes, companiesRes] = await Promise.all([
    getOperationById({ id }),
    listCPsByOperation({ operationId: id }),
    listCompanies({}),
  ]);
  if (opRes.error || !opRes.data) notFound();

  return (
    <OperationRecapClient
      operation={opRes.data}
      cps={cpsRes.data ?? []}
      companies={companiesRes.data ?? []}
    />
  );
}
