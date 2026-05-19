"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import { certificatsPaiement } from "@/db/schema/finance";
import { dgds, lots, operations } from "@/db/schema/operations";
import { computeDGD } from "@/lib/finance/computeDGD";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreateDgdSchema = z.object({
  lotId: z.string().uuid(),
  travauxSupplAcceptesHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide.")
    .optional(),
  penalitesHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide.")
    .optional(),
});

const UpdateDgdSchema = z.object({
  id: z.string().uuid(),
  travauxSupplAcceptesHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  penalitesHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
});

const DgdIdSchema = z.object({ id: z.string().uuid() });
const LotIdSchema = z.object({ lotId: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertDgdBelongsToOrg(dgdId: string, organizationId: string) {
  const dgd = await db.query.dgds.findFirst({
    where: eq(dgds.id, dgdId),
    with: {
      lot: {
        with: {
          operation: {
            columns: {
              id: true,
              organizationId: true,
              statut: true,
              name: true,
            },
          },
          avenants: true,
          company: true,
        },
      },
      signedByUser: { columns: { id: true, name: true } },
    },
  });
  if (!dgd || dgd.lot.operation.organizationId !== organizationId) return null;
  return dgd;
}

async function loadLotForDgd(lotId: string, organizationId: string) {
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: {
      operation: {
        columns: {
          id: true,
          organizationId: true,
          statut: true,
          name: true,
        },
      },
      avenants: true,
    },
  });
  if (!lot || lot.operation.organizationId !== organizationId) return null;
  return lot;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createDGD(
  rawInput: z.input<typeof CreateDgdSchema>,
): Promise<ActionResult<typeof dgds.$inferSelect>> {
  return withAction(CreateDgdSchema, rawInput, async (input, { user }) => {
    const lot = await loadLotForDgd(input.lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");

    // Pre-condition : tous les CP du lot doivent être en envoye/paye/signe
    // (pas en brouillon ni a_valider). On autorise les lots sans CP du
    // tout (cas marché annulé).
    const cps = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.lotId, input.lotId),
      columns: { brutAPayerHt: true, statut: true },
    });
    const cpsPending = cps.filter(
      (cp) => cp.statut === "brouillon" || cp.statut === "a_valider",
    );
    if (cpsPending.length > 0) {
      return err(
        `${cpsPending.length} CP du lot n'est pas encore signé/envoyé. Finalise-les avant d'établir le DGD.`,
        "cps_pending",
      );
    }

    // Préflight unicité
    const existing = await db.query.dgds.findFirst({
      where: eq(dgds.lotId, input.lotId),
      columns: { id: true },
    });
    if (existing) {
      return err("Un DGD existe déjà pour ce lot.", "dgd_exists");
    }

    const result = computeDGD({
      lot: {
        montantMarcheHt: lot.montantMarcheHt,
        tauxTva: lot.tauxTva,
        avenantsSignes: lot.avenants
          .filter((a) => a.statut === "signe")
          .map((a) => ({ montantHt: a.montantHt ?? "0" })),
      },
      cps,
      travauxSupplAcceptesHt: input.travauxSupplAcceptesHt,
      penalitesHt: input.penalitesHt,
    });
    if (!result.ok) return err(result.data.error, result.data.code);
    const m = result.data;

    const [row] = await db
      .insert(dgds)
      .values({
        lotId: input.lotId,
        marcheReviseHt: m.marcheReviseHt,
        travauxSupplAcceptesHt: m.travauxSupplAcceptesHt,
        penalitesHt: m.penalitesHt,
        cumulCpVersesHt: m.cumulCpVersesHt,
        soldeHt: m.soldeHt,
        soldeTtc: m.soldeTtc,
        statut: "brouillon",
        computedAt: new Date(),
      })
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "dgd",
      entityId: row.id,
      action: "created",
      payloadDiff: { soldeHt: m.soldeHt, soldeTtc: m.soldeTtc },
    });

    revalidatePath(`/operations/${lot.operation.id}`);
    revalidatePath(`/operations/${lot.operation.id}/dgd`);
    return ok(row);
  });
}

