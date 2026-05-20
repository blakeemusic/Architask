"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import {
  honoraireContracts,
  honoraireMissions,
  honoraireSituations,
} from "@/db/schema/honoraires";
import { lots, operations } from "@/db/schema/operations";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { assertMissionsSumValid } from "@/lib/validation/honoraires";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreateContractSchema = z.object({
  operationId: z.string().uuid(),
  moaId: z.string().uuid().optional().nullable(),
  modeFacturation: z.enum(["forfait", "pct_travaux", "mixte"]),
  montantTotalHt: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "TVA invalide.")
    .optional(),
  delaiPaiementJours: z.number().int().min(0).max(180).optional(),
  dateSignature: z.coerce.date().optional().nullable(),
});

const UpdateContractSchema = z.object({
  id: z.string().uuid(),
  moaId: z.string().uuid().optional().nullable(),
  modeFacturation: z.enum(["forfait", "pct_travaux", "mixte"]).optional(),
  montantTotalHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  delaiPaiementJours: z.number().int().min(0).max(180).optional(),
  dateSignature: z.coerce.date().optional().nullable(),
});

const ContractIdSchema = z.object({ id: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function loadContractFull(contractId: string, organizationId: string) {
  const contract = await db.query.honoraireContracts.findFirst({
    where: eq(honoraireContracts.id, contractId),
    with: {
      operation: {
        columns: { id: true, organizationId: true, name: true, code: true },
      },
      moa: { columns: { id: true, raisonSociale: true } },
      missions: { orderBy: [asc(honoraireMissions.ordre)] },
    },
  });
  if (!contract || contract.operation.organizationId !== organizationId)
    return null;
  return contract;
}

async function computeMarcheReference(
  operationId: string,
): Promise<string | null> {
  // Snapshot : somme des marchés HT des lots (signés ou pas, tous lots).
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${lots.montantMarcheHt}), 0)`,
    })
    .from(lots)
    .where(eq(lots.operationId, operationId));
  const total = rows[0]?.total ?? "0";
  return Number(total) > 0 ? total : null;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createContract(
  rawInput: z.input<typeof CreateContractSchema>,
): Promise<ActionResult<typeof honoraireContracts.$inferSelect>> {
  return withAction(CreateContractSchema, rawInput, async (input, { user }) => {
    const op = await db.query.operations.findFirst({
      where: and(
        eq(operations.id, input.operationId),
        eq(operations.organizationId, user.organizationId),
      ),
      columns: { id: true, moaId: true },
    });
    if (!op) return err("Opération introuvable.", "not_found");

    if (!(await canAccessCockpit(user, input.operationId))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }

    const existing = await db.query.honoraireContracts.findFirst({
      where: eq(honoraireContracts.operationId, input.operationId),
      columns: { id: true },
    });
    if (existing) {
      return err(
        "Un contrat d'honoraires existe déjà pour cette opération.",
        "contract_exists",
      );
    }

    const marcheRef = await computeMarcheReference(input.operationId);

    const [row] = await db
      .insert(honoraireContracts)
      .values({
        operationId: input.operationId,
        moaId: input.moaId ?? op.moaId ?? null,
        modeFacturation: input.modeFacturation,
        montantTotalHt: input.montantTotalHt,
        tauxTva: input.tauxTva ?? "20.00",
        delaiPaiementJours: input.delaiPaiementJours ?? 30,
        dateSignature: input.dateSignature ?? null,
        marcheReferenceHt: marcheRef,
        statut: "brouillon",
        createdBy: user.userId,
      })
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "honoraire_contract",
      entityId: row.id,
      action: "created",
      payloadDiff: { montantTotalHt: input.montantTotalHt },
    });

    revalidatePath(`/operations/${input.operationId}/honoraires`);
    return ok(row);
  });
}

export async function updateContract(
  rawInput: z.input<typeof UpdateContractSchema>,
): Promise<ActionResult<typeof honoraireContracts.$inferSelect>> {
  return withAction(UpdateContractSchema, rawInput, async (input, { user }) => {
    const contract = await loadContractFull(input.id, user.organizationId);
    if (!contract) return err("Contrat introuvable.", "not_found");
    if (!(await canAccessCockpit(user, contract.operationId))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (contract.statut === "signe" || contract.statut === "clos") {
      return err(
        "Contrat signé/clos — modifications interdites.",
        "contract_locked",
      );
    }

    const updates: Partial<typeof honoraireContracts.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.moaId !== undefined) updates.moaId = input.moaId;
    if (input.modeFacturation) updates.modeFacturation = input.modeFacturation;
    if (input.montantTotalHt) updates.montantTotalHt = input.montantTotalHt;
    if (input.tauxTva) updates.tauxTva = input.tauxTva;
    if (input.delaiPaiementJours !== undefined)
      updates.delaiPaiementJours = input.delaiPaiementJours;
    if (input.dateSignature !== undefined)
      updates.dateSignature = input.dateSignature;

    const [row] = await db
      .update(honoraireContracts)
      .set(updates)
      .where(eq(honoraireContracts.id, input.id))
      .returning();

    revalidatePath(`/operations/${contract.operationId}/honoraires`);
    return ok(row);
  });
}

export async function signContract(
  rawInput: z.infer<typeof ContractIdSchema>,
): Promise<ActionResult<typeof honoraireContracts.$inferSelect>> {
  return withAction(ContractIdSchema, rawInput, async ({ id }, { user }) => {
    const contract = await loadContractFull(id, user.organizationId);
    if (!contract) return err("Contrat introuvable.", "not_found");
    if (!(await canAccessCockpit(user, contract.operationId))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (contract.statut === "signe" || contract.statut === "clos") {
      return err("Contrat déjà signé.", "already_signed");
    }

    if (contract.missions.length === 0) {
      return err(
        "Ajoute au moins une mission avant de signer le contrat.",
        "missions_empty",
      );
    }

    const check = assertMissionsSumValid(
      contract.missions.map((m) =>
        m.typeValeur === "pct"
          ? {
              typeValeur: "pct" as const,
              pctDuTotal: m.pctDuTotal ?? "0",
            }
          : {
              typeValeur: "montant" as const,
              montantHt: m.montantHt ?? "0",
            },
      ),
      contract.montantTotalHt ?? "0",
    );
    if (!check.ok) {
      return err(check.error, check.code);
    }

    const now = new Date();
    const [signed] = await db
      .update(honoraireContracts)
      .set({
        statut: "signe",
        signedAt: now,
        signedByUserId: user.userId,
        dateSignature: contract.dateSignature ?? now,
        updatedAt: now,
      })
      .where(eq(honoraireContracts.id, id))
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "honoraire_contract",
      entityId: id,
      action: "signed",
      payloadDiff: {
        montantTotalHt: contract.montantTotalHt,
        missionsCount: contract.missions.length,
      },
    });

    revalidatePath(`/operations/${contract.operationId}/honoraires`);
    revalidatePath("/cockpit/honoraires");
    return ok(signed);
  });
}

export async function deleteContract(
  rawInput: z.infer<typeof ContractIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(ContractIdSchema, rawInput, async ({ id }, { user }) => {
    const contract = await loadContractFull(id, user.organizationId);
    if (!contract) return err("Contrat introuvable.", "not_found");
    if (!(await canAccessCockpit(user, contract.operationId))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (contract.statut !== "brouillon") {
      return err(
        "Seul un contrat en brouillon peut être supprimé.",
        "contract_locked",
      );
    }
    const situations = await db.query.honoraireSituations.findMany({
      where: eq(honoraireSituations.contractId, id),
      columns: { id: true },
    });
    if (situations.length > 0) {
      return err(
        "Des notes d'honoraires existent — impossible de supprimer.",
        "situations_exist",
      );
    }
    await db
      .delete(honoraireContracts)
      .where(eq(honoraireContracts.id, id));
    revalidatePath(`/operations/${contract.operationId}/honoraires`);
    return ok({ id });
  });
}

export async function getContractByOperation(
  rawInput: z.infer<typeof OperationIdSchema>,
): Promise<
  ActionResult<{
    contract: typeof honoraireContracts.$inferSelect & {
      missions: Array<typeof honoraireMissions.$inferSelect>;
    };
    cumulFactureHt: string;
    avancementGlobalPct: string;
  } | null>
> {
  return withAction(
    OperationIdSchema,
    rawInput,
    async ({ operationId }, { user }) => {
      const contract = await loadContractFull(operationId, user.organizationId);
      // contract.id is needed; we want by operationId not by id.
      const contractByOp = await db.query.honoraireContracts.findFirst({
        where: eq(honoraireContracts.operationId, operationId),
        with: {
          missions: { orderBy: [asc(honoraireMissions.ordre)] },
        },
      });
      if (!contractByOp) {
        // Préflight permission même sans contrat
        const op = await db.query.operations.findFirst({
          where: and(
            eq(operations.id, operationId),
            eq(operations.organizationId, user.organizationId),
          ),
          columns: { id: true },
        });
        if (!op) return err("Opération introuvable.", "not_found");
        if (!(await canAccessCockpit(user, operationId))) {
          return err("Accès Cockpit refusé.", "forbidden");
        }
        return ok(null);
      }
      // Sanity check org
      const op = await db.query.operations.findFirst({
        where: eq(operations.id, contractByOp.operationId),
        columns: { id: true, organizationId: true },
      });
      if (!op || op.organizationId !== user.organizationId) {
        return err("Opération introuvable.", "not_found");
      }
      if (!(await canAccessCockpit(user, operationId))) {
        return err("Accès Cockpit refusé.", "forbidden");
      }

      // Cumul facturé = Σ des montantHt des situations non-brouillon
      const sitRows = await db.query.honoraireSituations.findMany({
        where: eq(honoraireSituations.contractId, contractByOp.id),
        columns: { montantHt: true, statut: true },
      });
      let cumul = 0;
      for (const s of sitRows) {
        if (s.statut === "brouillon") continue;
        cumul += Number(s.montantHt ?? 0);
      }

      // Avancement global pondéré (Σ pct_mission × avancement_mission)
      const total = Number(contractByOp.montantTotalHt ?? 0);
      let avancementPct = 0;
      if (total > 0) {
        for (const m of contractByOp.missions) {
          const montantMission =
            m.typeValeur === "pct"
              ? (Number(m.pctDuTotal ?? 0) / 100) * total
              : Number(m.montantHt ?? 0);
          const av = Number(m.pctAvancementCourant ?? 0);
          avancementPct += (montantMission * av) / total;
        }
      }

      // Suppress unused
      void contract;
      return ok({
        contract: contractByOp as typeof honoraireContracts.$inferSelect & {
          missions: Array<typeof honoraireMissions.$inferSelect>;
        },
        cumulFactureHt: cumul.toFixed(2),
        avancementGlobalPct: avancementPct.toFixed(2),
      });
    },
  );
}
