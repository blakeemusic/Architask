"use server";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { cautions, lots, operations, retentions } from "@/db/schema/operations";
import { upload as uploadFile } from "@/lib/storage/local";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CautionCreateSchema = z.object({
  lotId: z.string().uuid(),
  montant: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  dateEmission: z.coerce.date(),
  dateExpiration: z.coerce.date(),
  banque: z.string().min(1, "Banque obligatoire.").max(160),
  numCaution: z.string().min(1, "N° caution obligatoire.").max(60),
  attachment: z
    .object({
      base64: z.string(),
      mimeType: z.string(),
      filename: z.string(),
    })
    .optional()
    .nullable(),
  /** Si fourni : la caution remplace cette retenue garantie (RBQS). */
  replacesRetentionId: z.string().uuid().optional().nullable(),
});

const CautionUpdateSchema = z.object({
  id: z.string().uuid(),
  montant: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  dateEmission: z.coerce.date().optional(),
  dateExpiration: z.coerce.date().optional(),
  banque: z.string().max(160).optional(),
  numCaution: z.string().max(60).optional(),
  statut: z.enum(["active", "liberee", "expiree"]).optional(),
});

const CautionIdSchema = z.object({ id: z.string().uuid() });
const LotIdSchema = z.object({ lotId: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertCautionBelongsToOrg(id: string, organizationId: string) {
  const c = await db.query.cautions.findFirst({
    where: eq(cautions.id, id),
    with: { lot: { with: { operation: { columns: { id: true, organizationId: true } } } } },
  });
  if (!c || c.lot.operation.organizationId !== organizationId) return null;
  return c;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createCaution(
  rawInput: z.infer<typeof CautionCreateSchema>,
): Promise<ActionResult<typeof cautions.$inferSelect>> {
  return withAction(CautionCreateSchema, rawInput, async (input, { user }) => {
    // Vérifier que le lot appartient bien à l'org.
    const lot = await db.query.lots.findFirst({
      where: eq(lots.id, input.lotId),
      with: { operation: { columns: { id: true, organizationId: true } } },
    });
    if (!lot || lot.operation.organizationId !== user.organizationId) {
      return err("Lot introuvable.", "not_found");
    }
    if (input.dateExpiration <= input.dateEmission) {
      return err(
        "Date d'expiration doit être après la date d'émission.",
        "invalid_date_range",
      );
    }

    let fileId: string | null = null;
    if (input.attachment) {
      const buffer = Buffer.from(input.attachment.base64, "base64");
      const fileResult = await uploadFile({
        organizationId: user.organizationId,
        buffer,
        mimeType: input.attachment.mimeType,
        originalFilename: input.attachment.filename,
        kind: "caution_pdf",
        uploadedBy: user.userId,
      });
      fileId = fileResult.fileId;
    }

    const [row] = await db
      .insert(cautions)
      .values({
        lotId: input.lotId,
        montant: input.montant,
        dateEmission: input.dateEmission,
        dateExpiration: input.dateExpiration,
        banque: input.banque,
        numCaution: input.numCaution,
        statut: "active",
        fileId,
      })
      .returning();

    // Si la caution remplace une retenue garantie → update la retention.
    if (input.replacesRetentionId) {
      // Vérifier que la retention appartient au même lot (et donc à la même org).
      const ret = await db.query.retentions.findFirst({
        where: and(
          eq(retentions.id, input.replacesRetentionId),
          eq(retentions.lotId, input.lotId),
        ),
        columns: { id: true },
      });
      if (ret) {
        await db
          .update(retentions)
          .set({
            substitutedByCautionId: row.id,
            updatedAt: new Date(),
          })
          .where(eq(retentions.id, input.replacesRetentionId));
      }
    }

    revalidatePath(`/operations/${lot.operation.id}`);
    revalidatePath(`/operations/${lot.operation.id}/cautions`);
    return ok(row);
  });
}

export async function updateCaution(
  rawInput: z.infer<typeof CautionUpdateSchema>,
): Promise<ActionResult<typeof cautions.$inferSelect>> {
  return withAction(CautionUpdateSchema, rawInput, async (input, { user }) => {
    const c = await assertCautionBelongsToOrg(input.id, user.organizationId);
    if (!c) return err("Caution introuvable.", "not_found");
    const { id, ...patch } = input;
    const [row] = await db
      .update(cautions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(cautions.id, id))
      .returning();
    revalidatePath(`/operations/${c.lot.operation.id}/cautions`);
    return ok(row);
  });
}

export async function deleteCaution(
  rawInput: z.infer<typeof CautionIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(CautionIdSchema, rawInput, async ({ id }, { user }) => {
    const c = await assertCautionBelongsToOrg(id, user.organizationId);
    if (!c) return err("Caution introuvable.", "not_found");
    // Si elle remplaçait une retenue, on dé-substitue.
    await db
      .update(retentions)
      .set({ substitutedByCautionId: null, updatedAt: new Date() })
      .where(eq(retentions.substitutedByCautionId, id));
    await db.delete(cautions).where(eq(cautions.id, id));
    revalidatePath(`/operations/${c.lot.operation.id}/cautions`);
    return ok({ id });
  });
}

export async function listCautionsByLot(rawInput: z.infer<typeof LotIdSchema>) {
  return withAction(LotIdSchema, rawInput, async ({ lotId }, { user }) => {
    const lot = await db.query.lots.findFirst({
      where: eq(lots.id, lotId),
      with: { operation: { columns: { organizationId: true } } },
    });
    if (!lot || lot.operation.organizationId !== user.organizationId)
      return err("Lot introuvable.", "not_found");
    const rows = await db.query.cautions.findMany({
      where: eq(cautions.lotId, lotId),
      orderBy: [asc(cautions.dateExpiration)],
    });
    return ok(rows);
  });
}

export async function listCautionsByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ operationId }, { user }) => {
    const op = await db.query.operations.findFirst({
      where: and(
        eq(operations.id, operationId),
        eq(operations.organizationId, user.organizationId),
      ),
      columns: { id: true },
    });
    if (!op) return err("Opération introuvable.", "not_found");
    const opLots = await db.query.lots.findMany({
      where: eq(lots.operationId, operationId),
      columns: { id: true },
    });
    const lotIds = opLots.map((l) => l.id);
    if (lotIds.length === 0) return ok([]);
    const rows = await db.query.cautions.findMany({
      where: lotIds.length === 1
        ? eq(cautions.lotId, lotIds[0])
        : undefined,
      orderBy: [asc(cautions.dateExpiration)],
      with: {
        lot: {
          columns: { id: true, numero: true, libelle: true },
          with: { company: { columns: { raisonSociale: true } } },
        },
      },
    });
    // Filtre côté JS si plusieurs lots (Drizzle inArray nécessite import).
    return ok(rows.filter((r) => lotIds.includes(r.lotId)));
  });
}

