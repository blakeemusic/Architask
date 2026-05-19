"use server";

import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import { lots, operations, retentions } from "@/db/schema/operations";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

const RetentionIdSchema = z.object({ id: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });
const ExpiringSoonSchema = z.object({
  thresholdDays: z.number().int().min(1).max(365).default(60),
});

async function assertRetentionBelongsToOrg(id: string, organizationId: string) {
  const r = await db.query.retentions.findFirst({
    where: eq(retentions.id, id),
    with: {
      lot: { with: { operation: { columns: { id: true, organizationId: true } } } },
    },
  });
  if (!r || r.lot.operation.organizationId !== organizationId) return null;
  return r;
}

/**
 * Libère manuellement la retenue garantie (côté MOA après vérif un an
 * sans réserve résiduelle). Idempotent : si déjà libérée, on retourne ok.
 */
export async function releaseRetention(
  rawInput: z.infer<typeof RetentionIdSchema>,
): Promise<ActionResult<typeof retentions.$inferSelect>> {
  return withAction(RetentionIdSchema, rawInput, async ({ id }, { user }) => {
    const r = await assertRetentionBelongsToOrg(id, user.organizationId);
    if (!r) return err("Retenue introuvable.", "not_found");
    if (r.statut === "liberee") {
      return ok(r);
    }
    const [row] = await db
      .update(retentions)
      .set({
        statut: "liberee",
        dateLiberationReelle: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(retentions.id, id))
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "retention",
      entityId: id,
      action: "released",
      payloadDiff: { montantRetenu: r.montantRetenu },
    });

    revalidatePath(`/operations/${r.lot.operation.id}/cautions`);
    revalidatePath(`/operations/${r.lot.operation.id}`);
    return ok(row);
  });
}

export async function listRetentionsByOperation(
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
    const rows = await db.query.retentions.findMany({
      orderBy: [asc(retentions.echeanceLiberation)],
      with: {
        lot: {
          columns: { id: true, numero: true, libelle: true },
          with: { company: { columns: { raisonSociale: true } } },
        },
        substitutedByCaution: true,
      },
    });
    return ok(rows.filter((r) => lotIds.includes(r.lotId)));
  });
}

/**
 * Retentions dont l'échéance approche (utilisé sur dashboard agence).
 */
export async function getRetentionsExpiringSoon(
  rawInput: z.input<typeof ExpiringSoonSchema> = {},
) {
  return withAction(ExpiringSoonSchema, rawInput, async ({ thresholdDays }, { user }) => {
    const today = new Date();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + thresholdDays);
    const rows = await db
      .select({
        retention: retentions,
        lotNumero: lots.numero,
        lotLibelle: lots.libelle,
        operationId: operations.id,
        operationName: operations.name,
      })
      .from(retentions)
      .innerJoin(lots, eq(lots.id, retentions.lotId))
      .innerJoin(operations, eq(operations.id, lots.operationId))
      .where(
        and(
          eq(operations.organizationId, user.organizationId),
          eq(retentions.statut, "en_cours"),
          isNull(retentions.substitutedByCautionId),
          gte(retentions.echeanceLiberation, today),
          lte(retentions.echeanceLiberation, limit),
        ),
      )
      .orderBy(asc(retentions.echeanceLiberation));
    return ok(rows);
  });
}
