"use server";

import { Decimal } from "decimal.js";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/auth";
import { honoraireSituations } from "@/db/schema/honoraires";
import { bankAccounts, bankTransactions } from "@/db/schema/tresorerie";
import { getBankProvider } from "@/lib/bank";
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

const ConnectBankSchema = z.object({});
const SyncAccountSchema = z.object({
  bankAccountId: z.string().uuid().optional(),
});
const ListTransactionsSchema = z.object({
  bankAccountId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  category: z.string().optional(),
  needsReconciliationOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
const CategorizeTransactionSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1).max(80),
});

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Réconciliation auto NH ↔ transaction entrante.
 *
 * Heuristique : extrait un motif "NH-XX-YYYY-NNN" du libellé, cherche
 * la situation correspondante, vérifie montant ± 5% et statut non payé.
 * Si match → lie linkedHonoraireSituationId, set needsReconciliation=false,
 * passe la NH en "payee" et set paidAt.
 */
async function tryAutoReconcileHonoraires(
  organizationId: string,
  txs: Array<typeof bankTransactions.$inferSelect>,
): Promise<number> {
  let matched = 0;
  const NH_REGEX = /\b(NH-[A-Z]+-\d{4}-\d{3})\b/;
  for (const tx of txs) {
    if (Number(tx.amountTtc ?? 0) <= 0) continue; // entrées uniquement
    if (tx.linkedHonoraireSituationId) continue;
    const match = NH_REGEX.exec(tx.libelle);
    if (!match) continue;
    const numero = match[1];

    const sit = await db.query.honoraireSituations.findFirst({
      where: eq(honoraireSituations.numero, numero),
      with: {
        contract: {
          with: {
            operation: { columns: { organizationId: true } },
          },
        },
      },
    });
    if (
      !sit ||
      sit.contract.operation.organizationId !== organizationId ||
      sit.statut === "payee"
    ) {
      continue;
    }
    const expected = new Decimal(sit.montantTtc ?? sit.montantHt ?? "0").abs();
    const got = new Decimal(tx.amountTtc ?? "0").abs();
    const tolerance = expected.mul("0.05");
    if (expected.minus(got).abs().gt(tolerance)) continue;

    await db
      .update(bankTransactions)
      .set({
        linkedHonoraireSituationId: sit.id,
        needsReconciliation: false,
        category: "honoraires",
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.id, tx.id));

    await db
      .update(honoraireSituations)
      .set({
        statut: "payee",
        paidAt: tx.transactionDate,
        updatedAt: new Date(),
      })
      .where(eq(honoraireSituations.id, sit.id));

    matched += 1;
  }
  return matched;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function connectBankAccount(
  rawInput: z.infer<typeof ConnectBankSchema>,
): Promise<
  ActionResult<{
    accountsCreated: number;
    transactionsCreated: number;
    autoReconciled: number;
  }>
> {
  return withAction(ConnectBankSchema, rawInput, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const provider = getBankProvider(user.organizationId);
    const { accounts } = await provider.connectAccount({
      organizationId: user.organizationId,
    });

    let accountsCreated = 0;
    const accountRows: Array<typeof bankAccounts.$inferSelect> = [];
    for (const a of accounts) {
      const existing = await db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.organizationId, user.organizationId),
          eq(bankAccounts.externalAccountId, a.externalAccountId),
        ),
      });
      if (existing) {
        accountRows.push(existing);
        continue;
      }
      const [row] = await db
        .insert(bankAccounts)
        .values({
          organizationId: user.organizationId,
          provider: "bridge", // mock posera bridge par convention
          externalAccountId: a.externalAccountId,
          libelle: a.libelle,
          ibanLast4: a.ibanLast4 ?? null,
          currency: a.currency,
          currentBalance: a.currentBalance,
          lastSyncedAt: new Date(),
        })
        .returning();
      accountRows.push(row);
      accountsCreated += 1;
    }

    // Sync transactions sur chaque compte
    let transactionsCreated = 0;
    const newTxs: Array<typeof bankTransactions.$inferSelect> = [];
    for (const row of accountRows) {
      const { transactions } = await provider.syncTransactions({
        organizationId: user.organizationId,
        externalAccountId: row.externalAccountId,
      });
      for (const t of transactions) {
        const inserted = await db
          .insert(bankTransactions)
          .values({
            bankAccountId: row.id,
            externalTxId: t.externalTxId,
            transactionDate: t.transactionDate,
            amountTtc: t.amountTtc,
            libelle: t.libelle,
            category: t.category,
            needsReconciliation: true,
            source: "bank",
          })
          .onConflictDoNothing({
            target: [bankTransactions.bankAccountId, bankTransactions.externalTxId],
            where: sql`${bankTransactions.externalTxId} IS NOT NULL`,
          })
          .returning();
        if (inserted.length > 0) {
          newTxs.push(inserted[0]);
          transactionsCreated += 1;
        }
      }
    }

    const autoReconciled = await tryAutoReconcileHonoraires(
      user.organizationId,
      newTxs,
    );

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "bank_account",
      entityId: accountRows[0]?.id ?? "n/a",
      action: "connected",
      payloadDiff: {
        accountsCreated,
        transactionsCreated,
        autoReconciled,
      },
    });

    revalidatePath("/cockpit/tresorerie");
    revalidatePath("/cockpit/rapprochement");
    return ok({ accountsCreated, transactionsCreated, autoReconciled });
  });
}

