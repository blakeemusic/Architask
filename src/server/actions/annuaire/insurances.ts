"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { companies, insurances } from "@/db/schema/annuaire";
import { computeInsuranceStatus } from "@/lib/validation/insurance";
import { upload as uploadFile } from "@/lib/storage/local";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const InsuranceCreateSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(["decennale", "rc_pro", "gpa"]),
  compagnie: z.string().min(1, "Compagnie obligatoire.").max(160),
  numPolice: z.string().min(1, "Numéro de police obligatoire.").max(60),
  montantGaranti: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide (ex. 1200000 ou 1200000.50).")
    .optional()
    .nullable(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  activitesCouvertes: z.array(z.string()).default([]),
  /** Optionnel : fichier PDF en base64 ou en buffer. */
  attestation: z
    .object({
      base64: z.string(),
      mimeType: z.string(),
      filename: z.string(),
    })
    .optional()
    .nullable(),
});

const InsuranceUpdateSchema = z.object({
  id: z.string().uuid(),
  compagnie: z.string().max(160).optional(),
  numPolice: z.string().max(60).optional(),
  montantGaranti: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
  activitesCouvertes: z.array(z.string()).optional(),
});

const InsuranceIdSchema = z.object({ id: z.string().uuid() });
const CompanyIdSchema = z.object({ companyId: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertCompanyBelongsToOrg(
  companyId: string,
  organizationId: string,
) {
  const c = await db.query.companies.findFirst({
    where: and(
      eq(companies.id, companyId),
      eq(companies.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  return !!c;
}

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createInsurance(
  rawInput: z.infer<typeof InsuranceCreateSchema>,
): Promise<ActionResult<typeof insurances.$inferSelect>> {
  return withAction(InsuranceCreateSchema, rawInput, async (input, { user }) => {
    if (input.dateFin <= input.dateDebut) {
      return err(
        "La date de fin doit être après la date de début.",
        "invalid_date_range",
      );
    }
    if (!(await assertCompanyBelongsToOrg(input.companyId, user.organizationId))) {
      return err("Entreprise introuvable.", "not_found");
    }

    let attestationFileId: string | null = null;
    if (input.attestation) {
      const buffer = Buffer.from(input.attestation.base64, "base64");
      const result = await uploadFile({
        organizationId: user.organizationId,
        buffer,
        mimeType: input.attestation.mimeType,
        originalFilename: input.attestation.filename,
        kind: `attestation_${input.type}`,
        uploadedBy: user.userId,
      });
      attestationFileId = result.fileId;
    }

    const status = computeInsuranceStatus({ dateFin: input.dateFin });

    const [row] = await db
      .insert(insurances)
      .values({
        companyId: input.companyId,
        type: input.type,
        compagnie: input.compagnie,
        numPolice: input.numPolice,
        montantGaranti: input.montantGaranti ?? null,
        dateDebut: input.dateDebut,
        dateFin: input.dateFin,
        activitesCouvertes: input.activitesCouvertes,
        attestationFileId,
        status,
      })
      .returning();
    revalidatePath(`/annuaire/entreprise/${input.companyId}`);
    revalidatePath("/annuaire");
    return ok(row);
  });
}

export async function updateInsurance(
  rawInput: z.infer<typeof InsuranceUpdateSchema>,
): Promise<ActionResult<typeof insurances.$inferSelect>> {
  return withAction(InsuranceUpdateSchema, rawInput, async (input, { user }) => {
    const { id, ...patch } = input;

    // Vérifier que l'assurance appartient bien à une entreprise de l'org.
    const existing = await db.query.insurances.findFirst({
      where: eq(insurances.id, id),
      with: { company: { columns: { organizationId: true } } },
    });
    if (!existing || existing.company.organizationId !== user.organizationId) {
      return err("Assurance introuvable.", "not_found");
    }

    if (patch.dateDebut && patch.dateFin && patch.dateFin <= patch.dateDebut) {
      return err(
        "La date de fin doit être après la date de début.",
        "invalid_date_range",
      );
    }

    const nextDateFin = patch.dateFin ?? existing.dateFin;
    const status = computeInsuranceStatus({ dateFin: nextDateFin });

    const [row] = await db
      .update(insurances)
      .set({
        ...patch,
        status,
        updatedAt: new Date(),
      })
      .where(eq(insurances.id, id))
      .returning();
    revalidatePath(`/annuaire/entreprise/${existing.companyId}`);
    return ok(row);
  });
}

export async function deleteInsurance(
  rawInput: z.infer<typeof InsuranceIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(InsuranceIdSchema, rawInput, async ({ id }, { user }) => {
    const existing = await db.query.insurances.findFirst({
      where: eq(insurances.id, id),
      with: { company: { columns: { organizationId: true, id: true } } },
    });
    if (!existing || existing.company.organizationId !== user.organizationId) {
      return err("Assurance introuvable.", "not_found");
    }
    await db.delete(insurances).where(eq(insurances.id, id));
    revalidatePath(`/annuaire/entreprise/${existing.company.id}`);
    return ok({ id });
  });
}

export async function getInsurancesByCompany(
  rawInput: z.infer<typeof CompanyIdSchema>,
) {
  return withAction(CompanyIdSchema, rawInput, async ({ companyId }, { user }) => {
    if (!(await assertCompanyBelongsToOrg(companyId, user.organizationId))) {
      return err("Entreprise introuvable.", "not_found");
    }
    const rows = await db.query.insurances.findMany({
      where: eq(insurances.companyId, companyId),
      orderBy: [desc(insurances.dateFin)],
    });
    return ok(rows);
  });
}
