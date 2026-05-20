"use server";

import { Decimal } from "decimal.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { bankAccounts, bankTransactions, recurringCharges } from "@/db/schema/tresorerie";
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

// CHARGE_CATEGORIES vit dans src/lib/tresorerie-constants.ts —
// les fichiers "use server" ne peuvent exporter que des async functions.

const CreateChargeSchema = z.object({
  libelle: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  montantHt: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "TVA invalide.")
    .optional(),
  recurrence: z.enum(["monthly", "quarterly", "yearly", "punctual"]),
  nextDueDate: z.coerce.date().optional(),
  supplierCompanyId: z.string().uuid().optional().nullable(),
});

const UpdateChargeSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(80).optional(),
  montantHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  recurrence: z.enum(["monthly", "quarterly", "yearly", "punctual"]).optional(),
  nextDueDate: z.coerce.date().optional().nullable(),
  active: z.boolean().optional(),
});

const ChargeIdSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createRecurringCharge(
  rawInput: z.input<typeof CreateChargeSchema>,
): Promise<ActionResult<typeof recurringCharges.$inferSelect>> {
  return withAction(CreateChargeSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const [row] = await db
      .insert(recurringCharges)
      .values({
        organizationId: user.organizationId,
        libelle: input.libelle,
        category: input.category,
        montantHt: input.montantHt,
        tauxTva: input.tauxTva ?? "20.00",
        recurrence: input.recurrence,
        nextDueDate: input.nextDueDate ?? null,
        supplierCompanyId: input.supplierCompanyId ?? null,
        active: true,
      })
      .returning();
    revalidatePath("/cockpit/tresorerie");
    return ok(row);
  });
}

export async function updateRecurringCharge(
  rawInput: z.input<typeof UpdateChargeSchema>,
): Promise<ActionResult<typeof recurringCharges.$inferSelect>> {
  return withAction(UpdateChargeSchema, rawInput, async (input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const charge = await db.query.recurringCharges.findFirst({
      where: and(
        eq(recurringCharges.id, input.id),
        eq(recurringCharges.organizationId, user.organizationId),
      ),
    });
    if (!charge) return err("Charge introuvable.", "not_found");
    const updates: Partial<typeof recurringCharges.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.libelle) updates.libelle = input.libelle;
    if (input.category) updates.category = input.category;
    if (input.montantHt) updates.montantHt = input.montantHt;
    if (input.tauxTva) updates.tauxTva = input.tauxTva;
    if (input.recurrence) updates.recurrence = input.recurrence;
    if (input.nextDueDate !== undefined) updates.nextDueDate = input.nextDueDate;
    if (input.active !== undefined) updates.active = input.active;

    const [row] = await db
      .update(recurringCharges)
      .set(updates)
      .where(eq(recurringCharges.id, input.id))
      .returning();
    revalidatePath("/cockpit/tresorerie");
    return ok(row);
  });
}

export async function deleteRecurringCharge(
  rawInput: z.infer<typeof ChargeIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(ChargeIdSchema, rawInput, async ({ id }, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const charge = await db.query.recurringCharges.findFirst({
      where: and(
        eq(recurringCharges.id, id),
        eq(recurringCharges.organizationId, user.organizationId),
      ),
    });
    if (!charge) return err("Charge introuvable.", "not_found");
    await db.delete(recurringCharges).where(eq(recurringCharges.id, id));
    revalidatePath("/cockpit/tresorerie");
    return ok({ id });
  });
}

export async function listRecurringCharges(): Promise<
  ActionResult<Array<typeof recurringCharges.$inferSelect>>
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const rows = await db.query.recurringCharges.findMany({
      where: and(
        eq(recurringCharges.organizationId, user.organizationId),
        eq(recurringCharges.active, true),
      ),
      orderBy: [desc(recurringCharges.montantHt)],
    });
    return ok(rows);
  });
}

/**
 * Détecte les transactions sortantes récurrentes (même libellé + montant
 * sur 3 mois consécutifs) qui ne sont pas déjà déclarées comme charge
 * récurrente.
 *
 * Heuristique simple : groupe par libellé normalisé + montant arrondi (±1€)
 * + compte ≥ 3 occurrences sur 3 mois consécutifs.
 */
export async function detectRecurringFromTransactions(): Promise<
  ActionResult<
    Array<{
      libelleSample: string;
      averageAmount: string;
      occurrenceCount: number;
      lastSeen: Date;
      suggestedCategory: string | null;
    }>
  >
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    if (!(await canAccessCockpit(user, null))) {
      return err("Accès Cockpit refusé.", "forbidden");
    }
    const orgAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.organizationId, user.organizationId),
      columns: { id: true },
    });
    const accountIds = orgAccounts.map((a) => a.id);
    if (accountIds.length === 0) return ok([]);

    const txs = await db.query.bankTransactions.findMany({
      where: inArray(bankTransactions.bankAccountId, accountIds),
      columns: {
        libelle: true,
        amountTtc: true,
        transactionDate: true,
        category: true,
      },
    });

    // Garde uniquement sorties
    const sortants = txs.filter((t) => Number(t.amountTtc ?? 0) < 0);

    type Bucket = {
      libelleSample: string;
      amountKey: string;
      occurrences: Date[];
      sumAmount: Decimal;
      category: string | null;
    };
    const buckets = new Map<string, Bucket>();
    for (const t of sortants) {
      const lib = normalizeLibelle(t.libelle);
      const amountRounded = new Decimal(t.amountTtc ?? "0")
        .abs()
        .toDecimalPlaces(0)
        .toString();
      const key = `${lib}|${amountRounded}`;
      const cur = buckets.get(key) ?? {
        libelleSample: t.libelle,
        amountKey: amountRounded,
        occurrences: [],
        sumAmount: new Decimal(0),
        category: t.category,
      };
      cur.occurrences.push(t.transactionDate);
      cur.sumAmount = cur.sumAmount.plus(new Decimal(t.amountTtc ?? "0").abs());
      buckets.set(key, cur);
    }

    // Filtre : >=3 occurrences ET pas déjà en charge active.
    const existing = await db.query.recurringCharges.findMany({
      where: eq(recurringCharges.organizationId, user.organizationId),
      columns: { libelle: true },
    });
    const existingLibs = new Set(
      existing.map((c) => normalizeLibelle(c.libelle)),
    );

    const suggestions = [...buckets.values()]
      .filter(
        (b) =>
          b.occurrences.length >= 3 &&
          !existingLibs.has(normalizeLibelle(b.libelleSample)),
      )
      .map((b) => ({
        libelleSample: b.libelleSample,
        averageAmount: b.sumAmount.div(b.occurrences.length).toFixed(2),
        occurrenceCount: b.occurrences.length,
        lastSeen: b.occurrences.sort((a, b2) => b2.getTime() - a.getTime())[0],
        suggestedCategory: b.category,
      }))
      .sort(
        (a, b) => Number(b.averageAmount) - Number(a.averageAmount),
      )
      .slice(0, 10);

    return ok(suggestions);
  });
}

function normalizeLibelle(libelle: string): string {
  return libelle
    .toLowerCase()
    .replace(/^(cb |prlv |sepa |vir )+/g, "")
    .replace(/\s+\d{4,}\b/g, "") // codes numériques
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
