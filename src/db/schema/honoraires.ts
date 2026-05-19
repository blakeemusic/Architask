import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { moas } from "./annuaire";
import { files } from "./files";
import { operations } from "./operations";
import {
  money,
  moneyOptional,
  pctValue,
  pk,
  timestamps,
} from "./_shared";

// ============================================================
// Enums
// ============================================================

export const honoraireContractStatusEnum = pgEnum(
  "honoraire_contract_status",
  ["brouillon", "a_signer", "signe", "en_execution", "clos"],
);

export const modeFacturationEnum = pgEnum("mode_facturation", [
  "forfait",
  "pct_travaux",
  "mixte",
]);

export const missionTypeValeurEnum = pgEnum("mission_type_valeur", [
  "pct",
  "montant",
]);

export const honoraireSituationStatusEnum = pgEnum(
  "honoraire_situation_status",
  ["brouillon", "a_valider", "signee", "envoyee", "payee"],
);

// ============================================================
// honoraire_contracts — 1:1 avec operation
// ============================================================

export const honoraireContracts = pgTable(
  "honoraire_contracts",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    moaId: uuid("moa_id").references(() => moas.id, { onDelete: "restrict" }),
    dateSignature: date("date_signature", { mode: "date" }),
    modeFacturation: modeFacturationEnum("mode_facturation").notNull(),
    montantTotalHt: money("montant_total_ht"),
    /** TVA — 20 % par défaut. */
    tauxTva: pctValue("taux_tva").notNull().default("20.00"),
    /** Délai paiement — 30 jours par défaut. */
    delaiPaiementJours: integer("delai_paiement_jours").notNull().default(30),
    /** Snapshot du marché travaux à la signature (pour calcul %). */
    marcheReferenceHt: moneyOptional("marche_reference_ht"),
    signedFileId: uuid("signed_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    statut: honoraireContractStatusEnum("statut")
      .notNull()
      .default("brouillon"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("honoraire_contracts_operation_unique").on(table.operationId),
    index("honoraire_contracts_moa_idx").on(table.moaId),
    check(
      "honoraire_contracts_montant_positive_ck",
      sql`${table.montantTotalHt} >= 0`,
    ),
    check(
      "honoraire_contracts_tva_range_ck",
      sql`${table.tauxTva} >= 0 AND ${table.tauxTva} <= 100`,
    ),
  ],
);

// ============================================================
// honoraire_missions — missions libres (pas d'enum de libellés)
//
// Règle agrégat (vérifiée en server action, pas en CHECK Postgres) :
//   - Si type=pct : Σ pct_du_total = 100% à la signature du contrat
//   - Si type=montant : Σ montant_ht = montant_total_ht
// ============================================================

export const honoraireMissions = pgTable(
  "honoraire_missions",
  {
    id: pk(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => honoraireContracts.id, { onDelete: "cascade" }),
    libelle: text("libelle").notNull(),
    ordre: integer("ordre").notNull(),
    typeValeur: missionTypeValeurEnum("type_valeur").notNull(),
    /** % du total honoraires (si type=pct). */
    pctDuTotal: pctValue("pct_du_total"),
    /** Montant HT explicite (si type=montant). */
    montantHt: moneyOptional("montant_ht"),
    /** Cache du montant calculé (HT). Recalculé à chaque save. */
    montantCalcule: moneyOptional("montant_calcule"),
    /** Avancement courant (0..100). Doit être monotone croissant. */
    pctAvancementCourant: pctValue("pct_avancement_courant")
      .notNull()
      .default("0.00"),
    description: text("description"),
    ...timestamps(),
  },
  (table) => [
    index("honoraire_missions_contract_idx").on(table.contractId),
    uniqueIndex("honoraire_missions_contract_ordre_unique").on(
      table.contractId,
      table.ordre,
    ),
    check(
      "honoraire_missions_pct_range_ck",
      sql`${table.pctDuTotal} IS NULL OR (${table.pctDuTotal} >= 0 AND ${table.pctDuTotal} <= 100)`,
    ),
    check(
      "honoraire_missions_avancement_range_ck",
      sql`${table.pctAvancementCourant} >= 0 AND ${table.pctAvancementCourant} <= 100`,
    ),
    check(
      "honoraire_missions_type_valeur_consistency_ck",
      sql`(${table.typeValeur} = 'pct' AND ${table.pctDuTotal} IS NOT NULL) OR (${table.typeValeur} = 'montant' AND ${table.montantHt} IS NOT NULL)`,
    ),
  ],
);

// ============================================================
// honoraire_situations — facturation d'avancement par mission
//
// Numérotation : NH-{op-code}-{year}-{N} via numbering_counters.
//
// Règle métier (vérifiée en CHECK + server action) :
//   pct_avancement_nouveau >= pct_avancement_precedent (pas de retour arrière).
// ============================================================

export const honoraireSituations = pgTable(
  "honoraire_situations",
  {
    id: pk(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => honoraireContracts.id, { onDelete: "restrict" }),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => honoraireMissions.id, { onDelete: "restrict" }),
    numero: text("numero").notNull(),
    dateEmission: date("date_emission", { mode: "date" }).notNull(),
    pctAvancementNouveau: pctValue("pct_avancement_nouveau").notNull(),
    pctAvancementPrecedent: pctValue("pct_avancement_precedent").notNull(),
    /** Delta à facturer = (pct_nouveau - pct_precedent) × montant mission. */
    montantHt: money("montant_ht"),
    montantTva: money("montant_tva"),
    montantTtc: money("montant_ttc"),
    statut: honoraireSituationStatusEnum("statut")
      .notNull()
      .default("brouillon"),
    generatedPdfFileId: uuid("generated_pdf_file_id").references(
      () => files.id,
      { onDelete: "set null" },
    ),
    signedPdfFileId: uuid("signed_pdf_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("honoraire_situations_contract_numero_unique").on(
      table.contractId,
      table.numero,
    ),
    index("honoraire_situations_contract_idx").on(table.contractId),
    index("honoraire_situations_mission_idx").on(table.missionId),
    index("honoraire_situations_statut_idx").on(table.statut),
    check(
      "honoraire_situations_avancement_monotone_ck",
      sql`${table.pctAvancementNouveau} >= ${table.pctAvancementPrecedent}`,
    ),
    check(
      "honoraire_situations_pct_range_ck",
      sql`${table.pctAvancementNouveau} >= 0 AND ${table.pctAvancementNouveau} <= 100`,
    ),
    check("honoraire_situations_ttc_positive_ck", sql`${table.montantTtc} >= 0`),
  ],
);

