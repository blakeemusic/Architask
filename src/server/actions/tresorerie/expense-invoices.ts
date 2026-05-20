"use server";

import { Decimal } from "decimal.js";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import { honoraireSituations } from "@/db/schema/honoraires";
import {
  bankAccounts,
  bankTransactions,
  expenseInvoices,
  vatSummaries,
} from "@/db/schema/tresorerie";
import { getEInvoiceProvider } from "@/lib/einvoice";
import { canAccessCockpit } from "@/lib/cockpit-access";
import { extractExpenseInvoice } from "@/lib/ocr/extractExpenseInvoice";
import { upload as uploadFile } from "@/lib/storage/local";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const AttachUploadSchema = z.object({
  transactionId: z.string().uuid(),
  base64: z.string().min(1),
  mimeType: z.string().min(1),
  filename: z.string().min(1),
  /** Si l'OCR est désactivée, l'utilisateur saisit les montants à la main. */
  manualOverride: z
    .object({
      fournisseur: z.string().min(1),
      dateFacture: z.coerce.date(),
      montantHt: z.string(),
      montantTva: z.string(),
      montantTtc: z.string(),
      tauxTva: z.string(),
    })
    .optional(),
});

const AttachPennylaneSchema = z.object({
  transactionId: z.string().uuid(),
  pennylaneExternalId: z.string().min(1),
  supplierName: z.string().min(1),
  dateFacture: z.coerce.date(),
  montantHt: z.string(),
  montantTva: z.string(),
  montantTtc: z.string(),
  tauxTva: z.string(),
});

const ReconcileSchema = z.object({
  transactionId: z.string().uuid(),
  expenseInvoiceId: z.string().uuid(),
});

const VatPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2050),
  month: z.number().int().min(1).max(12),
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

/**
 * Liste des transactions sortantes (>5€) sans facture jointe.
 * Cœur de la "Inbox à rapprocher".
 */
