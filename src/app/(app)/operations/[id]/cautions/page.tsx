import Link from "next/link";
import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import { listCautionsByOperation } from "@/server/actions/operations/cautions";
import { listRetentionsByOperation } from "@/server/actions/operations/retentions";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { CautionsClient } from "./_components/cautions-client";

export default async function CautionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, cautionsRes, retentionsRes] = await Promise.all([
    getOperationById({ id }),
    listCautionsByOperation({ operationId: id }),
    listRetentionsByOperation({ operationId: id }),
  ]);
  if (opRes.error || !opRes.data) notFound();

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
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
          Retenues & cautions
        </span>
      </div>

      <OperationTabs operationId={id} active="cautions" />

      <CautionsClient
        operationId={id}
        operationName={opRes.data.name}
        lots={opRes.data.lots.map((l) => ({
          id: l.id,
          numero: l.numero,
          libelle: l.libelle,
        }))}
        cautions={cautionsRes.data ?? []}
        retentions={retentionsRes.data ?? []}
      />
    </div>
  );
}
