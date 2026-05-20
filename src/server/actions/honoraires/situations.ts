"use server";

import { Decimal } from "decimal.js";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import {
  honoraireContracts,
  honoraireMissions,
  honoraireSituations,
} from "@/db/schema/honoraires";
import { operations } from "@/db/schema/operations";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { assertAvancementMonotone } from "@/lib/validation/honoraires";
import { nextNHNumber } from "@/lib/validation/numbering";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreateSituationSchema = z.object({
  missionId: z.string().uuid(),
  pctAvancementNouveau: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Avancement invalide."),
  dateEmission: z.coerce.date().optional(),
});

const UpdateSituationSchema = z.object({
  id: z.string().uuid(),
  pctAvancementNouveau: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  dateEmission: z.coerce.date().optional(),
});

const SituationIdSchema = z.object({ id: z.string().uuid() });
const ContractIdSchema = z.object({ contractId: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });
const MissionIdSchema = z.object({ missionId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function loadSituationFull(situationId: string, organizationId: string) {
  const sit = await db.query.honoraireSituations.findFirst({
    where: eq(honoraireSituations.id, situationId),
    with: {
      contract: {
        with: {
          operation: {
            columns: {
              id: true,
              organizationId: true,
              name: true,
              code: true,
            },
          },
          moa: { columns: { id: true, raisonSociale: true } },
        },
      },
      mission: true,
    },
  });
  if (!sit || sit.contract.operation.organizationId !== organizationId)
    return null;
  return sit;
}

function computeAmounts(args: {
  pctAvancementPrecedent: string;
  pctAvancementNouveau: string;
  montantMissionHt: string;
  tauxTva: string;
}): { montantHt: string; montantTva: string; montantTtc: string } {
  const delta = new Decimal(args.pctAvancementNouveau).minus(
    args.pctAvancementPrecedent,
  );
  const montantHt = delta
    .div(100)
    .mul(args.montantMissionHt)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);
  const montantTva = montantHt
    .mul(args.tauxTva)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);
  const montantTtc = montantHt.plus(montantTva);
  return {
    montantHt: montantHt.toFixed(2),
    montantTva: montantTva.toFixed(2),
    montantTtc: montantTtc.toFixed(2),
  };
}

