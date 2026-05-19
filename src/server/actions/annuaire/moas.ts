"use server";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { moas, moaContacts } from "@/db/schema/annuaire";
import { operations } from "@/db/schema/operations";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

const AddressFields = {
  adresseLigne1: z.string().max(160).optional().nullable(),
  adresseLigne2: z.string().max(160).optional().nullable(),
  codePostal: z.string().max(10).optional().nullable(),
  ville: z.string().max(80).optional().nullable(),
  pays: z.string().max(60).optional().nullable(),
};

const MoaTypeEnum = z.enum([
  "particulier",
  "sci",
  "sas",
  "sarl",
  "sa",
  "association",
  "collectivite",
  "autre",
]);

const MoaCreateSchema = z.object({
  typeJuridique: MoaTypeEnum,
  raisonSociale: z.string().min(1, "Nom obligatoire.").max(160),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET = 14 chiffres.")
    .optional()
    .nullable(),
  ...AddressFields,
});

const MoaUpdateSchema = MoaCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const MoaIdSchema = z.object({ id: z.string().uuid() });

const ListMoasSchema = z.object({
  search: z.string().optional(),
  includeArchived: z.boolean().default(false),
});

export type MoaRow = typeof moas.$inferSelect;

export async function createMoa(
  rawInput: z.infer<typeof MoaCreateSchema>,
): Promise<ActionResult<MoaRow>> {
  return withAction(MoaCreateSchema, rawInput, async (input, { user }) => {
    const [row] = await db
      .insert(moas)
      .values({
        organizationId: user.organizationId,
        typeJuridique: input.typeJuridique,
        raisonSociale: input.raisonSociale,
        siret: input.siret ?? null,
        adresseLigne1: input.adresseLigne1 ?? null,
        adresseLigne2: input.adresseLigne2 ?? null,
        codePostal: input.codePostal ?? null,
        ville: input.ville ?? null,
        pays: input.pays ?? "France",
      })
      .returning();
    revalidatePath("/annuaire");
    return ok(row);
  });
}

export async function updateMoa(
  rawInput: z.infer<typeof MoaUpdateSchema>,
): Promise<ActionResult<MoaRow>> {
  return withAction(MoaUpdateSchema, rawInput, async (input, { user }) => {
    const { id, ...patch } = input;
    const [row] = await db
      .update(moas)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(moas.id, id), eq(moas.organizationId, user.organizationId)))
      .returning();
    if (!row) return err("MOA introuvable.", "not_found");
    revalidatePath("/annuaire");
    revalidatePath(`/annuaire/moa/${id}`);
    return ok(row);
  });
}

export async function archiveMoa(
  rawInput: z.infer<typeof MoaIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(MoaIdSchema, rawInput, async ({ id }, { user }) => {
    const [row] = await db
      .update(moas)
      .set({ archivedAt: new Date() })
      .where(and(eq(moas.id, id), eq(moas.organizationId, user.organizationId)))
      .returning({ id: moas.id });
    if (!row) return err("MOA introuvable.", "not_found");
    revalidatePath("/annuaire");
    return ok({ id: row.id });
  });
}

export async function deleteMoa(
  rawInput: z.infer<typeof MoaIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(MoaIdSchema, rawInput, async ({ id }, { user }) => {
    const opCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(operations)
      .where(eq(operations.moaId, id));
    const n = opCount[0]?.count ?? 0;
    if (n > 0) {
      return err(
        `MOA utilisé sur ${n} opération${n > 1 ? "s" : ""} — archive-le plutôt.`,
        "has_dependencies",
      );
    }
    const [row] = await db
      .delete(moas)
      .where(and(eq(moas.id, id), eq(moas.organizationId, user.organizationId)))
      .returning({ id: moas.id });
    if (!row) return err("MOA introuvable.", "not_found");
    revalidatePath("/annuaire");
    return ok({ id: row.id });
  });
}

export async function listMoas(
  rawInput: z.input<typeof ListMoasSchema> = {},
): Promise<ActionResult<MoaRow[]>> {
  return withAction(ListMoasSchema, rawInput, async (input, { user }) => {
    const filters = [eq(moas.organizationId, user.organizationId)];
    if (!input.includeArchived) filters.push(isNull(moas.archivedAt));
    if (input.search) {
      const term = `%${input.search}%`;
      const f = or(ilike(moas.raisonSociale, term), ilike(moas.siret, term));
      if (f) filters.push(f);
    }
    const rows = await db.query.moas.findMany({
      where: and(...filters),
      orderBy: [desc(moas.updatedAt)],
      limit: 200,
    });
    return ok(rows);
  });
}

export async function getMoaById(rawInput: z.infer<typeof MoaIdSchema>) {
  return withAction(MoaIdSchema, rawInput, async ({ id }, { user }) => {
    const moa = await db.query.moas.findFirst({
      where: and(eq(moas.id, id), eq(moas.organizationId, user.organizationId)),
      with: { contacts: true },
    });
    if (!moa) return err("MOA introuvable.", "not_found");
    return ok(moa);
  });
}

// Suppress unused import for moaContacts (used in relations only).
void moaContacts;