export async function listMissingInvoiceTransactions(): Promise<
  ActionResult<
    Array<{
      id: string;
      transactionDate: Date;
      amountTtc: string | null;
      libelle: string;
      category: string | null;
      bankAccountLibelle: string;
      daysSinceTx: number;
      pennylaneCandidate: {
        externalId: string;
        supplierName: string;
        montantTtc: string;
        montantHt: string;
        montantTva: string;
        tauxTva: string;
        dateFacture: Date;
      } | null;
    }>
  >
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const orgAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
      columns: { id: true, libelle: true },
    });
    const accountIds = orgAccounts.map((a) => a.id);
    if (accountIds.length === 0) return ok([]);
    const accountById = new Map(orgAccounts.map((a) => [a.id, a]));

    const txs = await db.query.bankTransactions.findMany({
      where: and(
        inArray(bankTransactions.bankAccountId, accountIds),
        isNull(bankTransactions.invoiceAttachedAt),
        // Sortantes uniquement
        sql`${bankTransactions.amountTtc} < -5`,
      ),
      orderBy: [desc(bankTransactions.transactionDate)],
      limit: 50,
    });

    // Récupère candidats Pennylane (mock receiveInvoices)
    const provider = getEInvoiceProvider(user.organizationId);
    const { invoices: pennylaneCandidates } = await provider.receiveInvoices({
      organizationId: user.organizationId,
    });

    const now = new Date();
    return ok(
      txs.map((t) => {
        const daysSinceTx = Math.floor(
          (now.getTime() - t.transactionDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        // Match Pennylane : montant ± 1€ + date ± 7j + nom proche
        const amt = new Decimal(t.amountTtc ?? "0").abs();
        const candidate = pennylaneCandidates.find((p) => {
          const pAmt = new Decimal(p.montantTtc);
          if (pAmt.minus(amt).abs().gt("1.00")) return false;
          const diffDays = Math.abs(
            (p.dateFacture.getTime() - t.transactionDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (diffDays > 7) return false;
          // Nom proche : on prend le premier mot significatif du libellé
          const txKey = t.libelle
            .toLowerCase()
            .replace(/^(cb |prlv )/, "")
            .split(/\s+/)[0];
          const supplierKey = p.supplierName.toLowerCase().split(/\s+/)[0];
          return (
            txKey.startsWith(supplierKey.slice(0, 4)) ||
            supplierKey.startsWith(txKey.slice(0, 4))
          );
        });

        return {
          id: t.id,
          transactionDate: t.transactionDate,
          amountTtc: t.amountTtc,
          libelle: t.libelle,
          category: t.category,
          bankAccountLibelle: accountById.get(t.bankAccountId)?.libelle ?? "—",
          daysSinceTx,
          pennylaneCandidate: candidate
            ? {
                externalId: candidate.externalId,
                supplierName: candidate.supplierName,
                montantTtc: candidate.montantTtc,
                montantHt: candidate.montantHt,
                montantTva: candidate.montantTva,
                tauxTva: candidate.tauxTva,
                dateFacture: candidate.dateFacture,
              }
            : null,
        };
      }),
    );
  });
}

export async function attachInvoiceFromUpload(
  rawInput: z.input<typeof AttachUploadSchema>,
): Promise<
  ActionResult<{
    expenseInvoice: typeof expenseInvoices.$inferSelect;
    usedOcr: boolean;
    ocrConfidence: number | null;
  }>
> {
  return withAction(AttachUploadSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const tx = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.id, input.transactionId),
      with: { account: { columns: { organizationId: true } } },
    });
    if (!tx || tx.account.organizationId !== user.organizationId) {
      return err("Transaction introuvable.", "not_found");
    }

    const buf = Buffer.from(input.base64, "base64");
    let ocrData: {
      fournisseur: string;
      dateFacture: Date;
      montantHt: string;
      montantTva: string;
      montantTtc: string;
      tauxTva: string;
      confidence: number;
    } | null = null;
    let usedOcr = false;

    if (input.manualOverride) {
      ocrData = {
        fournisseur: input.manualOverride.fournisseur,
        dateFacture: input.manualOverride.dateFacture,
        montantHt: input.manualOverride.montantHt,
        montantTva: input.manualOverride.montantTva,
        montantTtc: input.manualOverride.montantTtc,
        tauxTva: input.manualOverride.tauxTva,
        confidence: 100,
      };
    } else {
      const result = await extractExpenseInvoice(buf, input.mimeType);
      if (!result.ok) {
        return err(result.error, result.code);
      }
      usedOcr = true;
      ocrData = {
        fournisseur: result.data.fournisseur,
        dateFacture: new Date(result.data.dateFacture),
        montantHt: result.data.montantHt.toFixed(2),
        montantTva: result.data.montantTva.toFixed(2),
        montantTtc: result.data.montantTtc.toFixed(2),
        tauxTva: result.data.tauxTva.toFixed(2),
        confidence: result.data.confidence,
      };
    }

    const fileResult = await uploadFile({
      organizationId: user.organizationId,
      buffer: buf,
      mimeType: input.mimeType,
      originalFilename: input.filename,
      kind: "expense_invoice",
      uploadedBy: user.userId,
    });

    const [row] = await db
      .insert(expenseInvoices)
      .values({
        organizationId: user.organizationId,
        supplierName: ocrData.fournisseur,
        dateFacture: ocrData.dateFacture,
        montantHt: ocrData.montantHt,
        montantTva: ocrData.montantTva,
        montantTtc: ocrData.montantTtc,
        tauxTva: ocrData.tauxTva,
        deductible: true,
        source: usedOcr ? "photo" : "upload",
        fileId: fileResult.fileId,
        ocrConfidence: Math.round(ocrData.confidence),
        linkedTransactionId: tx.id,
      })
      .returning();

    await db
      .update(bankTransactions)
      .set({
        invoiceAttachedAt: new Date(),
        needsReconciliation: false,
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.id, tx.id));

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "expense_invoice",
      entityId: row.id,
      action: "attached",
      payloadDiff: {
        source: usedOcr ? "ocr" : "upload",
        montantTtc: ocrData.montantTtc,
        transactionId: tx.id,
      },
    });

    revalidatePath("/cockpit/rapprochement");
    revalidatePath("/cockpit/tresorerie");
    return ok({
      expenseInvoice: row,
      usedOcr,
      ocrConfidence: ocrData.confidence,
    });
  });
}

