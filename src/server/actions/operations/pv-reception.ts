"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import { reserves } from "@/db/schema/cr";
import { certificatsPaiement } from "@/db/schema/finance";
import {
  lots,
  operations,
  pvReceptions,
  retentions,
} from "@/db/schema/operations";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreatePvSchema = z.object({
  operationId: z.string().uuid(),
  dateReception: z.coerce.date(),
  avecReserves: z.boolean().default(false),
});

const UpdatePvSchema = z.object({
  id: z.string().uuid(),
  dateReception: z.coerce.date().optional(),
  avecReserves: z.boolean().optional(),
});

const PvIdSchema = z.object({ id: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

const ReserveCreateSchema = z.object({
  operationId: z.string().uuid(),
  lotId: z.string().uuid(),
  description: z.string().min(1, "Description obligatoire."),
  dateReleve: z.coerce.date(),
});

const ReserveUpdateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().optional(),
  statut: z.enum(["a_lever", "en_cours", "levee"]).optional(),
  dateLevee: z.coerce.date().optional().nullable(),
  photoAvantFileId: z.string().uuid().optional().nullable(),
  photoApresFileId: z.string().uuid().optional().nullable(),
});

const ReserveIdSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertOperationBelongsToOrg(
  operationId: string,
  organizationId: string,
) {
  const op = await db.query.operations.findFirst({
    where: and(
      eq(operations.id, operationId),
      eq(operations.organizationId, organizationId),
    ),
  });
  return op ?? null;
}

async function assertPvBelongsToOrg(pvId: string, organizationId: string) {
  const pv = await db.query.pvReceptions.findFirst({
    where: eq(pvReceptions.id, pvId),
    with: { operation: { columns: { id: true, organizationId: true } } },
  });
  if (!pv || pv.operation.organizationId !== organizationId) return null;
  return pv;
}

// ---------------------------------------------------------------
// PV — CRUD
// ---------------------------------------------------------------

export async function createPvReception(
  rawInput: z.input<typeof CreatePvSchema>,
): Promise<ActionResult<typeof pvReceptions.$inferSelect>> {
  return withAction(CreatePvSchema, rawInput, async (input, { user }) => {
    const op = await assertOperationBelongsToOrg(
      input.operationId,
      user.organizationId,
    );
    if (!op) return err("Opération introuvable.", "not_found");

    // 1:1 — préflight check
    const existing = await db.query.pvReceptions.findFirst({
      where: eq(pvReceptions.operationId, input.operationId),
      columns: { id: true },
    });
    if (existing) {
      return err(
        "Un PV de réception existe déjà pour cette opération.",
        "pv_exists",
      );
    }

    const [row] = await db
      .insert(pvReceptions)
      .values({
        operationId: input.operationId,
        dateReception: input.dateReception,
        avecReserves: input.avecReserves ? "oui" : "non",
      })
      .returning();
    revalidatePath(`/operations/${input.operationId}`);
    revalidatePath(`/operations/${input.operationId}/reception`);
    return ok(row);
  });
}

export async function updatePvReception(
  rawInput: z.infer<typeof UpdatePvSchema>,
): Promise<ActionResult<typeof pvReceptions.$inferSelect>> {
  return withAction(UpdatePvSchema, rawInput, async (input, { user }) => {
    const pv = await assertPvBelongsToOrg(input.id, user.organizationId);
    if (!pv) return err("PV introuvable.", "not_found");
    if (pv.signedAt) {
      return err("PV signé — non modifiable.", "pv_signed");
    }
    const { id, avecReserves, ...patch } = input;
    const [row] = await db
      .update(pvReceptions)
      .set({
        ...patch,
        avecReserves:
          avecReserves !== undefined
            ? avecReserves
              ? "oui"
              : "non"
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(pvReceptions.id, id))
      .returning();
    revalidatePath(`/operations/${pv.operation.id}/reception`);
    return ok(row);
  });
}

/**
 * signPvReception — mock signature (MVP, comme signCP).
 *
 * Side-effects critiques :
 *  - statut opération → 'en_reception' (si pas déjà avancé en dgd/clos)
 *  - création des retentions pour chaque lot signé du chantier avec
 *    montantRetenu = Σ retenue_garantie des CP non-brouillon du lot,
 *    dateReceptionLot = pv.dateReception,
 *    echeanceLiberation = dateReception + 1 an (NF P03-001).
 */
export async function signPvReception(
  rawInput: z.infer<typeof PvIdSchema>,
): Promise<ActionResult<typeof pvReceptions.$inferSelect>> {
  return withAction(PvIdSchema, rawInput, async ({ id }, { user }) => {
    const pv = await assertPvBelongsToOrg(id, user.organizationId);
    if (!pv) return err("PV introuvable.", "not_found");
    if (pv.signedAt) return err("PV déjà signé.", "already_signed");

    const [signed] = await db
      .update(pvReceptions)
      .set({
        signedAt: new Date(),
        signedByUserId: user.userId,
        updatedAt: new Date(),
      })
      .where(eq(pvReceptions.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "pv_reception",
      entityId: id,
      action: "signed",
      payloadDiff: { dateReception: pv.dateReception.toISOString() },
    });

    // Side-effect 1 : opération → en_reception (si pas déjà plus avancée).
    const op = await db.query.operations.findFirst({
      where: eq(operations.id, pv.operationId),
      columns: { statut: true },
    });
    if (op && ["en_preparation", "signe", "en_execution"].includes(op.statut)) {
      await db
        .update(operations)
        .set({ statut: "en_reception", updatedAt: new Date() })
        .where(eq(operations.id, pv.operationId));
    }

    // Side-effect 2 : créer les retentions pour chaque lot signé du chantier.
    // On ne fait pas de nested fetch lot→cps (relation non définie côté
    // schema relations) — on fetch les CP en deux temps.
    const opLots = await db.query.lots.findMany({
      where: eq(lots.operationId, pv.operationId),
      columns: { id: true, statut: true },
    });
    const opCps = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.operationId, pv.operationId),
      columns: { lotId: true, retenueGarantie: true, statut: true },
    });

    const echeance = new Date(pv.dateReception);
    echeance.setFullYear(echeance.getFullYear() + 1);

    for (const lot of opLots) {
      if (lot.statut === "en_preparation") continue;
      const existing = await db.query.retentions.findFirst({
        where: eq(retentions.lotId, lot.id),
        columns: { id: true },
      });
      if (existing) continue;
      const montantRetenu = opCps
        .filter((cp) => cp.lotId === lot.id && cp.statut !== "brouillon")
        .reduce((s, cp) => s + Number(cp.retenueGarantie ?? 0), 0);
      await db.insert(retentions).values({
        lotId: lot.id,
        montantRetenu: montantRetenu.toFixed(2),
        dateReceptionLot: pv.dateReception,
        echeanceLiberation: echeance,
        statut: "en_cours",
      });
    }

    revalidatePath(`/operations/${pv.operationId}`);
    revalidatePath(`/operations/${pv.operationId}/reception`);
    return ok(signed);
  });
}

