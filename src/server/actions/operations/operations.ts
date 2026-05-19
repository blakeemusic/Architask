"use server";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  avenants,
  lots,
  operations,
  planningTasks,
} from "@/db/schema/operations";
import {
  computeMarcheReviseFromLots,
  computeTemporalAvancement,
} from "@/lib/operations-compute";
import {
  proposeOperationCode,
  validateOperationCode,
} from "@/lib/validation/operations";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const AddressFields = {
  adresseLigne1: z.string().max(160).optional().nullable(),
  adresseLigne2: z.string().max(160).optional().nullable(),
  codePostal: z.string().max(10).optional().nullable(),
  ville: z.string().max(80).optional().nullable(),
  pays: z.string().max(60).optional().nullable(),
};

const OperationCreateSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Z0-9-]{2,8}$/, "Code = 2 à 8 caractères [A-Z0-9-]."),
  name: z.string().min(1, "Nom obligatoire.").max(160),
  moaId: z.string().uuid().optional().nullable(),
  ...AddressFields,
  dateOs: z.coerce.date().optional().nullable(),
  dateReceptionCible: z.coerce.date().optional().nullable(),
  dureePrevueJours: z.number().int().min(0).max(3650).optional().nullable(),
  montantPrevisionnelHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide.")
    .optional()
    .nullable(),
  pilotUserId: z.string().uuid().optional().nullable(),
});

const OperationUpdateSchema = OperationCreateSchema.partial()
  .omit({ code: true })
  .extend({ id: z.string().uuid() });

const OperationIdSchema = z.object({ id: z.string().uuid() });

const ListOperationsSchema = z.object({
  search: z.string().optional(),
  statuts: z
    .array(
      z.enum([
        "en_preparation",
        "signe",
        "en_execution",
        "en_reception",
        "dgd",
        "clos",
      ]),
    )
    .optional(),
  includeArchived: z.boolean().default(false),
});

const ProposeCodeSchema = z.object({ name: z.string().min(1) });

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type OperationRow = typeof operations.$inferSelect;

export type OperationListItem = OperationRow & {
  lotsCount: number;
  marcheReviseHt: string;
  pctAvancementTemporel: number;
  moaName: string | null;
};

export type OperationsKpis = {
  totalActive: number;
  totalUpcoming: number;
  volumeEngageHt: string;
  alertsCount: number;
};

// ---------------------------------------------------------------
// Actions — Code helper
// ---------------------------------------------------------------

export async function getProposedOperationCode(
  rawInput: z.infer<typeof ProposeCodeSchema>,
): Promise<ActionResult<{ code: string }>> {
  return withAction(ProposeCodeSchema, rawInput, async ({ name }, { user }) => {
    const rows = await db
      .select({ code: operations.code })
      .from(operations)
      .where(eq(operations.organizationId, user.organizationId));
    const code = proposeOperationCode(
      name,
      rows.map((r) => r.code),
    );
    return ok({ code });
  });
}

// ---------------------------------------------------------------
// Actions — CRUD
// ---------------------------------------------------------------

