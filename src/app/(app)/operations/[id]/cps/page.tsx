import Link from "next/link";
import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { getCpsKpisByOperation, listCPsByOperation } from "@/server/actions/operations/cps";
import { listCompanies } from "@/server/actions/annuaire/companies";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { CpsListClient } from "./_components/cps-list-client";

export default async function CpsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, cpsRes, kpisRes, companiesRes] = await Promise.all([
    getOperationById({ id }),
    listCPsByOperation({ operationId: id }),
    getCpsKpisByOperation({ operationId: id }),
    listCompanies({}),
  ]);
  if (opRes.error || !opRes.data) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      <div
        className="flex items-center gap-2 text-[13px] mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link href="/operations" className="hover:text-[var(--text-primary)]">
          Opérations
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/operations/${id}`}
          className="hover:text-[var(--text-primary)]"
        >
          {opRes.data.name}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          Certificats de paiement
        </span>
      </div>

      <OperationTabs operationId={id} active="cp" />

      <CpsListClient
        operation={opRes.data}
        cps={cpsRes.data ?? []}
        kpis={
          kpisRes.data ?? {
            aValider: 0,
            signes: 0,
            payes: 0,
            cumulEmisHt: "0",
          }
        }
        companies={companiesRes.data ?? []}
      />
    </div>
  );
}