// ============================================================
// Relations
// ============================================================

export const honoraireContractsRelations = relations(
  honoraireContracts,
  ({ one, many }) => ({
    operation: one(operations, {
      fields: [honoraireContracts.operationId],
      references: [operations.id],
    }),
    moa: one(moas, {
      fields: [honoraireContracts.moaId],
      references: [moas.id],
    }),
    creator: one(users, {
      fields: [honoraireContracts.createdBy],
      references: [users.id],
    }),
    missions: many(honoraireMissions),
    situations: many(honoraireSituations),
  }),
);

export const honoraireMissionsRelations = relations(
  honoraireMissions,
  ({ one, many }) => ({
    contract: one(honoraireContracts, {
      fields: [honoraireMissions.contractId],
      references: [honoraireContracts.id],
    }),
    situations: many(honoraireSituations),
  }),
);

export const honoraireSituationsRelations = relations(
  honoraireSituations,
  ({ one }) => ({
    contract: one(honoraireContracts, {
      fields: [honoraireSituations.contractId],
      references: [honoraireContracts.id],
    }),
    mission: one(honoraireMissions, {
      fields: [honoraireSituations.missionId],
      references: [honoraireMissions.id],
    }),
    generatedPdf: one(files, {
      fields: [honoraireSituations.generatedPdfFileId],
      references: [files.id],
    }),
    signedPdf: one(files, {
      fields: [honoraireSituations.signedPdfFileId],
      references: [files.id],
    }),
  }),
);
