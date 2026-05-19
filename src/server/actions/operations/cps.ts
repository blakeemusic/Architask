"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { certificatsPaiement } from "@/db/schema/finance";
import {
  lots,
  operations,
  situations,
} from "@/db/schema/operations";
import { auditLogs } from "@/db/schema/auth";
import { computeCP } from "@/lib/finance/computeCP";
import { generateCpPdf } from "@/lib/pdf/generateCpPdf";
import { upload as uploadFile } from "@/lib/storage/local";
import { assertCPWithinMarche } from "@/lib/validation/cp";
import { nextCPNumber } from "@/lib/validation/numbering";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const CreateCpFromSituationSchema = z.object({
  situationId: z.string().uuid(),
  /** Coefficient de révision (ex. 1.025 pour +2.5%). Défaut : 1 (pas de révision). */
  revisionCoefficient: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Coefficient invalide.")
    .optional(),
});

const CpUpdateSchema = z.object({
  id: z.string().uuid(),
  /** Override manuel des montants par l'utilisateur (uniquement brouillon/a_valider). */
  retenueGarantie: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  revisionMontantHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/)
    .optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

const CpIdSchema = z.object({ id: z.string().uuid() });
const LotIdSchema = z.object({ lotId: z.string().uuid() });
const OperationIdSchema = z.object({ operationId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertCpBelongsToOrg(cpId: string, organizationId: string) {
  const cp = await db.query.certificatsPaiement.findFirst({
    where: eq(certificatsPaiement.id, cpId),
    with: {
      operation: { columns: { id: true, organizationId: true, code: true } },
      lot: { with: { company: true, avenants: true } },
      situation: { with: { lines: true } },
      signedFile: true,
    },
  });
  if (!cp || cp.operation.organizationId !== organizationId) return null;
  return cp;
}

function computeDueDate(emissionDate: Date, delaiPaiementJours: number): Date {
  // Convention NF P03-001 : "30 j fin de mois" = fin du mois d'émission
  // + N jours du délai. Pour simplifier : emission + delai (calendaire).
  // V1 : implémenter la vraie règle "fin de mois".
  const d = new Date(emissionDate);
  d.setDate(d.getDate() + delaiPaiementJours);
  return d;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createCPFromSituation(
  rawInput: z.input<typeof CreateCpFromSituationSchema>,
): Promise<
  ActionResult<{
    cp: typeof certificatsPaiement.$inferSelect;
    warnings: string[];
  }>
> {
  return withAction(CreateCpFromSituationSchema, rawInput, async (input, { user }) => {
    // 1. Charger la situation + lot + previousCPs + avenants signés
    const situation = await db.query.situations.findFirst({
      where: eq(situations.id, input.situationId),
      with: {
        lot: {
          with: {
            operation: { columns: { id: true, organizationId: true, code: true } },
            avenants: true,
          },
        },
        lines: true,
      },
    });
    if (
      !situation ||
      situation.lot.operation.organizationId !== user.organizationId
    ) {
      return err("Situation introuvable.", "not_found");
    }

    const previousCps = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.lotId, situation.lotId),
      orderBy: [asc(certificatsPaiement.periodeAnnee), asc(certificatsPaiement.periodeMois)],
    });

    // 2. Invoque le moteur computeCP
    const hasLines = situation.lines.some(
      (l) => l.montantCumuleHt && Number(l.montantCumuleHt) > 0,
    );
    const computeResult = computeCP({
      lot: {
        montantMarcheHt: situation.lot.montantMarcheHt,
        retenueGarantiePct: situation.lot.retenueGarantiePct,
        tauxTva: situation.lot.tauxTva,
        avenantsSignes: situation.lot.avenants
          .filter((a) => a.statut === "signe")
          .map((a) => ({ montantHt: a.montantHt ?? "0" })),
      },
      situation: hasLines
        ? {
            mode: "lines",
            lines: situation.lines.map((l) => ({
              montantCumuleHt: l.montantCumuleHt ?? "0",
            })),
          }
        : {
            mode: "global",
            pctGlobal: situation.lines[0]?.pctAvancement ?? "0",
          },
      previousCPs: previousCps.map((cp) => ({
        brutAPayerHt: cp.brutAPayerHt,
        retenueGarantie: cp.retenueGarantie,
        statut: cp.statut,
      })),
      revisionCoefficient: input.revisionCoefficient,
    });
    if (!computeResult.ok) {
      return err(computeResult.data.error, computeResult.data.code);
    }
    const m = computeResult.data;

    // 3. Validation Σ CP ≤ marché révisé
    const guard = assertCPWithinMarche({
      marcheInitialHt: situation.lot.montantMarcheHt,
      avenants: situation.lot.avenants,
      existingCps: previousCps,
      newBrutAPayerHt: m.brutAPayerHt,
    });
    if (!guard.ok) return err(guard.error, guard.code);

    // 4. Numéro auto (atomique)
    const numbering = await nextCPNumber({
      organizationId: user.organizationId,
      operationCode: situation.lot.operation.code,
      lotId: situation.lotId,
      lotNumero: situation.lot.numero,
    });

    // 5. INSERT en brouillon
    const dueDate = computeDueDate(
      new Date(),
      situation.lot.delaiPaiementJours,
    );

    const [cpRow] = await db
      .insert(certificatsPaiement)
      .values({
        operationId: situation.lot.operation.id,
        lotId: situation.lotId,
        numero: numbering.numero,
        situationId: input.situationId,
        periodeMois: situation.periodeMois,
        periodeAnnee: situation.periodeAnnee,
        cumulTravauxHt: m.cumulTravauxHt,
        cumulCpPrecedentsHt: m.cumulCpPrecedentsHt,
        brutAPayerHt: m.brutAPayerHt,
        retenueGarantie: m.retenueGarantie,
        revisionMontantHt: m.revisionMontantHt,
        tva: m.tva,
        netTtc: m.netTtc,
        statut: "brouillon",
        dueDate,
        createdBy: user.userId,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "certificat_paiement",
      entityId: cpRow.id,
      action: "created",
      payloadDiff: { numero: cpRow.numero, netTtc: m.netTtc },
    });

    revalidatePath(`/operations/${situation.lot.operation.id}`);
    revalidatePath(`/operations/${situation.lot.operation.id}/cps`);
    return ok({ cp: cpRow, warnings: m.warnings });
  });
}

export async function updateCP(
  rawInput: z.input<typeof CpUpdateSchema>,
): Promise<ActionResult<typeof certificatsPaiement.$inferSelect>> {
  return withAction(CpUpdateSchema, rawInput, async (input, { user }) => {
    const cp = await assertCpBelongsToOrg(input.id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "brouillon" && cp.statut !== "a_valider") {
      return err("CP verrouillé (signé ou plus avancé).", "cp_locked");
    }

    // Recalcule netTtc si retenue ou révision est touchée
    const patch: Partial<typeof certificatsPaiement.$inferInsert> = {};
    let needsRecompute = false;
    if (input.retenueGarantie !== undefined) {
      patch.retenueGarantie = input.retenueGarantie;
      needsRecompute = true;
    }
    if (input.revisionMontantHt !== undefined) {
      patch.revisionMontantHt = input.revisionMontantHt;
      needsRecompute = true;
    }
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

    if (needsRecompute) {
      const brut = Number(cp.brutAPayerHt);
      const retenue = Number(patch.retenueGarantie ?? cp.retenueGarantie);
      const revision = Number(
        patch.revisionMontantHt ?? cp.revisionMontantHt ?? 0,
      );
      const tauxTva = Number(cp.lot.tauxTva);
      const montantHt = brut - retenue + revision;
      const tva = Math.ceil(montantHt * tauxTva) / 100;
      patch.tva = tva.toFixed(2);
      patch.netTtc = (montantHt + tva).toFixed(2);
    }

    const [row] = await db
      .update(certificatsPaiement)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(certificatsPaiement.id, input.id))
      .returning();

    revalidatePath(`/operations/${cp.operation.id}/cps/${row.id}`);
    revalidatePath(`/operations/${cp.operation.id}/cps`);
    return ok(row);
  });
}

