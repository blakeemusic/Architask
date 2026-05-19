"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { operations, planningTasks } from "@/db/schema/operations";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const MILESTONE_KINDS = [
  "os",
  "demarrage_lot",
  "fin_lot",
  "reception",
  "dgd",
  "libere_retenue",
  "autre",
] as const;

const PlanningTaskCreateSchema = z.object({
  operationId: z.string().uuid(),
  type: z.enum(["lot", "jalon"]),
  lotId: z.string().uuid().optional().nullable(),
  libelle: z.string().min(1).max(160),
  dateDebutPrevue: z.coerce.date().optional().nullable(),
  dateFinPrevue: z.coerce.date().optional().nullable(),
  milestoneKind: z.enum(MILESTONE_KINDS).optional().nullable(),
});

const PlanningTaskUpdateSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string().max(160).optional(),
  dateDebutPrevue: z.coerce.date().optional().nullable(),
  dateFinPrevue: z.coerce.date().optional().nullable(),
  dateDebutReelle: z.coerce.date().optional().nullable(),
  dateFinReelle: z.coerce.date().optional().nullable(),
  statut: z.enum(["a_venir", "en_cours", "termine", "en_retard"]).optional(),
});

const PlanningTaskIdSchema = z.object({ id: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

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
    columns: { id: true },
  });
  return !!op;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export type PlanningTaskRow = typeof planningTasks.$inferSelect;

export async function createPlanningTask(
  rawInput: z.infer<typeof PlanningTaskCreateSchema>,
): Promise<ActionResult<PlanningTaskRow>> {
  return withAction(PlanningTaskCreateSchema, rawInput, async (input, { user }) => {
    if (!(await assertOperationBelongsToOrg(input.operationId, user.organizationId))) {
      return err("Opération introuvable.", "not_found");
    }
    if (
      input.dateDebutPrevue &&
      input.dateFinPrevue &&
      input.dateFinPrevue < input.dateDebutPrevue
    ) {
      return err(
        "La date de fin doit être après la date de début.",
        "invalid_date_range",
      );
    }
    const [row] = await db
      .insert(planningTasks)
      .values({
        operationId: input.operationId,
        type: input.type,
        lotId: input.lotId ?? null,
        libelle: input.libelle,
        dateDebutPrevue: input.dateDebutPrevue ?? null,
        dateFinPrevue: input.dateFinPrevue ?? null,
        milestoneKind: input.milestoneKind ?? null,
      })
      .returning();
    revalidatePath(`/operations/${input.operationId}`);
    return ok(row);
  });
}

export async function updatePlanningTask(
  rawInput: z.infer<typeof PlanningTaskUpdateSchema>,
): Promise<ActionResult<PlanningTaskRow>> {
  return withAction(PlanningTaskUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await db.query.planningTasks.findFirst({
      where: eq(planningTasks.id, input.id),
      with: { operation: { columns: { id: true, organizationId: true } } },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Tâche planning introuvable.", "not_found");

    const { id, ...patch } = input;
    const [row] = await db
      .update(planningTasks)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(planningTasks.id, id))
      .returning();
    revalidatePath(`/operations/${existing.operation.id}`);
    return ok(row);
  });
}

export async function deletePlanningTask(
  rawInput: z.infer<typeof PlanningTaskIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(PlanningTaskIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.planningTasks.findFirst({
      where: eq(planningTasks.id, id),
      with: { operation: { columns: { id: true, organizationId: true } } },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Tâche planning introuvable.", "not_found");
    await db.delete(planningTasks).where(eq(planningTasks.id, id));
    revalidatePath(`/operations/${existing.operation.id}`);
    return ok({ id });
  });
}

export async function listPlanningTasksByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ operationId }, { user }) => {
    if (!(await assertOperationBelongsToOrg(operationId, user.organizationId)))
      return err("Opération introuvable.", "not_found");
    const rows = await db.query.planningTasks.findMany({
      where: eq(planningTasks.operationId, operationId),
      orderBy: [asc(planningTasks.dateDebutPrevue)],
    });
    return ok(rows);
  });
}
