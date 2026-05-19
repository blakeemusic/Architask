"use server";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { companies, companyContacts, insurances } from "@/db/schema/annuaire";
import { lots, operations } from "@/db/schema/operations";
import { computeInsuranceStatus } from "@/lib/validation/insurance";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// Liste des statuts opération qui comptent comme "chantier actif".
const ACTIVE_OPERATION_STATUS = [
  "signe",
  "en_execution",
  "en_reception",
  "dgd",
] as const;

// ---------------------------------------------------------------
// Schémas Zod
// ---------------------------------------------------------------

const AddressFields = {
  adresseLigne1: z.string().max(160).optional().nullable(),
  adresseLigne2: z.string().max(160).optional().nullable(),
  codePostal: z.string().max(10).optional().nullable(),
  ville: z.string().max(80).optional().nullable(),
  pays: z.string().max(60).optional().nullable(),
};

const CompanyCreateSchema = z.object({
  raisonSociale: z.string().min(1, "Raison sociale obligatoire.").max(160),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET = 14 chiffres.")
    .optional()
    .nullable(),
  formeJuridique: z.string().max(60).optional().nullable(),
  ...AddressFields,
});

const CompanyUpdateSchema = CompanyCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const CompanyIdSchema = z.object({ id: z.string().uuid() });

const ListCompaniesSchema = z.object({
  search: z.string().optional(),
  hasValidDecennale: z.boolean().optional(),
  activity: z.string().optional(),
  includeArchived: z.boolean().default(false),
});

// ---------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------

export type CompanyRow = typeof companies.$inferSelect;
export type CompanyListItem = CompanyRow & {
  decennaleStatus: "valide" | "expirant_60j" | "expire" | "absente";
  decennaleDaysRemaining: number | null;
  /** Chantiers actifs sur lesquels la company a au moins un lot. */
  activeOperationsCount: number;
  /** Σ montants marchés signés + avenants signés sur les opérations actives. */
  engagedHt: string;
};

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function createCompany(
  rawInput: z.infer<typeof CompanyCreateSchema>,
): Promise<ActionResult<CompanyRow>> {
  return withAction(CompanyCreateSchema, rawInput, async (input, { user }) => {
    const [row] = await db
      .insert(companies)
      .values({
        organizationId: user.organizationId,
        raisonSociale: input.raisonSociale,
        siret: input.siret ?? null,
        formeJuridique: input.formeJuridique ?? null,
        adresseLigne1: input.adresseLigne1 ?? null,
        adresseLigne2: input.adresseLigne2 ?? null,
        codePostal: input.codePostal ?? null,
        ville: input.ville ?? null,
        pays: input.pays ?? "France",
        paletteSeed: input.siret ?? input.raisonSociale,
      })
      .returning();
    revalidatePath("/annuaire");
    return ok(row);
  });
}

export async function updateCompany(
  rawInput: z.infer<typeof CompanyUpdateSchema>,
): Promise<ActionResult<CompanyRow>> {
  return withAction(CompanyUpdateSchema, rawInput, async (input, { user }) => {
    const { id, ...patch } = input;
    const [row] = await db
      .update(companies)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companies.id, id),
          eq(companies.organizationId, user.organizationId),
        ),
      )
      .returning();
    if (!row) return err("Entreprise introuvable.", "not_found");
    revalidatePath("/annuaire");
    revalidatePath(`/annuaire/entreprise/${id}`);
    return ok(row);
  });
}

export async function archiveCompany(
  rawInput: z.infer<typeof CompanyIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(CompanyIdSchema, rawInput, async ({ id }, { user }) => {
    const [row] = await db
      .update(companies)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(companies.id, id),
          eq(companies.organizationId, user.organizationId),
        ),
      )
      .returning({ id: companies.id });
    if (!row) return err("Entreprise introuvable.", "not_found");
    revalidatePath("/annuaire");
    return ok({ id: row.id });
  });
}

