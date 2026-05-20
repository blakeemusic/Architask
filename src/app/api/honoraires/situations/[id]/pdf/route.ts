import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/auth";
import { honoraireSituations } from "@/db/schema/honoraires";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { generateNhPdf } from "@/lib/pdf/generateNhPdf";
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

  const sit = await db.query.honoraireSituations.findFirst({
    where: eq(honoraireSituations.id, id),
    with: {
      contract: {
        with: {
          operation: {
            columns: {
              id: true,
              code: true,
              name: true,
              organizationId: true,
            },
          },
          moa: { columns: { raisonSociale: true } },
        },
      },
      mission: true,
      signedPdf: true,
    },
  });
  if (
    !sit ||
    sit.contract.operation.organizationId !== user.organizationId
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = `${sit.numero}.pdf`;

  if (sit.signedPdfFileId) {
    const fileResult = await getFileForRead(sit.signedPdfFileId);
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

  const buffer = await generateNhPdf({
    situation: sit,
    mission: sit.mission,
    contract: sit.contract,
    operation: sit.contract.operation,
    moa: sit.contract.moa,
    organization: { name: org?.name ?? "Architask" },
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
