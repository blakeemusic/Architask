import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/auth";
import { reserves } from "@/db/schema/cr";
import { certificatsPaiement } from "@/db/schema/finance";
import { lots, operations, retentions } from "@/db/schema/operations";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import {
  buildRecapData,
  generateRecapPdf,
} from "@/lib/pdf/generateRecapPdf";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const op = await db.query.operations.findFirst({
    where: and(
      eq(operations.id, id),
      eq(operations.organizationId, user.organizationId),
    ),
    with: { moa: { columns: { raisonSociale: true } } },
  });
  if (!op) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lotsList = await db.query.lots.findMany({
    where: eq(lots.operationId, id),
    orderBy: [asc(lots.numero)],
    with: { company: true, avenants: true },
  });

  const cps = await db.query.certificatsPaiement.findMany({
    where: eq(certificatsPaiement.operationId, id),
    columns: { lotId: true, brutAPayerHt: true, retenueGarantie: true, statut: true },
  });

  // Cumul CP par lot + total
  const cpsByLot = new Map<string, number>();
  const cpsByLotMap = new Map<string, string>();
  for (const l of lotsList) cpsByLotMap.set(l.numero, l.id);
  let cpCumulHt = 0;
  for (const cp of cps) {
    if (cp.statut === "brouillon") continue;
    cpCumulHt += Number(cp.brutAPayerHt ?? 0);
    cpsByLot.set(
      cp.lotId,
      (cpsByLot.get(cp.lotId) ?? 0) + Number(cp.brutAPayerHt ?? 0),
    );
  }

  // Retenues totales sur l'op
  const opLotIds = lotsList.map((l) => l.id);
  let retenueHt = 0;
  if (opLotIds.length > 0) {
    const allRetentions = await db.query.retentions.findMany({
      where: eq(retentions.statut, "en_cours"),
    });
    for (const r of allRetentions) {
      if (opLotIds.includes(r.lotId)) {
        retenueHt += Number(r.montantRetenu ?? 0);
      }
    }
  }
  // Si pas de retentions (PV pas encore signé), on prend la Σ des retenues CP
  if (retenueHt === 0) {
    for (const cp of cps) {
      if (cp.statut === "brouillon") continue;
      retenueHt += Number(cp.retenueGarantie ?? 0);
    }
  }

  const reservesList = await db.query.reserves.findMany({
    where: eq(reserves.operationId, id),
    with: { lot: { columns: { numero: true } } },
  });

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
    columns: { name: true },
  });

  const data = buildRecapData({
    operation: {
      code: op.code,
      name: op.name,
      ville: op.ville,
      dateOs: op.dateOs,
      dateReceptionCible: op.dateReceptionCible,
      moa: op.moa,
    },
    lots: lotsList,
    cpsByLot,
    cpsByLotMap,
    cpCumulHt,
    retenueHt,
    reserves: reservesList.map((r) => ({
      lot: { numero: r.lot?.numero ?? "?" },
      description: r.description,
      statut: r.statut,
    })),
    organizationName: org?.name ?? "Architask",
  });

  const buffer = await generateRecapPdf(data);

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = `Recap-${op.code}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