export async function unarchiveCompany(
  rawInput: z.infer<typeof CompanyIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(CompanyIdSchema, rawInput, async ({ id }, { user }) => {
    const [row] = await db
      .update(companies)
      .set({ archivedAt: null })
      .where(
        and(
          eq(companies.id, id),
          eq(companies.organizationId, user.organizationId),
        ),
      )
      .returning({ id: companies.id });
    if (!row) return err("Entreprise introuvable.", "not_found");
    revalidatePath("/annuaire");
    return ok({ id: row.id });
  });
}

/**
 * Hard delete : autorisé UNIQUEMENT si aucun lot ne référence l'entreprise.
 * Sinon on suggère d'archiver.
 */
export async function deleteCompany(
  rawInput: z.infer<typeof CompanyIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(CompanyIdSchema, rawInput, async ({ id }, { user }) => {
    const lotCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lots)
      .where(eq(lots.companyId, id));
    const n = lotCount[0]?.count ?? 0;
    if (n > 0) {
      return err(
        `Entreprise utilisée sur ${n} marché${n > 1 ? "s" : ""} — archive-la plutôt.`,
        "has_dependencies",
      );
    }
    const [row] = await db
      .delete(companies)
      .where(
        and(
          eq(companies.id, id),
          eq(companies.organizationId, user.organizationId),
        ),
      )
      .returning({ id: companies.id });
    if (!row) return err("Entreprise introuvable.", "not_found");
    revalidatePath("/annuaire");
    return ok({ id: row.id });
  });
}

// ---------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------

/**
 * Liste paginée des entreprises avec leurs assurances (pour calculer le
 * statut décennale). Filtres : search texte (raison sociale / SIRET),
 * hasValidDecennale, activity, includeArchived.
 */
export async function listCompanies(
  rawInput: z.input<typeof ListCompaniesSchema> = {},
): Promise<ActionResult<CompanyListItem[]>> {
  return withAction(ListCompaniesSchema, rawInput, async (input, { user }) => {
    const filters = [eq(companies.organizationId, user.organizationId)];
    if (!input.includeArchived) filters.push(isNull(companies.archivedAt));
    if (input.search) {
      const term = `%${input.search}%`;
      const orFilter = or(
        ilike(companies.raisonSociale, term),
        ilike(companies.siret, term),
      );
      if (orFilter) filters.push(orFilter);
    }

    const rows = await db.query.companies.findMany({
      where: and(...filters),
      orderBy: [desc(companies.updatedAt)],
      with: {
        insurances: true,
        // On charge les lots actifs + avenants signés pour computer le
        // nombre de chantiers et le montant engagé par entreprise.
        // En MVP ~10 entreprises × ~5 lots → coût acceptable.
      },
      limit: 200,
    });

    const companyIds = rows.map((c) => c.id);
    const lotsAgg =
      companyIds.length === 0
        ? []
        : await db
            .select({
              companyId: lots.companyId,
              operationId: lots.operationId,
              montantMarcheHt: lots.montantMarcheHt,
            })
            .from(lots)
            .innerJoin(operations, eq(operations.id, lots.operationId))
            .where(
              and(
                isNotNull(lots.companyId),
                inArray(lots.companyId, companyIds),
                inArray(operations.statut, [...ACTIVE_OPERATION_STATUS]),
                isNull(operations.archivedAt),
              ),
            );

    const aggByCompany = new Map<
      string,
      { ops: Set<string>; total: number }
    >();
    for (const r of lotsAgg) {
      if (!r.companyId) continue;
      const entry = aggByCompany.get(r.companyId) ?? {
        ops: new Set(),
        total: 0,
      };
      entry.ops.add(r.operationId);
      entry.total += Number(r.montantMarcheHt ?? 0);
      aggByCompany.set(r.companyId, entry);
    }

    const today = new Date();
    const items: CompanyListItem[] = rows.map((c) => {
      const decennales = c.insurances.filter((i) => i.type === "decennale");
      const agg = aggByCompany.get(c.id) ?? { ops: new Set(), total: 0 };
      const baseListItem = {
        ...stripInsurances(c),
        activeOperationsCount: agg.ops.size,
        engagedHt: agg.total.toFixed(2),
      };
      if (decennales.length === 0) {
        return {
          ...baseListItem,
          decennaleStatus: "absente" as const,
          decennaleDaysRemaining: null,
        };
      }
      // Pick the one with latest dateFin (most "fresh").
      const latest = decennales.reduce((a, b) =>
        a.dateFin > b.dateFin ? a : b,
      );
      const status = computeInsuranceStatus({ dateFin: latest.dateFin }, today);
      const daysRemaining = Math.floor(
        (latest.dateFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        ...baseListItem,
        decennaleStatus: status,
        decennaleDaysRemaining: daysRemaining,
      };
    });

    // Filter post-fetch si hasValidDecennale demandé (économise la requête
    // SQL complexe en MVP).
    const filtered =
      input.hasValidDecennale === undefined
        ? items
        : items.filter((i) =>
            input.hasValidDecennale
              ? i.decennaleStatus === "valide" ||
                i.decennaleStatus === "expirant_60j"
              : i.decennaleStatus === "expire" ||
                i.decennaleStatus === "absente",
          );

    return ok(filtered);
  });
}

function stripInsurances(
  c: CompanyRow & { insurances: unknown },
): CompanyRow {
  const { insurances: _drop, ...rest } = c as CompanyRow & { insurances: unknown };
  void _drop;
  return rest;
}

/**
 * Détail complet d'une entreprise : insurances + contacts.
 */
export async function getCompanyById(
  rawInput: z.infer<typeof CompanyIdSchema>,
) {
  return withAction(CompanyIdSchema, rawInput, async ({ id }, { user }) => {
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.organizationId, user.organizationId),
      ),
      with: {
        insurances: { orderBy: [desc(insurances.dateFin)] },
        contacts: true,
      },
    });
    if (!company) return err("Entreprise introuvable.", "not_found");
    return ok(company);
  });
}

