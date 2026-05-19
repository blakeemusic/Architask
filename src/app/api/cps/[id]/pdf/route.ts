import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema/auth";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { generateCpPdf } from "@/lib/pdf/generateCpPdf";
import { getFileForRead } from "@/lib/storage/local";
import { certificatsPaiement } from "@/db/schema/finance";

/**
 * Route /api/cps/[id]/pdf
 *  - Si cp.signed_file_id existe (statut ≥ signé) → stream le fichier figé.
 *  - Sinon → régénère le PDF dynamiquement depuis les data CP (statut
 *    brouillon ou à_valider).
 *  - Query `?download=1` → Content-Disposition attachment ; sinon inline.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const cp = await db.query.certificatsPaiement.findFirst({
    where: eq(certificatsPaiement.id, id),
    with: {
      operation: true,
      lot: { with: { company: true } },
      situation: {
        with: {
          lines: { with: { dpgfLine: true } },
        },
      },
      signedByUser: { columns: { name: true } },
    },
  });
  if (!cp || cp.operation.organizationId !== currentUser.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = `${cp.numero}.pdf`;

  // Cas 1 : PDF figé sur disque (statut ≥ signé)
  if (cp.signedFileId) {
    const fileResult = await getFileForRead(cp.signedFileId);
    if (
      fileResult &&
      fileResult.row.organizationId === currentUser.organizationId &&
      fileResult.stream
    ) {
      return new NextResponse(
        Readable.toWeb(
          fileResult.stream as unknown as Readable,
        ) as unknown as ReadableStream,
        {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(fileResult.row.sizeBytes),
            "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
            "Cache-Control": "private, max-age=3600",
          },
        },
      );
    }
    // Fallback : fichier perdu → régénère.
  }

  // Cas 2 : régénération dynamique.
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, currentUser.organizationId),
    columns: { name: true },
  });

  const buffer = await generateCpPdf({
    cp: {
      numero: cp.numero,
      periodeMois: cp.periodeMois,
      periodeAnnee: cp.periodeAnnee,
      createdAt: cp.createdAt,
      dueDate: cp.dueDate,
      cumulTravauxHt: cp.cumulTravauxHt,
      cumulCpPrecedentsHt: cp.cumulCpPrecedentsHt,
      brutAPayerHt: cp.brutAPayerHt,
      retenueGarantie: cp.retenueGarantie,
      revisionMontantHt: cp.revisionMontantHt,
      netTtc: cp.netTtc,
      tva: cp.tva,
    },
    lot: cp.lot,
    operation: { name: cp.operation.name },
    situation: cp.situation,
    organization: { name: org?.name ?? "Architask" },
    signedAt: cp.signedAt ?? undefined,
    signedByName: cp.signedByUser?.name,
  });

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
