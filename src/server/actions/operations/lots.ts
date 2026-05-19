"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { companies, insurances } from "@/db/schema/annuaire";
import { avenants, lots, operations, planningTasks } from "@/db/schema/operations";
import {
  assertInsuranceValidAtOS,
  type InsuranceForValidation,
} from "@/lib/validation/insurance";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const LotCreateSchema = z.object({
  operationId: z.string().uuid(),
  numero: z
    .string()
    .min(1, "Numéro de lot obligatoire.")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Format invalide (lettres, chiffres, -)."),
  libelle: z.string().min(1, "Libellé obligatoire.").max(160),
  companyId: z.string().uuid(),
  montantMarcheHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Taux TVA invalide.")
    .default("20.00"),
  modeRevision: z.string().max(40).default("BT01"),
  retenueGarantiePct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("5.00"),
  delaiPaiementJours: z.number().int().min(0).max(365).default(30),
  activitesAttendues: z.array(z.string()).default([]),
});

const LotUpdateSchema = LotCreateSchema.partial()
  .omit({ operationId: true })
  .extend({ id: z.string().uuid() });

const LotIdSchema = z.object({ id: z.string().uuid() });

const SignLotSchema = z.object({
  id: z.string().uuid(),
  /** Si true, exécute juste la validation sans toucher la DB. */
  dryRun: z.boolean().default(false),
});

const OperationIdSchema = z.object({ operationId: z.string().uuid() });

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type LotRow = typeof lots.$inferSelect;

export type SignLotResult = {
  canSign: boolean;
  errors: string[];
  warnings: string[];
  /** Renseigné si dryRun=false et succès. */
  lot?: LotRow;
};

// ---------------------------------------------------------------
// CRUD
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

export async function createLot(
  rawInput: z.input<typeof LotCreateSchema>,
): Promise<ActionResult<LotRow>> {
  return withAction(LotCreateSchema, rawInput, async (input, { user }) => {
    const op = await assertOperationBelongsToOrg(
      input.operationId,
      user.organizationId,
    );
    if (!op) return err("Opération introuvable.", "not_found");

    // Vérifier que la company existe dans cette org.
    const c = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, input.companyId),
        eq(companies.organizationId, user.organizationId),
      ),
      columns: { id: true },
    });
    if (!c) return err("Entreprise introuvable dans l'annuaire.", "not_found");

    // Vérifier unicité du numéro dans l'opération.
    const existing = await db.query.lots.findFirst({
      where: and(
        eq(lots.operationId, input.operationId),
        eq(lots.numero, input.numero),
      ),
      columns: { id: true },
    });
    if (existing)
      return err(
        `Le lot n°${input.numero} existe déjà sur cette opération.`,
        "duplicate_numero",
      );

    const [row] = await db
      .insert(lots)
      .values({
        operationId: input.operationId,
        numero: input.numero,
        libelle: input.libelle,
        companyId: input.companyId,
        montantMarcheHt: input.montantMarcheHt,
        tauxTva: input.tauxTva,
        modeRevision: input.modeRevision,
        retenueGarantiePct: input.retenueGarantiePct,
        delaiPaiementJours: input.delaiPaiementJours,
        activitesAttendues: input.activitesAttendues,
        statut: "en_preparation",
      })
      .returning();
    revalidatePath(`/operations/${input.operationId}`);
    return ok(row);
  });
}

export async function updateLot(
  rawInput: z.input<typeof LotUpdateSchema>,
): Promise<ActionResult<LotRow>> {
  return withAction(LotUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await db.query.lots.findFirst({
      where: eq(lots.id, input.id),
      with: { operation: { columns: { organizationId: true, id: true } } },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Lot introuvable.", "not_found");

    // Si le lot est signé, on bloque la modif de companyId ou montant
    // (sauf au sprint Avenants, qui permet d'ajuster le marché via avenants).
    if (existing.statut !== "en_preparation") {
      if (input.companyId && input.companyId !== existing.companyId) {
        return err(
          "Entreprise non modifiable après signature du lot.",
          "lot_locked",
        );
      }
      if (input.montantMarcheHt && input.montantMarcheHt !== existing.montantMarcheHt) {
        return err(
          "Montant marché non modifiable après signature — créer un avenant.",
          "lot_locked",
        );
      }
    }

    const { id, ...patch } = input;
    const [row] = await db
      .update(lots)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(lots.id, id))
      .returning();
    revalidatePath(`/operations/${existing.operation.id}`);
    revalidatePath(`/operations/${existing.operation.id}/lots/${id}`);
    return ok(row);
  });
}