function missionMontantHt(args: {
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null;
  montantHt: string | null;
  montantTotalContrat: string;
}): string {
  if (args.typeValeur === "pct") {
    return new Decimal(args.montantTotalContrat)
      .mul(args.pctDuTotal ?? "0")
      .div(100)
      .toFixed(2);
  }
  return args.montantHt ?? "0";
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createSituation(
  rawInput: z.input<typeof CreateSituationSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(CreateSituationSchema, rawInput, async (input, { user }) => {
    const mission = await db.query.honoraireMissions.findFirst({
      where: eq(honoraireMissions.id, input.missionId),
      with: {
        contract: {
          with: {
            operation: {
              columns: {
                id: true,
                organizationId: true,
                name: true,
                code: true,
              },
            },
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
    if (mission.contract.statut !== "signe" && mission.contract.statut !== "en_execution") {
      return err(
        "Le contrat doit être signé avant d'émettre des notes d'honoraires.",
        "contract_not_signed",
      );
    }

    const pctPrec = mission.pctAvancementCourant ?? "0";
    const check = assertAvancementMonotone(pctPrec, input.pctAvancementNouveau);
    if (!check.ok) {
      return err(check.error, check.code);
    }

    if (!mission.contract.montantTotalHt) {
      return err("Montant total du contrat manquant.", "missing_total");
    }

    const montantMission = missionMontantHt({
      typeValeur: mission.typeValeur,
      pctDuTotal: mission.pctDuTotal,
      montantHt: mission.montantHt,
      montantTotalContrat: mission.contract.montantTotalHt,
    });

    const amounts = computeAmounts({
      pctAvancementPrecedent: pctPrec,
      pctAvancementNouveau: input.pctAvancementNouveau,
      montantMissionHt: montantMission,
      tauxTva: mission.contract.tauxTva,
    });

    const dateEm = input.dateEmission ?? new Date();
    const numbering = await nextNHNumber({
      organizationId: user.organizationId,
      operationCode: mission.contract.operation.code,
      operationId: mission.contract.operation.id,
      year: dateEm.getFullYear(),
    });

    const [row] = await db
      .insert(honoraireSituations)
      .values({
        contractId: mission.contract.id,
        missionId: mission.id,
        numero: numbering.numero,
        dateEmission: dateEm,
        pctAvancementPrecedent: pctPrec,
        pctAvancementNouveau: input.pctAvancementNouveau,
        montantHt: amounts.montantHt,
        montantTva: amounts.montantTva,
        montantTtc: amounts.montantTtc,
        statut: "brouillon",
        createdBy: user.userId,
      })
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "honoraire_situation",
      entityId: row.id,
      action: "created",
      payloadDiff: {
        numero: row.numero,
        montantHt: amounts.montantHt,
        pctAvancementNouveau: input.pctAvancementNouveau,
      },
    });

    revalidatePath(`/operations/${mission.contract.operation.id}/honoraires`);
    return ok(row);
  });
}

export async function updateSituation(
  rawInput: z.input<typeof UpdateSituationSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(UpdateSituationSchema, rawInput, async (input, { user }) => {
    const sit = await loadSituationFull(input.id, user.organizationId);
    if (!sit) return err("Note d'honoraires introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut !== "brouillon" && sit.statut !== "a_valider") {
      return err(
        "Note signée/envoyée — non modifiable.",
        "situation_locked",
      );
    }

    const updates: Partial<typeof honoraireSituations.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.pctAvancementNouveau !== undefined) {
      const check = assertAvancementMonotone(
        sit.pctAvancementPrecedent,
        input.pctAvancementNouveau,
      );
      if (!check.ok) return err(check.error, check.code);

      const montantMission = missionMontantHt({
        typeValeur: sit.mission.typeValeur,
        pctDuTotal: sit.mission.pctDuTotal,
        montantHt: sit.mission.montantHt,
        montantTotalContrat: sit.contract.montantTotalHt ?? "0",
      });
      const amounts = computeAmounts({
        pctAvancementPrecedent: sit.pctAvancementPrecedent,
        pctAvancementNouveau: input.pctAvancementNouveau,
        montantMissionHt: montantMission,
        tauxTva: sit.contract.tauxTva,
      });
      updates.pctAvancementNouveau = input.pctAvancementNouveau;
      updates.montantHt = amounts.montantHt;
      updates.montantTva = amounts.montantTva;
      updates.montantTtc = amounts.montantTtc;
    }
    if (input.dateEmission) updates.dateEmission = input.dateEmission;

    const [row] = await db
      .update(honoraireSituations)
      .set(updates)
      .where(eq(honoraireSituations.id, input.id))
      .returning();

    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    return ok(row);
  });
}

export async function requestSituationValidation(
  rawInput: z.infer<typeof SituationIdSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await loadSituationFull(id, user.organizationId);
    if (!sit) return err("Note introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut !== "brouillon") {
      return err("Note déjà transmise.", "already_submitted");
    }
    const [row] = await db
      .update(honoraireSituations)
      .set({ statut: "a_valider", updatedAt: new Date() })
      .where(eq(honoraireSituations.id, id))
      .returning();
    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    return ok(row);
  });
}

export async function signSituation(
  rawInput: z.infer<typeof SituationIdSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await loadSituationFull(id, user.organizationId);
    if (!sit) return err("Note introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut === "signee" || sit.statut === "envoyee" || sit.statut === "payee") {
      return err("Note déjà signée.", "already_signed");
    }
    if (user.role !== "owner" && user.role !== "admin") {
      return err(
        "Seul un Owner ou Admin peut signer une note d'honoraires.",
        "forbidden",
      );
    }

    const { generateNhPdf } = await import("@/lib/pdf/generateNhPdf");
    const { upload: uploadFile } = await import("@/lib/storage/local");

    const org = await db.query.organizations.findFirst({
      where: eq(operations.organizationId, user.organizationId),
      columns: { name: true },
    });

    const pdfBuffer = await generateNhPdf({
      situation: sit,
      mission: sit.mission,
      contract: sit.contract,
      operation: sit.contract.operation,
      moa: sit.contract.moa,
      organization: { name: org?.name ?? "Architask" },
      signedAt: new Date(),
      signedByName: user.name,
    });

    const fileResult = await uploadFile({
      organizationId: user.organizationId,
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      originalFilename: `${sit.numero}.pdf`,
      kind: "honoraire_note_signed",
      uploadedBy: user.userId,
    });

    const now = new Date();
    const [signed] = await db
      .update(honoraireSituations)
      .set({
        statut: "signee",
        signedAt: now,
        signedByUserId: user.userId,
        signedPdfFileId: fileResult.fileId,
        updatedAt: now,
      })
      .where(eq(honoraireSituations.id, id))
      .returning();

    // Side-effect : update mission.pctAvancementCourant
    await db
      .update(honoraireMissions)
      .set({
        pctAvancementCourant: sit.pctAvancementNouveau,
        updatedAt: now,
      })
      .where(eq(honoraireMissions.id, sit.missionId));

    // Si contrat brouillon/à signer, passe en en_execution
    if (sit.contract.statut === "signe") {
      await db
        .update(honoraireContracts)
        .set({ statut: "en_execution", updatedAt: now })
        .where(eq(honoraireContracts.id, sit.contractId));
    }

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "honoraire_situation",
      entityId: id,
      action: "signed",
      payloadDiff: {
        numero: sit.numero,
        montantHt: sit.montantHt,
      },
    });

    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    revalidatePath("/cockpit/honoraires");
    return ok(signed);
  });
}

