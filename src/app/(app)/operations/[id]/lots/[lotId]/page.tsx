import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { lots } from "@/db/schema/operations";
import { getCurrentUser } from "@/lib/auth";

import { LotDetailClient } from "./_components/lot-detail-client";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>;
}) {
  const { id: operationId, lotId } = await params;
  const user = await getCurrentUser();
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: {
      operation: { columns: { id: true, organizationId: true, name: true, code: true, dateOs: true } },
      company: {
        with: {
          insurances: true,
        },
      },
      avenants: true,
    },
  });
  if (
    !lot ||
    lot.operation.organizationId !== user.organizationId ||
    lot.operation.id !== operationId
  ) {
    notFound();
  }

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
      {/* Breadcrumb */}
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
          {lot.operation.name}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          Lot {lot.numero} · {lot.libelle}
        </span>
      </div>

      <LotDetailClient lot={lot} />
    </div>
  );
}