export async function getPvByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ operationId }, { user }) => {
    if (!(await assertOperationBelongsToOrg(operationId, user.organizationId)))
      return err("Opération introuvable.", "not_found");
    const pv = await db.query.pvReceptions.findFirst({
      where: eq(pvReceptions.operationId, operationId),
      with: {
        signedByUser: { columns: { id: true, name: true } },
      },
    });
    return ok(pv ?? null);
  });
}

// ---------------------------------------------------------------
// Réserves
// ---------------------------------------------------------------

export async function addReserve(
  rawInput: z.infer<typeof ReserveCreateSchema>,
): Promise<ActionResult<typeof reserves.$inferSelect>> {
  return withAction(ReserveCreateSchema, rawInput, async (input, { user }) => {
    const op = await assertOperationBelongsToOrg(input.operationId, user.organizationId);
    if (!op) return err("Opération introuvable.", "not_found");
    // Check lot appartient à l'op
    const lot = await db.query.lots.findFirst({
      where: and(eq(lots.id, input.lotId), eq(lots.operationId, input.operationId)),
      columns: { id: true },
    });
    if (!lot) return err("Lot introuvable sur cette opération.", "not_found");

    const [row] = await db
      .insert(reserves)
      .values({
        operationId: input.operationId,
        lotId: input.lotId,
        description: input.description,
        statut: "a_lever",
        dateReleve: input.dateReleve,
      })
      .returning();
    revalidatePath(`/operations/${input.operationId}/reception`);
    return ok(row);
  });
}

export async function updateReserve(
  rawInput: z.infer<typeof ReserveUpdateSchema>,
): Promise<ActionResult<typeof reserves.$inferSelect>> {
  return withAction(ReserveUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await db.query.reserves.findFirst({
      where: eq(reserves.id, input.id),
      with: { operation: { columns: { id: true, organizationId: true } } },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Réserve introuvable.", "not_found");

    const { id, ...patch } = input;
    // Si on passe en "levée" sans date → set aujourd'hui.
    if (patch.statut === "levee" && !patch.dateLevee && !existing.dateLevee) {
      patch.dateLevee = new Date();
    }
    const [row] = await db
      .update(reserves)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(reserves.id, id))
      .returning();
    revalidatePath(`/operations/${existing.operation.id}/reception`);
    return ok(row);
  });
}

export async function deleteReserve(
  rawInput: z.infer<typeof ReserveIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(ReserveIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.reserves.findFirst({
      where: eq(reserves.id, id),
      with: { operation: { columns: { id: true, organizationId: true } } },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Réserve introuvable.", "not_found");
    await db.delete(reserves).where(eq(reserves.id, id));
    revalidatePath(`/operations/${existing.operation.id}/reception`);
    return ok({ id });
  });
}

export async function listReservesByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ operationId }, { user }) => {
    if (!(await assertOperationBelongsToOrg(operationId, user.organizationId)))
      return err("Opération introuvable.", "not_found");
    const rows = await db.query.reserves.findMany({
      where: eq(reserves.operationId, operationId),
      orderBy: [asc(reserves.dateReleve)],
      with: { lot: { columns: { id: true, numero: true, libelle: true } } },
    });
    return ok(rows);
  });
}

void isNull;
