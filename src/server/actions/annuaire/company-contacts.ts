"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { companies, companyContacts } from "@/db/schema/annuaire";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

const ContactCreateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1, "Nom obligatoire.").max(120),
  role: z.enum(["gerant", "conducteur", "comptabilite", "autre"]).default("autre"),
  email: z.string().email("Email invalide.").optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

const ContactUpdateSchema = ContactCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const ContactIdSchema = z.object({ id: z.string().uuid() });

async function assertOwnership(contactId: string, organizationId: string) {
  const c = await db.query.companyContacts.findFirst({
    where: eq(companyContacts.id, contactId),
    with: { company: { columns: { organizationId: true, id: true } } },
  });
  if (!c || c.company.organizationId !== organizationId) return null;
  return c;
}

export async function createCompanyContact(
  rawInput: z.infer<typeof ContactCreateSchema>,
): Promise<ActionResult<typeof companyContacts.$inferSelect>> {
  return withAction(ContactCreateSchema, rawInput, async (input, { user }) => {
    const c = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, input.companyId),
        eq(companies.organizationId, user.organizationId),
      ),
      columns: { id: true },
    });
    if (!c) return err("Entreprise introuvable.", "not_found");

    const [row] = await db
      .insert(companyContacts)
      .values({
        companyId: input.companyId,
        name: input.name,
        role: input.role,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .returning();
    revalidatePath(`/annuaire/entreprise/${input.companyId}`);
    return ok(row);
  });
}

export async function updateCompanyContact(
  rawInput: z.infer<typeof ContactUpdateSchema>,
): Promise<ActionResult<typeof companyContacts.$inferSelect>> {
  return withAction(ContactUpdateSchema, rawInput, async (input, { user }) => {
    const existing = await assertOwnership(input.id, user.organizationId);
    if (!existing) return err("Contact introuvable.", "not_found");

    const { id, companyId: _drop, ...patch } = input;
    void _drop;
    const [row] = await db
      .update(companyContacts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(companyContacts.id, id))
      .returning();
    revalidatePath(`/annuaire/entreprise/${existing.company.id}`);
    return ok(row);
  });
}

export async function deleteCompanyContact(
  rawInput: z.infer<typeof ContactIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(ContactIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await assertOwnership(id, user.organizationId);
    if (!existing) return err("Contact introuvable.", "not_found");
    await db.delete(companyContacts).where(eq(companyContacts.id, id));
    revalidatePath(`/annuaire/entreprise/${existing.company.id}`);
    return ok({ id });
  });
}