export async function createOperation(
  rawInput: z.infer<typeof OperationCreateSchema>,
): Promise<ActionResult<OperationRow>> {
  return withAction(OperationCreateSchema, rawInput, async (input, { user }) => {
    // Vérifier unicité du code dans l'org.
    const existingCodes = (
      await db
        .select({ code: operations.code })
        .from(operations)
        .where(eq(operations.organizationId, user.organizationId))
    ).map((r) => r.code);
    const codeCheck = validateOperationCode(input.code, existingCodes);
    if (!codeCheck.ok) return err(codeCheck.error, codeCheck.code);

    if (
      input.dateOs &&
      input.dateReceptionCible &&
      input.dateReceptionCible <= input.dateOs
    ) {
      return err(
        "La date de réception cible doit être après la date d'OS.",
        "invalid_date_range",
      );
    }

    const [row] = await db
      .insert(operations)
      .values({
        organizationId: user.organizationId,
        code: codeCheck.data,
        name: input.name,
        moaId: input.moaId ?? null,
        adresseLigne1: input.adresseLigne1 ?? null,
        adresseLigne2: input.adresseLigne2 ?? null,
        codePostal: input.codePostal ?? null,
        ville: input.ville ?? null,
        pays: input.pays ?? "France",
        dateOs: input.dateOs ?? null,
        dateReceptionCible: input.dateReceptionCible ?? null,
        dureePrevueJours: input.dureePrevueJours ?? null,
        montantPrevisionnelHt: input.montantPrevisionnelHt ?? null,
        pilotUserId: input.pilotUserId ?? null,
        createdBy: user.userId,
        statut: "en_preparation",
      })
      .returning();

    // Auto-création des jalons globaux à partir des dates contractuelles.
    if (input.dateOs) {
      await db.insert(planningTasks).values({
        operationId: row.id,
        type: "jalon",
        libelle: "Ordre de service",
        dateDebutPrevue: input.dateOs,
        dateFinPrevue: input.dateOs,
        milestoneKind: "os",
      });
    }
    if (input.dateReceptionCible) {
      await db.insert(planningTasks).values({
        operationId: row.id,
        type: "jalon",
        libelle: "Réception",
        dateDebutPrevue: input.dateReceptionCible,
        dateFinPrevue: input.dateReceptionCible,
        milestoneKind: "reception",
      });
    }

    revalidatePath("/operations");
    return ok(row);
  });
}

export async function updateOperation(
  rawInput: z.infer<typeof OperationUpdateSchema>,
): Promise<ActionResult<OperationRow>> {
  return withAction(OperationUpdateSchema, rawInput, async (input, { user }) => {
    const { id, ...patch } = input;
    const existing = await db.query.operations.findFirst({
      where: and(
        eq(operations.id, id),
        eq(operations.organizationId, user.organizationId),
      ),
    });
    if (!existing) return err("Opération introuvable.", "not_found");

    const [row] = await db
      .update(operations)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(operations.id, id),
          eq(operations.organizationId, user.organizationId),
        ),
      )
      .returning();
    revalidatePath("/operations");
    revalidatePath(`/operations/${id}`);
    return ok(row);
  });
}

export async function archiveOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(OperationIdSchema, rawInput, async ({ id }, { user }) => {
    const [row] = await db
      .update(operations)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(operations.id, id),
          eq(operations.organizationId, user.organizationId),
        ),
      )
      .returning({ id: operations.id });
    if (!row) return err("Opération introuvable.", "not_found");
    revalidatePath("/operations");
    return ok({ id: row.id });
  });
}

export async function deleteOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(OperationIdSchema, rawInput, async ({ id }, { user }) => {
    const lotCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lots)
      .where(eq(lots.operationId, id));
    const n = lotCount[0]?.count ?? 0;
    if (n > 0) {
      return err(
        `Opération avec ${n} lot${n > 1 ? "s" : ""} — archive-la plutôt.`,
        "has_dependencies",
      );
    }
    const [row] = await db
      .delete(operations)
      .where(
        and(
          eq(operations.id, id),
          eq(operations.organizationId, user.organizationId),
        ),
      )
      .returning({ id: operations.id });
    if (!row) return err("Opération introuvable.", "not_found");
    revalidatePath("/operations");
    return ok({ id: row.id });
  });
}

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function listOperations(
  rawInput: z.input<typeof ListOperationsSchema> = {},
): Promise<ActionResult<OperationListItem[]>> {
  return withAction(ListOperationsSchema, rawInput, async (input, { user }) => {
    const filters = [eq(operations.organizationId, user.organizationId)];
    if (!input.includeArchived) filters.push(isNull(operations.archivedAt));
    if (input.statuts && input.statuts.length > 0) {
      filters.push(inArray(operations.statut, input.statuts));
    }
    if (input.search) {
      const term = `%${input.search}%`;
      const f = or(
        ilike(operations.name, term),
        ilike(operations.code, term),
      );
      if (f) filters.push(f);
    }

    const rows = await db.query.operations.findMany({
      where: and(...filters),
      orderBy: [desc(operations.updatedAt)],
      with: {
        moa: { columns: { raisonSociale: true } },
        lots: {
          columns: { id: true, montantMarcheHt: true },
          with: {
            avenants: {
              columns: { montantHt: true, statut: true },
            },
          },
        },
      },
      limit: 200,
    });

    const today = new Date();
    return ok(
      rows.map((op) => {
        const marcheRevise = computeMarcheReviseFromLots(op.lots);
        return {
          ...stripNested(op),
          lotsCount: op.lots.length,
          marcheReviseHt: marcheRevise,
          pctAvancementTemporel: computeTemporalAvancement(
            op.dateOs,
            op.dateReceptionCible,
            today,
          ),
          moaName: op.moa?.raisonSociale ?? null,
        };
      }),
    );
  });
}

