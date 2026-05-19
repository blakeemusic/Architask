import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/auth";
import { reserves } from "@/db/schema/cr";
import { pvReceptions } from "@/db/schema/operations";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { generatePvPdf } from "@/lib/pdf/generatePvPdf";
import { getFileForRead } from "@/lib/storage/local";

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

  const pv = await db.query.pvReceptions.findFirst({
    where: eq(pvReceptions.id, id),
    with: {
      operation: { with: { moa: { columns: { raisonSociale: true } } } },
      signedByUser: { columns: { name: true } },
    },
  });
  if (!pv || pv.operation.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";

  // Si PV figé, on stream le fichier.
  if (pv.signedFileId) {
    const fileResult = await getFileForRead(pv.signedFileId);
    if (fileResult?.stream && fileResult.row.organizationId === user.organizationId) {
      return new NextResponse(
        Readable.toWeb(fileResult.stream as unknown as Readable) as unknown as ReadableStream,
        {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(fileResult.row.sizeBytes),
            "Content-Disposition": `${disposition}; filename="PV-${pv.operation.code}.pdf"`,
            "Cache-Control": "private, max-age=3600",
          },
        },
      );
    }
  }

  // Sinon régen dynamique
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
    columns: { name: true },
  });

  const reservesList = await db.query.reserves.findMany({
    where: eq(reserves.operationId, pv.operationId),
    orderBy: [asc(reserves.dateReleve)],
    with: { lot: { columns: { numero: true, libelle: true } } },
  });

  const buffer = await generatePvPdf({
    pv: { dateReception: pv.dateReception, avecReserves: pv.avecReserves },
    operation: {
      name: pv.operation.name,
      adresseLigne1: pv.operation.adresseLigne1,
      codePostal: pv.operation.codePostal,
      ville: pv.operation.ville,
      moa: pv.operation.moa,
    },
    reserves: reservesList.map((r) => ({
      lot: { numero: r.lot?.numero ?? "?", libelle: r.lot?.libelle ?? "" },
      description: r.description,
      statut: r.statut,
      dateLevee: r.dateLevee,
    })),
    organization: { name: org?.name ?? "Architask" },
    signedAt: pv.signedAt ?? undefined,
    signedByName: pv.signedByUser?.name,
  });

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="PV-${pv.operation.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Suppress unused
void and;
