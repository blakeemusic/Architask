import Link from "next/link";
import { notFound } from "next/navigation";

import { getCPById } from "@/server/actions/operations/cps";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { CpDetailClient } from "./_components/cp-detail-client";

export default async function CpDetailPage({
  params,
}: {
  params: Promise<{ id: string; cpId: string }>;
}) {
  const { id: operationId, cpId } = await params;
  const res = await getCPById({ id: cpId });
  if (res.error || !res.data) notFound();
  const cp = res.data;

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
          href={`/operations/${operationId}`}
          className="hover:text-[var(--text-primary)]"
        >
          {cp.operation.name}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/operations/${operationId}/cps`}
          className="hover:text-[var(--text-primary)]"
        >
          Certificats de paiement
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          {cp.numero}
        </span>
      </div>

      <OperationTabs operationId={operationId} active="cp" />

      <CpDetailClient cp={cp} />
    </div>
  );
}
