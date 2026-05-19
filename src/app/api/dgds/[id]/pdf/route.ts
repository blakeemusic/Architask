import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/auth";
import { dgds } from "@/db/schema/operations";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { generateDgdPdf } from "@/lib/pdf/generateDgdPdf";
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

  const dgd = await db.query.dgds.findFirst({
    where: eq(dgds.id, id),
    with: {
      lot: {
        with: {
          operation: true,
          company: true,
        },
      },
      signedByUser: { columns: { name: true } },
    },
  });
  if (!dgd || dgd.lot.operation.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = `DGD-${dgd.lot.operation.code}-${dgd.lot.numero}.pdf`;

  if (dgd.signedFileId) {
    const fileResult = await getFileForRead(dgd.signedFileId);
    if (
      fileResult?.stream &&
      fileResult.row.organizationId === user.organizationId
    ) {
      return new NextResponse(
        Readable.toWeb(
          fileResult.stream as unknown as Readable,
        ) as unknown as ReadableStream,
        {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(fileResult.row.sizeBytes),
            "Content-Disposition": `${disposition}; filename="${filename}"`,
            "Cache-Control": "private, max-age=3600",
          },
        },
      );
    }
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
    columns: { name: true },
  });

  const buffer = await generateDgdPdf({
    dgd: {
      marcheReviseHt: dgd.marcheReviseHt,
      travauxSupplAcceptesHt: dgd.travauxSupplAcceptesHt,
      penalitesHt: dgd.penalitesHt,
      cumulCpVersesHt: dgd.cumulCpVersesHt,
      soldeHt: dgd.soldeHt,
      soldeTtc: dgd.soldeTtc,
      computedAt: dgd.computedAt,
    },
    lot: dgd.lot,
    operation: { id: dgd.lot.operation.id, name: dgd.lot.operation.name },
    organization: { name: org?.name ?? "Architask" },
    signedAt: dgd.signedAt ?? undefined,
    signedByName: dgd.signedByUser?.name,
  });

  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