/**
 * KPIs pour la page liste : % décennales valides, count expirant <60j,
 * total entreprises. Chantiers actifs + volume engagé sont mockés à 0 —
 * TODO Sprint Opérations : connecter sur COUNT(lots) + SUM(montant_marche).
 */
export async function getAnnuaireKpis(): Promise<
  ActionResult<{
    totalCompanies: number;
    validPct: number;
    expiringSoon: number;
    activeChantiers: number;
    volumeEngageHt: string;
  }>
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    const rows = await db.query.companies.findMany({
      where: and(
        eq(companies.organizationId, user.organizationId),
        isNull(companies.archivedAt),
      ),
      with: { insurances: true },
    });
    const today = new Date();
    let validCount = 0;
    let expiringSoonCount = 0;
    for (const c of rows) {
      const dec = c.insurances.find((i) => i.type === "decennale");
      if (!dec) continue;
      const status = computeInsuranceStatus({ dateFin: dec.dateFin }, today);
      if (status === "valide" || status === "expirant_60j") validCount += 1;
      if (status === "expirant_60j") expiringSoonCount += 1;
    }
    const total = rows.length;
    const validPct = total === 0 ? 0 : Math.round((validCount / total) * 100);

    // Chantiers actifs + volume engagé HT : agrégation depuis lots × operations
    // (Σ par opération active dans l'org).
    const aggRows = await db
      .select({
        operationId: lots.operationId,
        montantMarcheHt: lots.montantMarcheHt,
      })
      .from(lots)
      .innerJoin(operations, eq(operations.id, lots.operationId))
      .where(
        and(
          eq(operations.organizationId, user.organizationId),
          inArray(operations.statut, [...ACTIVE_OPERATION_STATUS]),
          isNull(operations.archivedAt),
        ),
      );
    const activeOpsSet = new Set<string>();
    let volume = 0;
    for (const r of aggRows) {
      activeOpsSet.add(r.operationId);
      volume += Number(r.montantMarcheHt ?? 0);
    }
    // TODO Sprint Avenants : déjà ici on prend juste le marché initial des lots.
    //   Les avenants signés s'ajoutent au "vrai" volume engagé — ils sont déjà
    //   pris en compte côté operations.volumeEngageHt mais pas ici (perf).

    return ok({
      totalCompanies: total,
      validPct,
      expiringSoon: expiringSoonCount,
      activeChantiers: activeOpsSet.size,
      volumeEngageHt: volume.toFixed(2),
    });
  });
}

// Petit hack : éviter l'erreur "unused" si companyContacts pas utilisé.
void companyContacts;
