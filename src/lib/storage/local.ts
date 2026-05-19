import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { files } from "@/db/schema/files";

/**
 * Abstraction StorageProvider — implémentation locale en MVP, à swapper
 * vers R2 (ou tout autre object store) sans toucher les call sites.
 *
 * Spec :
 *   upload   → insère une row `files`, écrit le contenu dans .uploads/<orgId>/<uuid>.<ext>
 *   getStream → relit le fichier ; le caller doit vérifier l'auth en amont.
 *   delete   → supprime la row + le fichier disque.
 *
 * Le dossier .uploads/ est dans .gitignore et JAMAIS exposé publiquement.
 * L'accès passe TOUJOURS par /api/files/[id] qui vérifie l'orgId courant.
 */

export type UploadInput = {
  organizationId: string;
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  kind: string;
  uploadedBy?: string;
};

export type UploadResult = {
  fileId: string;
  r2Key: string;
};

const ROOT = path.resolve(process.cwd(), ".uploads");

function extensionFor(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase().replace(".", "");
  if (fromName) return fromName;
  // Fallback minimal mime → ext.
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mimeType] ?? "bin";
}

export async function upload(input: UploadInput): Promise<UploadResult> {
  const ext = extensionFor(input.originalFilename, input.mimeType);
  const uuid = randomUUID();
  const r2Key = `${input.organizationId}/${uuid}.${ext}`;
  const fullPath = path.join(ROOT, r2Key);

  await mkdir(path.dirname(fullPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(fullPath);
    stream.on("error", reject);
    stream.on("finish", () => resolve());
    stream.end(input.buffer);
  });

  const [row] = await db
    .insert(files)
    .values({
      organizationId: input.organizationId,
      r2Key,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      originalFilename: input.originalFilename,
      kind: input.kind,
      uploadedBy: input.uploadedBy ?? null,
    })
    .returning();

  if (!row) {
    // Rollback disque si l'INSERT échoue.
    try {
      await unlink(fullPath);
    } catch {
      // ignore
    }
    throw new Error("Failed to record file in DB");
  }
  return { fileId: row.id, r2Key };
}

export async function getFileForRead(fileId: string) {
  const row = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  });
  if (!row) return null;
  const fullPath = path.join(ROOT, row.r2Key);
  try {
    await stat(fullPath);
  } catch {
    return { row, stream: null as null };
  }
  return {
    row,
    stream: createReadStream(fullPath) as unknown as NodeJS.ReadableStream,
  };
}

export async function deleteFile(fileId: string) {
  const row = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  });
  if (!row) return;
  const fullPath = path.join(ROOT, row.r2Key);
  try {
    await unlink(fullPath);
  } catch {
    // best-effort
  }
  await db.delete(files).where(eq(files.id, fileId));
}
