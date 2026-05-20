"use server";

import { Decimal } from "decimal.js";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  honoraireContracts,
  honoraireMissions,
} from "@/db/schema/honoraires";
import { operations } from "@/db/schema/operations";
import { canAccessCockpit } from "@/lib/cockpit-access";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreateMissionSchema = z.object({
  contractId: z.string().uuid(),
  libelle: z.string().min(1, "Libellé obligatoire.").max(200),
  typeValeur: z.enum(["pct", "montant"]),
  pctDuTotal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  montantHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  description: z.string().max(2000).optional(),
});

const UpdateMissionSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string().min(1).max(200).optional(),
  typeValeur: z.enum(["pct", "montant"]).optional(),
  pctDuTotal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  montantHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  description: z.string().max(2000).optional(),
});

const ReorderMissionsSchema = z.object({
  contractId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

const MissionIdSchema = z.object({ id: z.string().uuid() });
const ContractIdSchema = z.object({ contractId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function loadContractForMission(
  contractId: string,
  organizationId: string,
) {
  const contract = await db.query.honoraireContracts.findFirst({
    where: eq(honoraireContracts.id, contractId),
    with: {
      operation: { columns: { id: true, organizationId: true } },
    },
  });
  if (!contract || contract.operation.organizationId !== organizationId)
    return null;
  return contract;
}

function computeMontantCalcule(args: {
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null | undefined;
  montantHt: string | null | undefined;
  montantTotalContrat: string | null;
}): string | null {
  if (args.typeValeur === "pct") {
    if (!args.pctDuTotal || !args.montantTotalContrat) return null;
    return new Decimal(args.montantTotalContrat)
      .mul(args.pctDuTotal)
      .div(100)
      .toFixed(2);
  }
  return args.montantHt ?? null;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createMission(
  rawInput: z.input<typeof CreateMissionSchema>,
): Promise<ActionResult<typeof honoraireMissions.$inferSelect>> {
  return withAction(CreateMissionSchema, rawInput, async (input, { user }) => {
    const contract = await loadContractForMission(
      input.contractId,
      user.organizationId,
    );
    if (!contract) return err("Contrat introuvable.", "not_found");
    if (!(await canAccessCockpit(user, contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (contract.statut === "signe" || contract.statut === "clos") {
      return err(
        "Contrat signé/clos — modifications interdites.",
        "contract_locked",
      );
    }

    if (input.typeValeur === "pct" && !input.pctDuTotal) {
      return err("pctDuTotal obligatoire pour type=pct.", "missing_value");
    }
    if (input.typeValeur === "montant" && !input.montantHt) {
      return err("montantHt obligatoire pour type=montant.", "missing_value");
    }

    // Prochain ordre = max + 1
    const lastRow = await db.query.honoraireMissions.findFirst({
      where: eq(honoraireMissions.contractId, input.contractId),
      orderBy: [sql`${honoraireMissions.ordre} DESC`],
      columns: { ordre: true },
    });
    const nextOrdre = (lastRow?.ordre ?? 0) + 1;

    const montantCalcule = computeMontantCalcule({
      typeValeur: input.typeValeur,
      pctDuTotal: input.pctDuTotal,
      montantHt: input.montantHt,
      montantTotalContrat: contract.montantTotalHt ?? null,
    });

    const [row] = await db
      .insert(honoraireMissions)
      .values({
        contractId: input.contractId,
        libelle: input.libelle,
        ordre: nextOrdre,
        typeValeur: input.typeValeur,
        pctDuTotal: input.typeValeur === "pct" ? input.pctDuTotal : null,
        montantHt: input.typeValeur === "montant" ? input.montantHt : null,
        montantCalcule,
        description: input.description ?? null,
      })
      .returning();

    revalidatePath(`/operations/${contract.operation.id}/honoraires`);
    return ok(row);
  });
}

export async function updateMission(
  rawInput: z.input<typeof UpdateMissionSchema>,
): Promise<ActionResult<typeof honoraireMissions.$inferSelect>> {
  return withAction(UpdateMissionSchema, rawInput, async (input, { user }) => {
    const mission = await db.query.honoraireMissions.findFirst({
      where: eq(honoraireMissions.id, input.id),
      with: {
        contract: {
          with: {
            operation: { columns: { id: true, organizationId: true } },
          },
        },
      },
    });
    if (
      !mission ||
      mission.contract.operation.organizationId !== user.organizationId
    ) {
      return err("Mission introuvable.", "not_found");
    }
    if (!(await canAccessCockpit(user, mission.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (
      mission.contract.statut === "signe" ||
      mission.contract.statut === "clos"
    ) {
      return err(
        "Contrat signé/clos — modifications interdites.",
        "contract_locked",
      );
    }

    const nextType = input.typeValeur ?? mission.typeValeur;
    const nextPct =
      input.pctDuTotal !== undefined ? input.pctDuTotal : mission.pctDuTotal;
    const nextMontant =
      input.montantHt !== undefined ? input.montantHt : mission.montantHt;
    const nextLibelle = input.libelle ?? mission.libelle;
    const nextDescription =
      input.description !== undefined ? input.description : mission.description;

    if (nextType === "pct" && !nextPct) {
      return err("pctDuTotal obligatoire pour type=pct.", "missing_value");
    }
    if (nextType === "montant" && !nextMontant) {
      return err("montantHt obligatoire pour type=montant.", "missing_value");
    }

    const montantCalcule = computeMontantCalcule({
      typeValeur: nextType,
      pctDuTotal: nextPct,
      montantHt: nextMontant,
      montantTotalContrat: mission.contract.montantTotalHt ?? null,
    });

    const [row] = await db
      .update(honoraireMissions)
      .set({
        libelle: nextLibelle,
        typeValeur: nextType,
        pctDuTotal: nextType === "pct" ? nextPct : null,
        montantHt: nextType === "montant" ? nextMontant : null,
        montantCalcule,
        description: nextDescription,
        updatedAt: new Date(),
      })
      .where(eq(honoraireMissions.id, input.id))
      .returning();

    revalidatePath(`/operations/${mission.contract.operation.id}/honoraires`);
    return ok(row);
  });
}

export async function deleteMission(
  rawInput: z.infer<typeof MissionIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(MissionIdSchema, rawInput, async ({ id }, { user }) => {
    const mission = await db.query.honoraireMissions.findFirst({
      where: eq(honoraireMissions.id, id),
      with: {
        contract: {
          with: {
            operation: { columns: { id: true, organizationId: true } },
          },
        },
        situations: { columns: { id: true } },
      },
    });
    if (
      !mission ||
      mission.contract.operation.organizationId !== user.organizationId
    ) {
      return err("Mission introuvable.", "not_found");
    }
    if (!(await canAccessCockpit(user, mission.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (
      mission.contract.statut === "signe" ||
      mission.contract.statut === "clos"
    ) {
      return err(
        "Contrat signé/clos — modifications interdites.",
        "contract_locked",
      );
    }
    if (mission.situations.length > 0) {
      return err(
        "Cette mission a déjà des notes d'honoraires — impossible à supprimer.",
        "situations_exist",
      );
    }
    await db
      .delete(honoraireMissions)
      .where(eq(honoraireMissions.id, id));
    revalidatePath(`/operations/${mission.contract.operation.id}/honoraires`);
    return ok({ id });
  });
}

export async function reorderMissions(
  rawInput: z.input<typeof ReorderMissionsSchema>,
): Promise<ActionResult<{ count: number }>> {
  return withAction(ReorderMissionsSchema, rawInput, async (input, { user }) => {
    const contract = await loadContractForMission(
      input.contractId,
      user.organizationId,
    );
    if (!contract) return err("Contrat introuvable.", "not_found");
    if (!(await canAccessCockpit(user, contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (contract.statut === "signe" || contract.statut === "clos") {
      return err(
        "Contrat signé/clos — modifications interdites.",
        "contract_locked",
      );
    }

    const allMissions = await db.query.honoraireMissions.findMany({
      where: eq(honoraireMissions.contractId, input.contractId),
      columns: { id: true },
    });
    const allIds = new Set(allMissions.map((m) => m.id));
    if (
      input.orderedIds.length !== allIds.size ||
      !input.orderedIds.every((id) => allIds.has(id))
    ) {
      return err(
        "La liste des missions ne correspond pas au contrat.",
        "invalid_order",
      );
    }

    // Étape 1 : push tous les ordres en zone négative pour éviter les
    // collisions sur l'unique (contract_id, ordre).
    await db
      .update(honoraireMissions)
      .set({ ordre: sql`-${honoraireMissions.ordre}` })
      .where(eq(honoraireMissions.contractId, input.contractId));

    // Étape 2 : réécrit les ordres dans le sens fourni.
    let i = 1;
    for (const id of input.orderedIds) {
      await db
        .update(honoraireMissions)
        .set({ ordre: i, updatedAt: new Date() })
        .where(
          and(
            eq(honoraireMissions.id, id),
            eq(honoraireMissions.contractId, input.contractId),
          ),
        );
      i += 1;
    }

    revalidatePath(`/operations/${contract.operation.id}/honoraires`);
    return ok({ count: input.orderedIds.length });
  });
}

export async function listMissions(
  rawInput: z.infer<typeof ContractIdSchema>,
): Promise<
  ActionResult<Array<typeof honoraireMissions.$inferSelect>>
> {
  return withAction(
    ContractIdSchema,
    rawInput,
    async ({ contractId }, { user }) => {
      const contract = await loadContractForMission(
        contractId,
        user.organizationId,
      );
      if (!contract) return err("Contrat introuvable.", "not_found");
      if (!(await canAccessCockpit(user, contract.operation.id))) {
        return err("Accès Cockpit refusé.", "forbidden");
      }
      const missions = await db.query.honoraireMissions.findMany({
        where: eq(honoraireMissions.contractId, contractId),
        orderBy: [asc(honoraireMissions.ordre)],
      });
      // Suppress unused
      void operations;
      return ok(missions);
    },
  );
}
