"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { avenants, lots, planningTasks } from "@/db/schema/operations";
import { numberingCounters } from "@/db/schema/finance";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const AvenantCreateSchema = z.object({
  lotId: z.string().uuid(),
  objet: z.string().min(1, "Objet obligatoire.").max(300),
  /** Peut être négatif (avenant en moins). */
  montantHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Montant invalide (positif ou négatif)."),
  impactDelaiJours: z.number().int().default(0),
  dateSignature: z.coerce.date().optional().nullable(),
});

const AvenantUpdateSchema = z.object({
  id: z.string().uuid(),
  objet: z.string().max(300).optional(),
  montantHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/)
    .optional(),
  impactDelaiJours: z.number().int().optional(),
  dateSignature: z.coerce.date().optional().nullable(),
});

const AvenantIdSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function nextAvenantNumero(
  lotId: string,
  organizationId: string,
): Promise<number> {
  const scope = `avenant:${lotId}`;
  const result = await db
    .insert(numberingCounters)
    .values({
      organizationId,
      scope,
      currentValue: 1,
    })
    .onConflictDoUpdate({
      target: [numberingCounters.organizationId, numberingCounters.scope],
      set: {
        currentValue: sql`${numberingCounters.currentValue} + 1`,
      },
    })
    .returning({ currentValue: numberingCounters.currentValue });
  const value = result[0]?.currentValue;
  if (typeof value !== "number") {
    throw new Error("Numérotation avenant impossible.");
  }
  return value;
}

async function assertLotBelongsToOrg(lotId: string, organizationId: string) {
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: {
      operation: { columns: { id: true, organizationId: true } },
    },
  });
  if (!lot || lot.operation.organizationId !== organizationId) return null;
  return lot;
}

/**
 * Calcule la dérive (Σ avenants signés / marché initial) pour warning UI.
 */
async function computeAvenantsDerive(lotId: string): Promise<{
  marcheInitial: number;
  cumulAvenantsSignes: number;
  derivePct: number;
}> {
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: { avenants: { columns: { montantHt: true, statut: true } } },
  });
  const marcheInitial = Number(lot?.montantMarcheHt ?? 0);
  const cumulAvenantsSignes = (lot?.avenants ?? [])
    .filter((a) => a.statut === "signe")
    .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
  const derivePct =
    marcheInitial === 0 ? 0 : (cumulAvenantsSignes / marcheInitial) * 100;
  return { marcheInitial, cumulAvenantsSignes, derivePct };
}

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type AvenantRow = typeof avenants.$inferSelect;

export type AvenantCreateResult = {
  avenant: AvenantRow;
  warnings: string[];
};

export type AvenantSignResult = {
  avenant: AvenantRow;
  derivePct: number;
  warnings: string[];
};

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createAvenant(
  rawInput: z.infer<typeof AvenantCreateSchema>,
): Promise<ActionResult<AvenantCreateResult>> {
  return withAction(AvenantCreateSchema, rawInput, async (input, { user }) => {
    const lot = await assertLotBelongsToOrg(input.lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    if (lot.statut === "en_preparation") {
      return err(
        "Lot non signé : pas d'avenant possible. Signe d'abord le lot.",
        "lot_not_signed",
      );
    }

    const numero = await nextAvenantNumero(input.lotId, user.organizationId);

    const [row] = await db
      .insert(avenants)
      .values({
        lotId: input.lotId,
        numero,
        objet: input.objet,
        montantHt: input.montantHt,
        impactDelaiJours: input.impactDelaiJours,
        dateSignature: input.dateSignature ?? null,
        statut: "brouillon",
      })
      .returning();

    revalidatePath(`/operations/${lot.operation.id}`);
    revalidatePath(`/operations/${lot.operation.id}/lots/${input.lotId}`);
    return ok({ avenant: row, warnings: [] });
  });
}

export async function updateAvenant(
  rawInput: z.infer<typeof AvenantUpdateSchema>,
): Promise<ActionResult<AvenantRow>> {
  return withAction(AvenantUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await db.query.avenants.findFirst({
      where: eq(avenants.id, input.id),
      with: {
        lot: { with: { operation: { columns: { id: true, organizationId: true } } } },
      },
    });
    if (
      !existing ||
      existing.lot.operation.organizationId !== user.organizationId
    )
      return err("Avenant introuvable.", "not_found");
    if (existing.statut === "signe") {
      return err(
        "Avenant signé : non modifiable. Crée un avenant correctif si besoin.",
        "avenant_locked",
      );
    }
    const { id, ...patch } = input;
    const [row] = await db
      .update(avenants)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(avenants.id, id))
      .returning();
    revalidatePath(`/operations/${existing.lot.operation.id}`);
    revalidatePath(`/operations/${existing.lot.operation.id}/lots/${existing.lotId}`);
    return ok(row);
  });
}