const ExpiringSoonSchema = z.object({
  thresholdDays: z.number().int().min(1).max(365).default(60),
});

/**
 * Cautions qui expirent dans les <thresholdDays> jours pour toute l'org.
 * Servant les bandeaux d'alerte sur le dashboard agence.
 */
export async function getCautionsExpiringSoon(
  rawInput: z.input<typeof ExpiringSoonSchema> = {},
) {
  return withAction(
    ExpiringSoonSchema,
    rawInput,
    async ({ thresholdDays }, { user }) => {
      const today = new Date();
      const limit = new Date(today);
      limit.setDate(limit.getDate() + thresholdDays);

      // On filtre via la jointure lot → operation pour scoper l'org.
      const rows = await db
        .select({
          caution: cautions,
          lotId: lots.id,
          lotNumero: lots.numero,
          lotLibelle: lots.libelle,
          operationId: operations.id,
          operationName: operations.name,
        })
        .from(cautions)
        .innerJoin(lots, eq(lots.id, cautions.lotId))
        .innerJoin(operations, eq(operations.id, lots.operationId))
        .where(
          and(
            eq(operations.organizationId, user.organizationId),
            eq(cautions.statut, "active"),
            gte(cautions.dateExpiration, today),
            lte(cautions.dateExpiration, limit),
          ),
        )
        .orderBy(asc(cautions.dateExpiration));

      return ok(rows);
    },
  );
}