export async function attachInvoiceFromPennylane(
  rawInput: z.input<typeof AttachPennylaneSchema>,
): Promise<ActionResult<typeof expenseInvoices.$inferSelect>> {
  return withAction(AttachPennylaneSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const tx = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.id, input.transactionId),
      with: { account: { columns: { organizationId: true } } },
    });
    if (!tx || tx.account.organizationId !== user.organizationId) {
      return err("Transaction introuvable.", "not_found");
    }

    const [row] = await db
      .insert(expenseInvoices)
      .values({
        organizationId: user.organizationId,
        supplierName: input.supplierName,
        dateFacture: input.dateFacture,
        montantHt: input.montantHt,
        montantTva: input.montantTva,
        montantTtc: input.montantTtc,
        tauxTva: input.tauxTva,
        deductible: true,
        source: "pennylane",
        pennylaneExternalId: input.pennylaneExternalId,
        linkedTransactionId: tx.id,
      })
      .returning();

    await db
      .update(bankTransactions)
      .set({
        invoiceAttachedAt: new Date(),
        needsReconciliation: false,
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.id, tx.id));

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "expense_invoice",
      entityId: row.id,
      action: "attached_pennylane",
      payloadDiff: {
        montantTtc: input.montantTtc,
        pennylaneExternalId: input.pennylaneExternalId,
      },
    });

    revalidatePath("/cockpit/rapprochement");
    revalidatePath("/cockpit/tresorerie");
    return ok(row);
  });
}

export async function reconcileTransaction(
  rawInput: z.input<typeof ReconcileSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(ReconcileSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const inv = await db.query.expenseInvoices.findFirst({
      where: and(
        eq(expenseInvoices.id, input.expenseInvoiceId),
        eq(expenseInvoices.organizationId, user.organizationId),
      ),
    });
    if (!inv) return err("Facture introuvable.", "not_found");
    const tx = await db.query.bankTransactions.findFirst({
      where: eq(bankTransactions.id, input.transactionId),
      with: { account: { columns: { organizationId: true } } },
    });
    if (!tx || tx.account.organizationId !== user.organizationId) {
      return err("Transaction introuvable.", "not_found");
    }

    await db
      .update(expenseInvoices)
      .set({ linkedTransactionId: tx.id, updatedAt: new Date() })
      .where(eq(expenseInvoices.id, inv.id));

    await db
      .update(bankTransactions)
      .set({
        invoiceAttachedAt: new Date(),
        needsReconciliation: false,
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.id, tx.id));

    revalidatePath("/cockpit/rapprochement");
    return ok({ id: inv.id });
  });
}

/**
 * Calcule la TVA collectée vs déductible du mois courant (ou demandé)
 * et upsert le vat_summary.
 */
export async function computeVatSummary(
  rawInput: z.input<typeof VatPeriodSchema>,
): Promise<
  ActionResult<{
    tvaCollectee: string;
    tvaDeductible: string;
    tvaDue: string;
    byRate: Array<{ taux: string; collectee: string; deductible: string }>;
  }>
