import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { getFileForRead } from "@/lib/storage/local";

/**
 * Route protégée pour servir les fichiers privés (PDF décennale, photos, etc.)
 * stockés en local. Vérifie que le fichier appartient à l'organisation du
 * user courant — empêche les leaks cross-org.
 *
 * Sera adaptée pour générer des presigned URLs R2 quand on aura migré le storage.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const result = await getFileForRead(id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Garde-fou multi-tenant : un user d'org A ne doit JAMAIS pouvoir lire un
  // fichier d'org B, même s'il devine l'UUID.
  if (result.row.organizationId !== currentUser.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!result.stream) {
    return NextResponse.json(
      { error: "File missing on disk" },
      { status: 410 },
    );
  }

  return new NextResponse(
    Readable.toWeb(
      result.stream as unknown as Readable,
    ) as unknown as ReadableStream,
    {
      headers: {
        "Content-Type": result.row.mimeType,
        "Content-Length": String(result.row.sizeBytes),
        "Content-Disposition": `inline; filename="${encodeURIComponent(result.row.originalFilename)}"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
