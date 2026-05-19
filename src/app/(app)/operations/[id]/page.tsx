import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { listCompanies } from "@/server/actions/annuaire/companies";

import { OperationRecapClient } from "./_components/operation-recap-client";

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, companiesRes] = await Promise.all([
    getOperationById({ id }),
    listCompanies({}),
  ]);
  if (opRes.error || !opRes.data) notFound();

  return (
    <OperationRecapClient
      operation={opRes.data}
      companies={companiesRes.data ?? []}
    />
  );
}
