import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "./auth";
import { files } from "./files";
import { money, pk, timestamps } from "./_shared";

// ============================================================
// Enums
// ============================================================

export const insuranceTypeEnum = pgEnum("insurance_type", [
  "decennale",
  "rc_pro",
  "gpa",
]);

/**
 * Statut calculé d'une assurance (snapshot, recalculé par cron / au read).
 * - valide : date_fin > now() + 60 jours
 * - expirant_60j : 0 < (date_fin - now()) <= 60 jours
 * - expire : date_fin <= now()
 */
export const insuranceStatusEnum = pgEnum("insurance_status", [
  "valide",
  "expirant_60j",
  "expire",
]);

export const companyContactRoleEnum = pgEnum("company_contact_role", [
  "gerant",
  "conducteur",
  "comptabilite",
  "autre",
]);

export const moaTypeJuridiqueEnum = pgEnum("moa_type_juridique", [
  "particulier",
  "sci",
  "sas",
  "sarl",
  "sa",
  "association",
  "collectivite",
  "autre",
]);

// ============================================================
// companies — annuaire entreprises
// ============================================================

export const companies = pgTable(
  "companies",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    raisonSociale: text("raison_sociale").notNull(),
    siret: text("siret"),
    formeJuridique: text("forme_juridique"),
    adresseLigne1: text("adresse_ligne_1"),
    adresseLigne2: text("adresse_ligne_2"),
    codePostal: text("code_postal"),
    ville: text("ville"),
    pays: text("pays").default("France"),
    logoFileId: uuid("logo_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    /** Seed pour le gradient stable du CompanyLogo (SIRET ou raison_sociale). */
    paletteSeed: text("palette_seed").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("companies_organization_id_idx").on(table.organizationId),
    uniqueIndex("companies_org_siret_unique")
      .on(table.organizationId, table.siret)
      .where(sql`${table.siret} IS NOT NULL`),
    index("companies_raison_sociale_idx").on(table.raisonSociale),
  ],
);

// ============================================================
// company_contacts — multi-contacts par entreprise
// ============================================================

export const companyContacts = pgTable(
  "company_contacts",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: companyContactRoleEnum("role").notNull().default("autre"),
    email: text("email"),
    phone: text("phone"),
    ...timestamps(),
  },
  (table) => [index("company_contacts_company_idx").on(table.companyId)],
);

// ============================================================
// insurances — décennale, RC pro, GPA (versionnées)
// ============================================================

export const insurances = pgTable(
  "insurances",
  {
    id: pk(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: insuranceTypeEnum("type").notNull(),
    compagnie: text("compagnie").notNull(),
    numPolice: text("num_police").notNull(),
    montantGaranti: money("montant_garanti"),
    dateDebut: date("date_debut", { mode: "date" }).notNull(),
    dateFin: date("date_fin", { mode: "date" }).notNull(),
    /** Activités couvertes (taxonomie type Qualibat, libre en MVP). */
    activitesCouvertes: text("activites_couvertes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    attestationFileId: uuid("attestation_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    /** Statut calculé snapshot — recalculé par cron quotidien (ou au read). */
    status: insuranceStatusEnum("status").notNull().default("valide"),
    ...timestamps(),
  },
  (table) => [
    index("insurances_company_idx").on(table.companyId),
    index("insurances_company_type_idx").on(table.companyId, table.type),
    index("insurances_date_fin_idx").on(table.dateFin),
    check("insurances_date_range_ck", sql`${table.dateFin} > ${table.dateDebut}`),
    check(
      "insurances_montant_positive_ck",
      sql`${table.montantGaranti} >= 0`,
    ),
  ],
);

// ============================================================
// moas — annuaire maîtres d'ouvrage
// ============================================================

export const moas = pgTable(
  "moas",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    typeJuridique: moaTypeJuridiqueEnum("type_juridique").notNull(),
    raisonSociale: text("raison_sociale").notNull(),
    siret: text("siret"),
    adresseLigne1: text("adresse_ligne_1"),
    adresseLigne2: text("adresse_ligne_2"),
    codePostal: text("code_postal"),
    ville: text("ville"),
    pays: text("pays").default("France"),
    ...timestamps(),
  },
  (table) => [
    index("moas_organization_id_idx").on(table.organizationId),
    index("moas_raison_sociale_idx").on(table.raisonSociale),
  ],
);

// ============================================================
// moa_contacts
// ============================================================

export const moaContacts = pgTable(
  "moa_contacts",
  {
    id: pk(),
    moaId: uuid("moa_id")
      .notNull()
      .references(() => moas.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    ...timestamps(),
  },
  (table) => [index("moa_contacts_moa_idx").on(table.moaId)],
);

// ============================================================
// Relations
// ============================================================

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  logo: one(files, {
    fields: [companies.logoFileId],
    references: [files.id],
  }),
  contacts: many(companyContacts),
  insurances: many(insurances),
}));

export const companyContactsRelations = relations(
  companyContacts,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyContacts.companyId],
      references: [companies.id],
    }),
  }),
);

export const insurancesRelations = relations(insurances, ({ one }) => ({
  company: one(companies, {
    fields: [insurances.companyId],
    references: [companies.id],
  }),
  attestation: one(files, {
    fields: [insurances.attestationFileId],
    references: [files.id],
  }),
}));

export const moasRelations = relations(moas, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [moas.organizationId],
    references: [organizations.id],
  }),
  contacts: many(moaContacts),
}));

export const moaContactsRelations = relations(moaContacts, ({ one }) => ({
  moa: one(moas, {
    fields: [moaContacts.moaId],
    references: [moas.id],
  }),
}));
