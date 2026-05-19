import Link from "next/link";
import { notFound } from "next/navigation";

import { getOperationById } from "@/server/actions/operations/operations";
import {
  getPvByOperation,
  listReservesByOperation,
} from "@/server/actions/operations/pv-reception";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { ReceptionClient } from "./_components/reception-client";

export default async function ReceptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, pvRes, reservesRes] = await Promise.all([
    getOperationById({ id }),
    getPvByOperation({ operationId: id }),
    listReservesByOperation({ operationId: id }),
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
          Réception
        </span>
      </div>

      <OperationTabs operationId={id} active="reception" />

      <ReceptionClient
        operationId={id}
        operationName={opRes.data.name}
        lots={opRes.data.lots.map((l) => ({
          id: l.id,
          numero: l.numero,
          libelle: l.libelle,
        }))}
        pv={pvRes.data ?? null}
        reserves={reservesRes.data ?? []}
      />
    </div>
  );
}