export async function deleteAvenant(
  rawInput: z.infer<typeof AvenantIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(AvenantIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.avenants.findFirst({
      where: eq(avenants.id, id),
      with: {
        lot: { with: { operation: { columns: { id: true, organizationId: true } } } },
      },
    });
    if (
      !existing ||
      existing.lot.operation.organizationId !== user.organizationId
    )
      return err("Avenant introuvable.", "not_found");
    if (existing.statut !== "brouillon") {
      return err(
        "Seul un avenant en brouillon peut être supprimé.",
        "avenant_not_draft",
      );
    }
    await db.delete(avenants).where(eq(avenants.id, id));
    revalidatePath(`/operations/${existing.lot.operation.id}`);
    revalidatePath(`/operations/${existing.lot.operation.id}/lots/${existing.lotId}`);
    return ok({ id });
  });
}

/**
 * Signe un avenant : passe statut → signe, set date_signature si manquante,
 * recalcule planning_task.date_fin_prevue (= ancienne fin + impact_delai_jours),
 * et renvoie warning si Σ avenants signés > 15% du marché initial.
 */
export async function signAvenant(
  rawInput: z.infer<typeof AvenantIdSchema>,
): Promise<ActionResult<AvenantSignResult>> {
  return withAction(AvenantIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.avenants.findFirst({
      where: eq(avenants.id, id),
      with: {
        lot: { with: { operation: { columns: { id: true, organizationId: true } } } },
      },
    });
    if (
      !existing ||
      existing.lot.operation.organizationId !== user.organizationId
    )
      return err("Avenant introuvable.", "not_found");
    if (existing.statut === "signe")
      return err("Avenant déjà signé.", "already_signed");

    const [row] = await db
      .update(avenants)
      .set({
        statut: "signe",
        dateSignature: existing.dateSignature ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(avenants.id, id))
      .returning();

    // Side-effect : recalcul planning_task du lot.
    if (existing.impactDelaiJours !== 0) {
      const task = await db.query.planningTasks.findFirst({
        where: and(
          eq(planningTasks.operationId, existing.lot.operation.id),
          eq(planningTasks.lotId, existing.lotId),
        ),
      });
      if (task?.dateFinPrevue) {
        const newEnd = new Date(task.dateFinPrevue);
        newEnd.setDate(newEnd.getDate() + existing.impactDelaiJours);
        await db
          .update(planningTasks)
          .set({ dateFinPrevue: newEnd, updatedAt: new Date() })
          .where(eq(planningTasks.id, task.id));
      }
    }

    // Computed warning si dérive > 15%.
    const derive = await computeAvenantsDerive(existing.lotId);
    const warnings: string[] = [];
    if (derive.derivePct > 15) {
      warnings.push(
        `Cumul avenants signés = ${derive.derivePct.toFixed(1)} % du marché initial (seuil 15 %).`,
      );
    }

    revalidatePath(`/operations/${existing.lot.operation.id}`);
    revalidatePath(`/operations/${existing.lot.operation.id}/lots/${existing.lotId}`);
    return ok({ avenant: row, derivePct: derive.derivePct, warnings });
  });
}

const LotIdInputSchema = z.object({ lotId: z.string().uuid() });

export async function listAvenantsByLot(
  rawInput: z.infer<typeof LotIdInputSchema>,
): Promise<ActionResult<AvenantRow[]>> {
  return withAction(LotIdInputSchema, rawInput, async ({ lotId }, { user }) => {
    const lot = await assertLotBelongsToOrg(lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    const rows = await db.query.avenants.findMany({
      where: eq(avenants.lotId, lotId),
      orderBy: [asc(avenants.numero)],
    });
    return ok(rows);
  });
}