export async function validateCP(rawInput: z.infer<typeof CpIdSchema>) {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "brouillon")
      return err("Seul un CP en brouillon peut être envoyé pour validation.", "wrong_status");
    const [row] = await db
      .update(certificatsPaiement)
      .set({ statut: "a_valider", updatedAt: new Date() })
      .where(eq(certificatsPaiement.id, id))
      .returning();
    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "certificat_paiement",
      entityId: id,
      action: "submitted_for_validation",
      payloadDiff: { from: "brouillon", to: "a_valider" },
    });
    revalidatePath(`/operations/${cp.operation.id}/cps/${id}`);
    return ok(row);
  });
}

/**
 * signCP — Mock signature électronique (MVP).
 * Side-effects : statut → signé, signed_at, signed_by_user_id, génère le PDF
 * et le fige dans .uploads/.
 */
export async function signCP(rawInput: z.infer<typeof CpIdSchema>) {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "a_valider" && cp.statut !== "brouillon") {
      return err("Statut incompatible avec la signature.", "wrong_status");
    }

    // Génère le PDF avec les infos finales
    const pdfBuffer = await generateCpPdf({
      cp,
      lot: cp.lot,
      operation: cp.operation as unknown as {
        id: string;
        code: string;
        name: string;
      },
      situation: cp.situation,
      organization: { name: "Architask" }, // TODO V1 : fetcher org.name + branding
      signedAt: new Date(),
      signedByName: user.name,
    });

    const fileResult = await uploadFile({
      organizationId: user.organizationId,
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      originalFilename: `${cp.numero}.pdf`,
      kind: "cp_signed",
      uploadedBy: user.userId,
    });

    const [row] = await db
      .update(certificatsPaiement)
      .set({
        statut: "signe",
        signedAt: new Date(),
        signedByUserId: user.userId,
        signedFileId: fileResult.fileId,
        updatedAt: new Date(),
      })
      .where(eq(certificatsPaiement.id, id))
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "certificat_paiement",
      entityId: id,
      action: "signed",
      payloadDiff: { netTtc: cp.netTtc, signedAt: new Date().toISOString() },
    });

    revalidatePath(`/operations/${cp.operation.id}/cps/${id}`);
    revalidatePath(`/operations/${cp.operation.id}/cps`);
    revalidatePath(`/operations/${cp.operation.id}`);
    return ok(row);
  });
}

