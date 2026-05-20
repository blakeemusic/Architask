import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/auth";
import { certificatsPaiement } from "@/db/schema/finance";
import { lots, operations, planningTasks } from "@/db/schema/operations";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import {
  buildPlanningPdfData,
  generatePlanningPdf,
} from "@/lib/pdf/generatePlanningPdf";

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
    with: { avenants: true },
  });

  const tasks = await db.query.planningTasks.findMany({
    where: eq(planningTasks.operationId, id),
    orderBy: [asc(planningTasks.dateDebutPrevue)],
  });

  // % d'avancement par lot
  const cps = await db.query.certificatsPaiement.findMany({
    where: eq(certificatsPaiement.operationId, id),
    columns: { lotId: true, brutAPayerHt: true, statut: true },
  });
  const cumulByLot = new Map<string, number>();
  for (const cp of cps) {
    if (cp.statut === "brouillon") continue;
    cumulByLot.set(
      cp.lotId,
      (cumulByLot.get(cp.lotId) ?? 0) + Number(cp.brutAPayerHt ?? 0),
    );
  }
  const pctByLot = new Map<string, number>();
  for (const lot of lotsList) {
    const marcheInit = Number(lot.montantMarcheHt ?? 0);
    const avSignes = lot.avenants
      .filter((a) => a.statut === "signe")
      .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
    const marcheRev = marcheInit + avSignes;
    const cumul = cumulByLot.get(lot.id) ?? 0;
    pctByLot.set(
      lot.id,
      marcheRev > 0 ? Math.round((cumul / marcheRev) * 100) : 0,
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
    columns: { name: true },
  });

  const data = buildPlanningPdfData({
    operation: {
      code: op.code,
      name: op.name,
      ville: op.ville,
      dateOs: op.dateOs,
      dateReceptionCible: op.dateReceptionCible,
      moa: op.moa,
    },
    tasks: tasks.map((t) => ({
      id: t.id,
      type: t.type,
      libelle: t.libelle,
      dateDebutPrevue: t.dateDebutPrevue,
      dateFinPrevue: t.dateFinPrevue,
      dateDebutReelle: t.dateDebutReelle,
      dateFinReelle: t.dateFinReelle,
      statut: t.statut,
      milestoneKind: t.milestoneKind,
      pctAvancement: t.lotId ? pctByLot.get(t.lotId) : undefined,
    })),
    organizationName: org?.name ?? "Architask",
  });

  const buffer = await generatePlanningPdf(data);

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = `Planning-${op.code}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
