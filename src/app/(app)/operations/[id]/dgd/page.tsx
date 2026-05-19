import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { certificatsPaiement } from "@/db/schema/finance";
import { getOperationById } from "@/server/actions/operations/operations";
import { listDGDsByOperation } from "@/server/actions/operations/dgd";
import { OperationTabs } from "@/components/operations/operation-tabs";

import { DgdListClient } from "./_components/dgd-list-client";

export default async function DgdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [opRes, lotsRes] = await Promise.all([
    getOperationById({ id }),
    listDGDsByOperation({ operationId: id }),
  ]);
  if (opRes.error || !opRes.data) notFound();

  // Récupère cumul CP par lot pour préview "écart" sur les lots sans DGD.
  const cps = await db.query.certificatsPaiement.findMany({
    where: eq(certificatsPaiement.operationId, id),
    columns: { lotId: true, brutAPayerHt: true, statut: true },
  });
  const cumulByLot = new Map<string, number>();
  const cpsPendingByLot = new Map<string, number>();
  for (const cp of cps) {
    if (cp.statut === "brouillon" || cp.statut === "a_valider") {
      cpsPendingByLot.set(cp.lotId, (cpsPendingByLot.get(cp.lotId) ?? 0) + 1);
    }
    if (cp.statut === "brouillon") continue;
    cumulByLot.set(
      cp.lotId,
      (cumulByLot.get(cp.lotId) ?? 0) + Number(cp.brutAPayerHt ?? 0),
    );
  }

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
          Décompte Général Définitif
        </span>
      </div>

      <OperationTabs operationId={id} active="dgd" />

      <DgdListClient
        operationId={id}
        operationName={opRes.data.name}
        lots={(lotsRes.data ?? []).map((l) => ({
          id: l.id,
          numero: l.numero,
          libelle: l.libelle,
          montantMarcheHt: l.montantMarcheHt,
          statut: l.statut,
          company: l.company,
          avenants: l.avenants,
          dgd: l.dgd,
          cumulCp: cumulByLot.get(l.id) ?? 0,
          cpsPending: cpsPendingByLot.get(l.id) ?? 0,
        }))}
      />
    </div>
  );
}