export async function updateDGD(
  rawInput: z.input<typeof UpdateDgdSchema>,
): Promise<ActionResult<typeof dgds.$inferSelect>> {
  return withAction(UpdateDgdSchema, rawInput, async (input, { user }) => {
    const dgd = await assertDgdBelongsToOrg(input.id, user.organizationId);
    if (!dgd) return err("DGD introuvable.", "not_found");
    if (dgd.statut === "signe") {
      return err("DGD signé — non modifiable.", "dgd_signed");
    }

    // Recompute avec les nouveaux inputs.
    const cps = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.lotId, dgd.lotId),
      columns: { brutAPayerHt: true, statut: true },
    });
    const result = computeDGD({
      lot: {
        montantMarcheHt: dgd.lot.montantMarcheHt,
        tauxTva: dgd.lot.tauxTva,
        avenantsSignes: dgd.lot.avenants
          .filter((a) => a.statut === "signe")
          .map((a) => ({ montantHt: a.montantHt ?? "0" })),
      },
      cps,
      travauxSupplAcceptesHt:
        input.travauxSupplAcceptesHt ?? dgd.travauxSupplAcceptesHt,
      penalitesHt: input.penalitesHt ?? dgd.penalitesHt,
    });
    if (!result.ok) return err(result.data.error, result.data.code);
    const m = result.data;

    const [row] = await db
      .update(dgds)
      .set({
        marcheReviseHt: m.marcheReviseHt,
        travauxSupplAcceptesHt: m.travauxSupplAcceptesHt,
        penalitesHt: m.penalitesHt,
        cumulCpVersesHt: m.cumulCpVersesHt,
        soldeHt: m.soldeHt,
        soldeTtc: m.soldeTtc,
        computedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dgds.id, input.id))
      .returning();

    revalidatePath(`/operations/${dgd.lot.operation.id}/dgd`);
    return ok(row);
  });
}

/**
 * signDGD — mock signature MVP. Génère le PDF figé, set statut signe.
 * Side-effect : si TOUS les lots de l'op ont un DGD signé → op statut = dgd.
 */
export async function signDGD(
  rawInput: z.infer<typeof DgdIdSchema>,
): Promise<ActionResult<typeof dgds.$inferSelect>> {
  return withAction(DgdIdSchema, rawInput, async ({ id }, { user }) => {
    const dgd = await assertDgdBelongsToOrg(id, user.organizationId);
    if (!dgd) return err("DGD introuvable.", "not_found");
    if (dgd.statut === "signe") return err("DGD déjà signé.", "already_signed");

    // Import dynamique du générateur PDF (côté server uniquement).
    const { generateDgdPdf } = await import("@/lib/pdf/generateDgdPdf");
    const { upload: uploadFile } = await import("@/lib/storage/local");

    const org = await db.query.organizations.findFirst({
      where: eq(operations.organizationId, user.organizationId),
      columns: { name: true },
    });

    const pdfBuffer = await generateDgdPdf({
      dgd,
      lot: dgd.lot,
      operation: dgd.lot.operation as { id: string; name: string },
      organization: { name: org?.name ?? "Architask" },
      signedAt: new Date(),
      signedByName: user.name,
    });

    const fileResult = await uploadFile({
      organizationId: user.organizationId,
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      originalFilename: `DGD-${dgd.lot.numero}.pdf`,
      kind: "dgd_signed",
      uploadedBy: user.userId,
    });

    const [signed] = await db
      .update(dgds)
      .set({
        statut: "signe",
        signedAt: new Date(),
        signedByUserId: user.userId,
        signedFileId: fileResult.fileId,
        updatedAt: new Date(),
      })
      .where(eq(dgds.id, id))
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "dgd",
      entityId: id,
      action: "signed",
      payloadDiff: { soldeHt: dgd.soldeHt, soldeTtc: dgd.soldeTtc },
    });

    // Side-effect : si tous les DGD signés → op statut = dgd.
    const operationId = dgd.lot.operation.id;
    const allLots = await db.query.lots.findMany({
      where: eq(lots.operationId, operationId),
      columns: { id: true, statut: true },
    });
    const lotsWithDgdSigned = await db.query.dgds.findMany({
      where: and(eq(dgds.statut, "signe")),
    });
    const allDgdSigned = allLots
      .filter((l) => l.statut !== "en_preparation")
      .every((l) => lotsWithDgdSigned.some((d) => d.lotId === l.id));
    if (allDgdSigned && dgd.lot.operation.statut !== "clos") {
      await db
        .update(operations)
        .set({ statut: "dgd", updatedAt: new Date() })
        .where(eq(operations.id, operationId));
    }

    revalidatePath(`/operations/${operationId}`);
    revalidatePath(`/operations/${operationId}/dgd`);
    return ok(signed);
  });
}

export async function getDGDByLot(rawInput: z.infer<typeof LotIdSchema>) {
  return withAction(LotIdSchema, rawInput, async ({ lotId }, { user }) => {
    const lot = await loadLotForDgd(lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    const dgd = await db.query.dgds.findFirst({
      where: eq(dgds.lotId, lotId),
      with: {
        lot: { with: { company: true, avenants: true } },
        signedByUser: { columns: { id: true, name: true } },
      },
    });
    return ok(dgd ?? null);
  });
}

export async function getDGDById(rawInput: z.infer<typeof DgdIdSchema>) {
  return withAction(DgdIdSchema, rawInput, async ({ id }, { user }) => {
    const dgd = await assertDgdBelongsToOrg(id, user.organizationId);
    if (!dgd) return err("DGD introuvable.", "not_found");
    return ok(dgd);
  });
}

export async function listDGDsByOperation(
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
    const lotsList = await db.query.lots.findMany({
      where: eq(lots.operationId, operationId),
      orderBy: [asc(lots.numero)],
      with: {
        company: true,
        avenants: true,
        dgd: true,
      },
    });
    return ok(lotsList);
  });
}