export async function deleteLot(
  rawInput: z.infer<typeof LotIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(LotIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.lots.findFirst({
      where: eq(lots.id, id),
      with: {
        operation: { columns: { organizationId: true, id: true } },
        avenants: { columns: { id: true } },
      },
    });
    if (!existing || existing.operation.organizationId !== user.organizationId)
      return err("Lot introuvable.", "not_found");
    if (existing.statut !== "en_preparation")
      return err(
        "Lot signé : impossible de le supprimer. Archive l'opération si besoin.",
        "lot_locked",
      );
    if (existing.avenants.length > 0)
      return err("Lot avec avenants : supprime d'abord les avenants.", "has_dependencies");
    await db.delete(lots).where(eq(lots.id, id));
    revalidatePath(`/operations/${existing.operation.id}`);
    return ok({ id });
  });
}

export async function listLotsByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ operationId }, { user }) => {
    const op = await assertOperationBelongsToOrg(operationId, user.organizationId);
    if (!op) return err("Opération introuvable.", "not_found");
    const rows = await db.query.lots.findMany({
      where: eq(lots.operationId, operationId),
      orderBy: [asc(lots.numero)],
      with: {
        company: true,
        avenants: { orderBy: [asc(avenants.numero)] },
      },
    });
    return ok(rows);
  });
}

// ---------------------------------------------------------------
// signLot — la pièce centrale (validation décennale NF P03-001 bloquante)
// ---------------------------------------------------------------

export async function signLot(
  rawInput: z.input<typeof SignLotSchema>,
): Promise<ActionResult<SignLotResult>> {
  return withAction<
    z.infer<typeof SignLotSchema>,
    SignLotResult
  >(SignLotSchema, rawInput, async ({ id, dryRun }, { user }) => {
    const lotRow = await db.query.lots.findFirst({
      where: eq(lots.id, id),
      with: {
        operation: { columns: { id: true, organizationId: true, dateOs: true, dateReceptionCible: true, statut: true } },
        company: { columns: { id: true, raisonSociale: true } },
      },
    });
    if (!lotRow || lotRow.operation.organizationId !== user.organizationId)
      return err("Lot introuvable.", "not_found");

    const errors: string[] = [];
    const warnings: string[] = [];

    const cantSign = (): ActionResult<SignLotResult> =>
      ok<SignLotResult>({ canSign: false, errors, warnings });

    if (lotRow.statut !== "en_preparation") {
      errors.push("Ce lot est déjà signé.");
      return cantSign();
    }
    if (!lotRow.operation.dateOs) {
      errors.push("Date d'OS de l'opération manquante. Renseigne-la avant de signer le lot.");
      return cantSign();
    }
    if (!lotRow.companyId) {
      errors.push("Entreprise non renseignée sur le lot.");
      return cantSign();
    }

    // Récupère toutes les attestations de l'entreprise.
    const insRows = await db.query.insurances.findMany({
      where: eq(insurances.companyId, lotRow.companyId),
    });
    const insForCheck: InsuranceForValidation[] = insRows.map((i) => ({
      type: i.type,
      dateDebut: i.dateDebut,
      dateFin: i.dateFin,
      activitesCouvertes: i.activitesCouvertes,
    }));

    const check = assertInsuranceValidAtOS(
      insForCheck,
      lotRow.operation.dateOs,
      lotRow.activitesAttendues,
      lotRow.operation.dateReceptionCible ?? undefined,
    );
    if (!check.ok) {
      errors.push(check.error);
      return cantSign();
    }
    warnings.push(...check.data.warnings);

    if (dryRun) {
      return ok<SignLotResult>({ canSign: true, errors, warnings });
    }

    // Apply : update lot + side-effects (planning task + statut opération).
    const [updated] = await db
      .update(lots)
      .set({
        statut: "signe",
        decennaleCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(lots.id, id))
      .returning();

    // Side-effect 1 : créer la planning_task si pas déjà présente.
    const existingTask = await db.query.planningTasks.findFirst({
      where: and(
        eq(planningTasks.operationId, lotRow.operation.id),
        eq(planningTasks.lotId, id),
      ),
    });
    if (!existingTask) {
      await db.insert(planningTasks).values({
        operationId: lotRow.operation.id,
        lotId: id,
        type: "lot",
        libelle: `Lot ${lotRow.numero} · ${lotRow.libelle}`,
        dateDebutPrevue: lotRow.operation.dateOs,
        dateFinPrevue: lotRow.operation.dateReceptionCible,
        statut: "a_venir",
      });
    }

    // Side-effect 2 : transition opération en_preparation → en_execution
    // au premier lot signé (cf. règle hybride décidée).
    if (lotRow.operation.statut === "en_preparation") {
      await db
        .update(operations)
        .set({ statut: "en_execution", updatedAt: new Date() })
        .where(eq(operations.id, lotRow.operation.id));
    }

    revalidatePath(`/operations/${lotRow.operation.id}`);
    revalidatePath(`/operations/${lotRow.operation.id}/lots/${id}`);
    return ok<SignLotResult>({ canSign: true, errors, warnings, lot: updated });
  });
}

// Suppress unused-on-import warning for sql/lots typing
void sql;
