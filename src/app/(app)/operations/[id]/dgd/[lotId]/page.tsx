import Link from "next/link";
import { notFound } from "next/navigation";

import { getDGDByLot } from "@/server/actions/operations/dgd";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { DgdDetailClient } from "./_components/dgd-detail-client";

export default async function DgdDetailPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>;
}) {
  const { id: operationId, lotId } = await params;
  const res = await getDGDByLot({ lotId });
  if (res.error || !res.data) notFound();

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
          {res.data.lot?.libelle ?? operationId}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/operations/${operationId}/dgd`}
          className="hover:text-[var(--text-primary)]"
        >
          DGD
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          Lot {res.data.lot?.numero}
        </span>
      </div>

      <OperationTabs operationId={operationId} active="dgd" />

      <DgdDetailClient dgd={res.data} operationId={operationId} />
    </div>
  );
}