export async function markSituationSent(
  rawInput: z.infer<typeof SituationIdSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await loadSituationFull(id, user.organizationId);
    if (!sit) return err("Note introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut !== "signee") {
      return err("Seule une note signée peut passer en 'envoyée'.", "invalid_status");
    }
    const [row] = await db
      .update(honoraireSituations)
      .set({ statut: "envoyee", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(honoraireSituations.id, id))
      .returning();
    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    revalidatePath("/cockpit/honoraires");
    return ok(row);
  });
}

export async function markSituationPaid(
  rawInput: z.infer<typeof SituationIdSchema>,
): Promise<ActionResult<typeof honoraireSituations.$inferSelect>> {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await loadSituationFull(id, user.organizationId);
    if (!sit) return err("Note introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut !== "envoyee" && sit.statut !== "signee") {
      return err(
        "Note doit être signée ou envoyée pour marquer payée.",
        "invalid_status",
      );
    }
    const [row] = await db
      .update(honoraireSituations)
      .set({ statut: "payee", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(honoraireSituations.id, id))
      .returning();
    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    revalidatePath("/cockpit/honoraires");
    return ok(row);
  });
}

export async function deleteSituation(
  rawInput: z.infer<typeof SituationIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await loadSituationFull(id, user.organizationId);
    if (!sit) return err("Note introuvable.", "not_found");
    if (!(await canAccessCockpit(user, sit.contract.operation.id))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    if (sit.statut !== "brouillon") {
      return err(
        "Seul un brouillon peut être supprimé.",
        "situation_locked",
      );
    }
    await db
      .delete(honoraireSituations)
      .where(eq(honoraireSituations.id, id));
    revalidatePath(`/operations/${sit.contract.operation.id}/honoraires`);
    return ok({ id });
  });
}

export async function listSituationsByContract(
  rawInput: z.infer<typeof ContractIdSchema>,
): Promise<
  ActionResult<
    Array<
      typeof honoraireSituations.$inferSelect & {
        mission: { id: string; libelle: string; ordre: number };
      }
    >
  >
> {
  return withAction(
    ContractIdSchema,
    rawInput,
    async ({ contractId }, { user }) => {
      const contract = await db.query.honoraireContracts.findFirst({
        where: eq(honoraireContracts.id, contractId),
        with: {
          operation: { columns: { id: true, organizationId: true } },
        },
      });
      if (
        !contract ||
        contract.operation.organizationId !== user.organizationId
      ) {
        return err("Contrat introuvable.", "not_found");
      }
      if (!(await canAccessCockpit(user, contract.operation.id))) {
        return err("Accès Cockpit refusé.", "forbidden");
      }
      const situations = await db.query.honoraireSituations.findMany({
        where: eq(honoraireSituations.contractId, contractId),
        orderBy: [desc(honoraireSituations.dateEmission)],
        with: {
          mission: { columns: { id: true, libelle: true, ordre: true } },
        },
      });
      return ok(
        situations as Array<
          typeof honoraireSituations.$inferSelect & {
            mission: { id: string; libelle: string; ordre: number };
          }
        >,
      );
    },
  );
}

export async function previewSituationAmounts(
  rawInput: z.input<typeof CreateSituationSchema>,
): Promise<
  ActionResult<{
    montantHt: string;
    montantTva: string;
    montantTtc: string;
    pctAvancementPrecedent: string;
    delta: string;
  }>