export async function sendCP(rawInput: z.infer<typeof CpIdSchema>) {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "signe")
      return err("CP non signé — impossible à envoyer.", "wrong_status");
    const [row] = await db
      .update(certificatsPaiement)
      .set({ statut: "envoye", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(certificatsPaiement.id, id))
      .returning();
    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "certificat_paiement",
      entityId: id,
      action: "sent",
      payloadDiff: { to: cp.lot.company?.raisonSociale ?? "—" },
    });
    revalidatePath(`/operations/${cp.operation.id}/cps/${id}`);
    return ok(row);
  });
}

export async function markCPAsPaid(rawInput: z.infer<typeof CpIdSchema>) {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "envoye" && cp.statut !== "signe")
      return err("Statut incompatible avec un marquage payé.", "wrong_status");
    const [row] = await db
      .update(certificatsPaiement)
      .set({ statut: "paye", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(certificatsPaiement.id, id))
      .returning();
    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "certificat_paiement",
      entityId: id,
      action: "marked_paid",
      payloadDiff: { paidAt: new Date().toISOString() },
    });
    revalidatePath(`/operations/${cp.operation.id}/cps/${id}`);
    revalidatePath(`/operations/${cp.operation.id}`);
    return ok(row);
  });
}

export async function deleteCP(
  rawInput: z.infer<typeof CpIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");
    if (cp.statut !== "brouillon")
      return err("Seul un CP en brouillon peut être supprimé.", "wrong_status");
    await db.delete(certificatsPaiement).where(eq(certificatsPaiement.id, id));
    revalidatePath(`/operations/${cp.operation.id}/cps`);
    return ok({ id });
  });
}

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function listCPsByOperation(
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
    const rows = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.operationId, operationId),
      orderBy: [
        desc(certificatsPaiement.periodeAnnee),
        desc(certificatsPaiement.periodeMois),
        desc(certificatsPaiement.createdAt),
      ],
      with: {
        lot: { with: { company: true } },
      },
    });
    return ok(rows);
  });
}

export async function listCPsByLot(rawInput: z.infer<typeof LotIdSchema>) {
  return withAction(LotIdSchema, rawInput, async ({ lotId }, { user }) => {
    const lot = await db.query.lots.findFirst({
      where: eq(lots.id, lotId),
      with: { operation: { columns: { organizationId: true } } },
    });
    if (!lot || lot.operation.organizationId !== user.organizationId)
      return err("Lot introuvable.", "not_found");
    const rows = await db.query.certificatsPaiement.findMany({
      where: eq(certificatsPaiement.lotId, lotId),
      orderBy: [asc(certificatsPaiement.periodeAnnee), asc(certificatsPaiement.periodeMois)],
    });
    return ok(rows);
  });
}

export async function getCPById(rawInput: z.infer<typeof CpIdSchema>) {
  return withAction(CpIdSchema, rawInput, async ({ id }, { user }) => {
    const cp = await assertCpBelongsToOrg(id, user.organizationId);
    if (!cp) return err("CP introuvable.", "not_found");

    // Récupère aussi le signed_by_user et le creator pour affichage UI.
    const enriched = await db.query.certificatsPaiement.findFirst({
      where: eq(certificatsPaiement.id, id),
      with: {
        operation: true,
        lot: { with: { company: true, avenants: true } },
        situation: { with: { lines: { with: { dpgfLine: true } } } },
        signedByUser: { columns: { id: true, name: true, email: true } },
        creator: { columns: { id: true, name: true, email: true } },
      },
    });
    return ok(enriched);
  });
}

export async function getCpsKpisByOperation(
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

    const [counts] = await db
      .select({
        aValider: sql<number>`count(*) FILTER (WHERE ${certificatsPaiement.statut} = 'a_valider')::int`,
        signes: sql<number>`count(*) FILTER (WHERE ${certificatsPaiement.statut} = 'signe')::int`,
        payes: sql<number>`count(*) FILTER (WHERE ${certificatsPaiement.statut} = 'paye')::int`,
        cumulHt: sql<string>`COALESCE(SUM(${certificatsPaiement.brutAPayerHt}) FILTER (WHERE ${certificatsPaiement.statut} != 'brouillon'), 0)::text`,
      })
      .from(certificatsPaiement)
      .where(eq(certificatsPaiement.operationId, operationId));

    return ok({
      aValider: counts?.aValider ?? 0,
      signes: counts?.signes ?? 0,
      payes: counts?.payes ?? 0,
      cumulEmisHt: counts?.cumulHt ?? "0",
    });
  });
}