export async function getOperationById(
  rawInput: z.infer<typeof OperationIdSchema>,
) {
  return withAction(OperationIdSchema, rawInput, async ({ id }, { user }) => {
    const op = await db.query.operations.findFirst({
      where: and(
        eq(operations.id, id),
        eq(operations.organizationId, user.organizationId),
      ),
      with: {
        moa: true,
        pilot: { columns: { id: true, name: true, email: true } },
        lots: {
          orderBy: [asc(lots.numero)],
          with: {
            company: true,
            avenants: { orderBy: [asc(avenants.numero)] },
          },
        },
        stakeholders: true,
        planningTasks: { orderBy: [asc(planningTasks.dateDebutPrevue)] },
      },
    });
    if (!op) return err("Opération introuvable.", "not_found");
    return ok(op);
  });
}

export async function getOperationsKpis(): Promise<ActionResult<OperationsKpis>> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    // 4 KPIs en une seule query agrégée.
    const ACTIVE_STATUTS = [
      "signe",
      "en_execution",
      "en_reception",
    ] as const;

    const [counts] = await db
      .select({
        active: sql<number>`count(*) FILTER (WHERE ${operations.statut} IN ('signe','en_execution','en_reception'))::int`,
        upcoming: sql<number>`count(*) FILTER (WHERE ${operations.statut} = 'en_preparation')::int`,
      })
      .from(operations)
      .where(
        and(
          eq(operations.organizationId, user.organizationId),
          isNull(operations.archivedAt),
        ),
      );

    // Volume engagé : SUM marché révisé sur les opérations actives.
    const opsActives = await db.query.operations.findMany({
      where: and(
        eq(operations.organizationId, user.organizationId),
        isNull(operations.archivedAt),
        inArray(operations.statut, [...ACTIVE_STATUTS]),
      ),
      with: {
        lots: {
          columns: { montantMarcheHt: true },
          with: { avenants: { columns: { montantHt: true, statut: true } } },
        },
      },
    });
    const volume = opsActives.reduce(
      (acc, op) => acc + Number(computeMarcheReviseFromLots(op.lots)),
      0,
    );

    // Alertes : opérations dont Σ avenants signés > 15% du marché initial.
    let alertsCount = 0;
    for (const op of opsActives) {
      const marcheInitial = op.lots.reduce(
        (s, l) => s + Number(l.montantMarcheHt ?? 0),
        0,
      );
      if (marcheInitial === 0) continue;
      const avenantsSignes = op.lots.reduce(
        (s, l) =>
          s +
          l.avenants
            .filter((a) => a.statut === "signe")
            .reduce((ss, a) => ss + Number(a.montantHt ?? 0), 0),
        0,
      );
      if (avenantsSignes / marcheInitial > 0.15) alertsCount += 1;
    }

    return ok({
      totalActive: counts?.active ?? 0,
      totalUpcoming: counts?.upcoming ?? 0,
      volumeEngageHt: volume.toFixed(2),
      alertsCount,
    });
  });
}

// ---------------------------------------------------------------
// Helpers internes (computed)
// ---------------------------------------------------------------

function stripNested<T extends object>(
  row: T & { moa?: unknown; lots?: unknown },
): Omit<T, "moa" | "lots"> {
  const { moa: _m, lots: _l, ...rest } = row as T & {
    moa?: unknown;
    lots?: unknown;
  };
  void _m;
  void _l;
  return rest;
}

// Suppress unused-on-import warnings
void ne;