> {
  return withAction(CreateSituationSchema, rawInput, async (input, { user }) => {
    const mission = await db.query.honoraireMissions.findFirst({
      where: eq(honoraireMissions.id, input.missionId),
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
    const pctPrec = mission.pctAvancementCourant ?? "0";
    const check = assertAvancementMonotone(pctPrec, input.pctAvancementNouveau);
    if (!check.ok) return err(check.error, check.code);

    const montantMission = missionMontantHt({
      typeValeur: mission.typeValeur,
      pctDuTotal: mission.pctDuTotal,
      montantHt: mission.montantHt,
      montantTotalContrat: mission.contract.montantTotalHt ?? "0",
    });
    const amounts = computeAmounts({
      pctAvancementPrecedent: pctPrec,
      pctAvancementNouveau: input.pctAvancementNouveau,
      montantMissionHt: montantMission,
      tauxTva: mission.contract.tauxTva,
    });
    return ok({
      ...amounts,
      pctAvancementPrecedent: pctPrec,
      delta: check.data.delta,
    });
  });
}

export async function listOperationsForCockpit(): Promise<
  ActionResult<
    Array<{
      id: string;
      code: string;
      name: string;
      statut: string;
      moaName: string | null;
      contractMontantHt: string | null;
      contractStatut: string | null;
      cumulFactureHt: string;
      avancementGlobalPct: string;
    }>
  >
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const ops = await db.query.operations.findMany({
      where: eq(operations.organizationId, user.organizationId),
      with: {
        moa: { columns: { raisonSociale: true } },
      },
    });
    const opIds = ops.map((o) => o.id);
    if (opIds.length === 0) return ok([]);

    const contracts = await db.query.honoraireContracts.findMany({
      where: eq(honoraireContracts.id, honoraireContracts.id),
      with: {
        missions: true,
        situations: { columns: { contractId: true, montantHt: true, statut: true } },
      },
    });

    const byOp = new Map(
      contracts.map((c) => [c.operationId, c]),
    );

    return ok(
      ops.map((op) => {
        const c = byOp.get(op.id);
        if (!c) {
          return {
            id: op.id,
            code: op.code,
            name: op.name,
            statut: op.statut,
            moaName: op.moa?.raisonSociale ?? null,
            contractMontantHt: null,
            contractStatut: null,
            cumulFactureHt: "0.00",
            avancementGlobalPct: "0.00",
          };
        }
        const total = Number(c.montantTotalHt ?? 0);
        let cumul = 0;
        for (const s of c.situations) {
          if (s.statut === "brouillon") continue;
          cumul += Number(s.montantHt ?? 0);
        }
        let avancementPct = 0;
        if (total > 0) {
          for (const m of c.missions) {
            const montantMission =
              m.typeValeur === "pct"
                ? (Number(m.pctDuTotal ?? 0) / 100) * total
                : Number(m.montantHt ?? 0);
            const av = Number(m.pctAvancementCourant ?? 0);
            avancementPct += (montantMission * av) / total;
          }
        }
        return {
          id: op.id,
          code: op.code,
          name: op.name,
          statut: op.statut,
          moaName: op.moa?.raisonSociale ?? null,
          contractMontantHt: c.montantTotalHt,
          contractStatut: c.statut,
          cumulFactureHt: cumul.toFixed(2),
          avancementGlobalPct: avancementPct.toFixed(2),
        };
      }),
    );
  });
}

export async function listMissionAvancementForCockpit(
  rawInput: z.infer<typeof OperationIdSchema>,
): Promise<
  ActionResult<{
    nextSuggested: Array<{
      missionId: string;
      missionLibelle: string;
      pctAvancementCourant: string;
      operationName: string;
      operationCode: string;
    }>;
  }>
> {
  return withAction(
    OperationIdSchema,
    rawInput,
    async ({ operationId }, { user }) => {
      void user;
      void operationId;
      return ok({ nextSuggested: [] });
    },
  );
}

export async function listRecentSituationsForOrg(): Promise<
  ActionResult<
    Array<{
      id: string;
      numero: string;
      dateEmission: Date;
      montantHt: string;
      statut: string;
      operationCode: string;
      operationName: string;
      missionLibelle: string;
    }>
  >
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const rows = await db.query.honoraireSituations.findMany({
      with: {
        contract: {
          with: {
            operation: {
              columns: {
                id: true,
                code: true,
                name: true,
                organizationId: true,
              },
            },
          },
        },
        mission: { columns: { libelle: true } },
      },
      orderBy: [desc(honoraireSituations.dateEmission)],
      limit: 30,
    });
    const filtered = rows
      .filter(
        (r) => r.contract.operation.organizationId === user.organizationId,
      )
      .slice(0, 10);
    return ok(
      filtered.map((r) => ({
        id: r.id,
        numero: r.numero,
        dateEmission: r.dateEmission,
        montantHt: r.montantHt ?? "0",
        statut: r.statut,
        operationCode: r.contract.operation.code,
        operationName: r.contract.operation.name,
        missionLibelle: r.mission.libelle,
      })),
    );
  });
}

void and;
void MissionIdSchema;