export async function syncTransactions(
  rawInput: z.input<typeof SyncAccountSchema>,
): Promise<
  ActionResult<{
    transactionsCreated: number;
    autoReconciled: number;
  }>
> {
  return withAction(SyncAccountSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const accounts = input.bankAccountId
      ? [
          await db.query.bankAccounts.findFirst({
            where: and(
              eq(bankAccounts.id, input.bankAccountId),
              eq(bankAccounts.organizationId, user.organizationId),
            ),
          }),
        ].filter(Boolean)
      : await db.query.bankAccounts.findMany({
          where: eq(bankAccounts.organizationId, user.organizationId),
        });

    if (accounts.length === 0) {
      return err(
        "Aucun compte bancaire connecté. Connecte une banque d'abord.",
        "no_account",
      );
    }

    const provider = getBankProvider(user.organizationId);
    const newTxs: Array<typeof bankTransactions.$inferSelect> = [];
    for (const row of accounts as Array<typeof bankAccounts.$inferSelect>) {
      const { transactions } = await provider.syncTransactions({
        organizationId: user.organizationId,
        externalAccountId: row.externalAccountId,
        since: row.lastSyncedAt ?? undefined,
      });
      for (const t of transactions) {
        const inserted = await db
          .insert(bankTransactions)
          .values({
            bankAccountId: row.id,
            externalTxId: t.externalTxId,
            transactionDate: t.transactionDate,
            amountTtc: t.amountTtc,
            libelle: t.libelle,
            category: t.category,
            needsReconciliation: true,
            source: "bank",
          })
          .onConflictDoNothing({
            target: [bankTransactions.bankAccountId, bankTransactions.externalTxId],
            where: sql`${bankTransactions.externalTxId} IS NOT NULL`,
          })
          .returning();
        if (inserted.length > 0) newTxs.push(inserted[0]);
      }
      await db
        .update(bankAccounts)
        .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(bankAccounts.id, row.id));
    }

    const autoReconciled = await tryAutoReconcileHonoraires(
      user.organizationId,
      newTxs,
    );

    revalidatePath("/cockpit/tresorerie");
    revalidatePath("/cockpit/rapprochement");
    return ok({
      transactionsCreated: newTxs.length,
      autoReconciled,
    });
  });
}

export async function listBankAccounts(): Promise<
  ActionResult<Array<typeof bankAccounts.$inferSelect>>
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const rows = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
      orderBy: [desc(bankAccounts.createdAt)],
    });
    return ok(rows);
  });
}

export async function listTransactions(
  rawInput: z.input<typeof ListTransactionsSchema>,
): Promise<
  ActionResult<
    Array<
      typeof bankTransactions.$inferSelect & {
        bankAccount: { libelle: string; ibanLast4: string | null };
        linkedHonoraireSituation: { numero: string } | null;
      }
    >
  >
> {
  return withAction(ListTransactionsSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const orgAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
      columns: { id: true },
    });
    const accountIds = orgAccounts.map((a) => a.id);
    if (accountIds.length === 0) return ok([]);

    const conditions = [inArray(bankTransactions.bankAccountId, accountIds)];
    if (input.bankAccountId) {
      conditions.push(eq(bankTransactions.bankAccountId, input.bankAccountId));
    }
    if (input.fromDate) {
      conditions.push(gte(bankTransactions.transactionDate, input.fromDate));
    }
    if (input.category) {
      conditions.push(eq(bankTransactions.category, input.category));
    }
    if (input.needsReconciliationOnly) {
      conditions.push(eq(bankTransactions.needsReconciliation, true));
    }

    const rows = await db.query.bankTransactions.findMany({
      where: and(...conditions),
      orderBy: [desc(bankTransactions.transactionDate)],
      limit: input.limit ?? 100,
      with: {
        linkedHonoraireSituation: { columns: { numero: true } },
      },
    });

    // Attach bankAccount libellé manuellement (relation déjà disponible
    // mais on garde une projection minimale).
    const accountById = new Map(
      (
        await db.query.bankAccounts.findMany({
          where: inArray(bankAccounts.id, accountIds),
          columns: { id: true, libelle: true, ibanLast4: true },
        })
      ).map((a) => [a.id, a]),
    );

    return ok(
      rows.map((r) => ({
        ...r,
        bankAccount: {
          libelle: accountById.get(r.bankAccountId)?.libelle ?? "—",
          ibanLast4: accountById.get(r.bankAccountId)?.ibanLast4 ?? null,
        },
        linkedHonoraireSituation: r.linkedHonoraireSituation
          ? { numero: r.linkedHonoraireSituation.numero }
          : null,
      })),
    );
  });
}

export async function categorizeTransaction(
  rawInput: z.input<typeof CategorizeTransactionSchema>,
): Promise<ActionResult<typeof bankTransactions.$inferSelect>> {
  return withAction(
    CategorizeTransactionSchema,
    rawInput,
    async (input, { user }) => {
      if (!(await canAccessCockpit(user, null))) {
        return err("Accès Cockpit refusé.", "forbidden");
      }
      const tx = await db.query.bankTransactions.findFirst({
        where: eq(bankTransactions.id, input.id),
        with: {
          account: { columns: { organizationId: true } },
        },
      });
      if (!tx || tx.account.organizationId !== user.organizationId) {
        return err("Transaction introuvable.", "not_found");
      }
      const [row] = await db
        .update(bankTransactions)
        .set({ category: input.category, updatedAt: new Date() })
        .where(eq(bankTransactions.id, input.id))
        .returning();
      revalidatePath("/cockpit/tresorerie");
      return ok(row);
    },
  );
}

