"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { moaContacts, moas } from "@/db/schema/annuaire";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

const MoaContactCreateSchema = z.object({
  moaId: z.string().uuid(),
  name: z.string().min(1, "Nom obligatoire.").max(120),
  role: z.string().max(60).optional().nullable(),
  email: z.string().email("Email invalide.").optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

const MoaContactUpdateSchema = MoaContactCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const MoaContactIdSchema = z.object({ id: z.string().uuid() });

async function assertOwnership(contactId: string, organizationId: string) {
  const c = await db.query.moaContacts.findFirst({
    where: eq(moaContacts.id, contactId),
    with: { moa: { columns: { organizationId: true, id: true } } },
  });
  if (!c || c.moa.organizationId !== organizationId) return null;
  return c;
}

export async function createMoaContact(
  rawInput: z.infer<typeof MoaContactCreateSchema>,
): Promise<ActionResult<typeof moaContacts.$inferSelect>> {
  return withAction(MoaContactCreateSchema, rawInput, async (input, { user }) => {
    const m = await db.query.moas.findFirst({
      where: and(
        eq(moas.id, input.moaId),
        eq(moas.organizationId, user.organizationId),
      ),
      columns: { id: true },
    });
    if (!m) return err("MOA introuvable.", "not_found");
    const [row] = await db
      .insert(moaContacts)
      .values({
        moaId: input.moaId,
        name: input.name,
        role: input.role ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .returning();
    revalidatePath(`/annuaire/moa/${input.moaId}`);
    return ok(row);
  });
}

export async function updateMoaContact(
  rawInput: z.infer<typeof MoaContactUpdateSchema>,
): Promise<ActionResult<typeof moaContacts.$inferSelect>> {
  return withAction(MoaContactUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await assertOwnership(input.id, user.organizationId);
    if (!existing) return err("Contact introuvable.", "not_found");
    const { id, moaId: _drop, ...patch } = input;
    void _drop;
    const [row] = await db
      .update(moaContacts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(moaContacts.id, id))
      .returning();
    revalidatePath(`/annuaire/moa/${existing.moa.id}`);
    return ok(row);
  });
}

export async function deleteMoaContact(
  rawInput: z.infer<typeof MoaContactIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(MoaContactIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await assertOwnership(id, user.organizationId);
    if (!existing) return err("Contact introuvable.", "not_found");
    await db.delete(moaContacts).where(eq(moaContacts.id, id));
    revalidatePath(`/annuaire/moa/${existing.moa.id}`);
    return ok({ id });
  });
}