> {
  return withAction(VatPeriodSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const monthStart = new Date(input.year, input.month - 1, 1);
    const monthEnd = new Date(
      input.year,
      input.month,
      0,
      23,
      59,
      59,
      999,
    );

    // TVA collectée = somme TVA des honoraireSituations émises ce mois
    const sitsRaw = await db.query.honoraireSituations.findMany({
      where: and(
        gte(honoraireSituations.dateEmission, monthStart),
        lte(honoraireSituations.dateEmission, monthEnd),
      ),
      with: {
        contract: {
          with: { operation: { columns: { organizationId: true } } },
        },
      },
    });
    const sits = sitsRaw.filter(
      (s) =>
        s.contract.operation.organizationId === user.organizationId &&
        s.statut !== "brouillon",
    );
    const tvaCollectee = sits.reduce(
      (acc, s) => acc.plus(s.montantTva ?? "0"),
      new Decimal(0),
    );

    // TVA déductible = somme TVA des expenseInvoices avec date dans le mois
    const invs = await db.query.expenseInvoices.findMany({
      where: and(
        eq(expenseInvoices.organizationId, user.organizationId),
        gte(expenseInvoices.dateFacture, monthStart),
        lte(expenseInvoices.dateFacture, monthEnd),
        eq(expenseInvoices.deductible, true),
      ),
    });
    const tvaDeductible = invs.reduce(
      (acc, i) => acc.plus(i.montantTva ?? "0"),
      new Decimal(0),
    );

    // Par taux
    const byRateMap = new Map<
      string,
      { collectee: Decimal; deductible: Decimal }
    >();
    for (const s of sits) {
      const k = new Decimal(s.contract.tauxTva).toFixed(2);
      const cur = byRateMap.get(k) ?? {
        collectee: new Decimal(0),
        deductible: new Decimal(0),
      };
      cur.collectee = cur.collectee.plus(s.montantTva ?? "0");
      byRateMap.set(k, cur);
    }
    for (const i of invs) {
      const k = new Decimal(i.tauxTva).toFixed(2);
      const cur = byRateMap.get(k) ?? {
        collectee: new Decimal(0),
        deductible: new Decimal(0),
      };
      cur.deductible = cur.deductible.plus(i.montantTva ?? "0");
      byRateMap.set(k, cur);
    }

    const tvaDue = tvaCollectee.minus(tvaDeductible);

    // Upsert vat_summary
    const existing = await db.query.vatSummaries.findFirst({
      where: and(
        eq(vatSummaries.organizationId, user.organizationId),
        eq(vatSummaries.periodeAnnee, input.year),
        eq(vatSummaries.periodeMois, input.month),
      ),
    });
    if (existing) {
      await db
        .update(vatSummaries)
        .set({
          tvaCollectee: tvaCollectee.toFixed(2),
          tvaDeductible: tvaDeductible.toFixed(2),
          tvaDue: tvaDue.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(vatSummaries.id, existing.id));
    } else {
      await db.insert(vatSummaries).values({
        organizationId: user.organizationId,
        periodeMois: input.month,
        periodeAnnee: input.year,
        tvaCollectee: tvaCollectee.toFixed(2),
        tvaDeductible: tvaDeductible.toFixed(2),
        tvaDue: tvaDue.toFixed(2),
        statut: "brouillon",
      });
    }

    revalidatePath("/cockpit/rapprochement");
    return ok({
      tvaCollectee: tvaCollectee.toFixed(2),
      tvaDeductible: tvaDeductible.toFixed(2),
      tvaDue: tvaDue.toFixed(2),
      byRate: [...byRateMap.entries()]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([taux, v]) => ({
          taux,
          collectee: v.collectee.toFixed(2),
          deductible: v.deductible.toFixed(2),
        })),
    });
  });
}

export async function listExpenseInvoices(): Promise<
  ActionResult<Array<typeof expenseInvoices.$inferSelect>>
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const rows = await db.query.expenseInvoices.findMany({
      where: eq(expenseInvoices.organizationId, user.organizationId),
      orderBy: [desc(expenseInvoices.dateFacture)],
      limit: 100,
    });
    return ok(rows);
  });
}
