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

import { organizations, users } from "./auth";
import { companies, moas } from "./annuaire";
import { files } from "./files";
import {
  money,
  moneyOptional,
  pctValue,
  pk,
  quantity,
  timestamps,
} from "./_shared";

// ============================================================
// Enums
// ============================================================

export const operationStatusEnum = pgEnum("operation_status", [
  "en_preparation",
  "signe",
  "en_execution",
  "en_reception",
  "dgd",
  "clos",
]);

export const lotStatusEnum = pgEnum("lot_status", [
  "en_preparation",
  "signe",
  "en_execution",
  "en_reception",
  "solde",
]);

export const avenantStatusEnum = pgEnum("avenant_status", [
  "brouillon",
  "a_signer",
  "signe",
]);

export const situationSourceEnum = pgEnum("situation_source", [
  "pdf",
  "excel",
  "manual",
]);

export const ocrStatusEnum = pgEnum("ocr_status", [
  "pending",
  "processing",
  "done",
  "error",
]);

export const planningTaskTypeEnum = pgEnum("planning_task_type", [
  "lot",
  "jalon",
]);

export const milestoneKindEnum = pgEnum("milestone_kind", [
  "os",
  "demarrage_lot",
  "fin_lot",
  "reception",
  "dgd",
  "libere_retenue",
  "autre",
]);

export const planningTaskStatusEnum = pgEnum("planning_task_status", [
  "a_venir",
  "en_cours",
  "termine",
  "en_retard",
]);

export const dgdStatusEnum = pgEnum("dgd_status", [
  "brouillon",
  "a_valider",
  "signe",
]);

export const cautionStatusEnum = pgEnum("caution_status", [
  "active",
  "liberee",
  "expiree",
]);

export const retentionStatusEnum = pgEnum("retention_status", [
  "en_cours",
  "liberee",
]);

export const operationStakeholderKindEnum = pgEnum(
  "operation_stakeholder_kind",
  ["moa_secondaire", "moe", "bet", "autre"],
);

// ============================================================
// operations — chantier
// ============================================================

export const operations = pgTable(
  "operations",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /**
     * Code court (2-8 caractères, [A-Z0-9-]), unique par organisation.
     * Sert pour les numérotations : CP-{code}-{lot}-{N}, NH-{code}-{year}-{N}.
     * Auto-proposé depuis le name, modifiable avant création, verrouillé après.
     */
    code: text("code").notNull(),
    name: text("name").notNull(),
    moaId: uuid("moa_id").references(() => moas.id, { onDelete: "restrict" }),
    adresseLigne1: text("adresse_ligne_1"),
    adresseLigne2: text("adresse_ligne_2"),
    codePostal: text("code_postal"),
    ville: text("ville"),
    pays: text("pays").default("France"),
    dateOs: date("date_os", { mode: "date" }),
    dateReceptionCible: date("date_reception_cible", { mode: "date" }),
    dureePrevueJours: integer("duree_prevue_jours"),
    montantPrevisionnelHt: moneyOptional("montant_previsionnel_ht"),
    pilotUserId: uuid("pilot_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    statut: operationStatusEnum("statut").notNull().default("en_preparation"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Soft delete : symétrique à companies / moas. */
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("operations_org_code_unique").on(
      table.organizationId,
      table.code,
    ),
    index("operations_organization_id_idx").on(table.organizationId),
    index("operations_moa_idx").on(table.moaId),
    index("operations_archived_idx").on(table.organizationId, table.archivedAt),
    check(
      "operations_code_format_ck",
      sql`${table.code} ~ '^[A-Z0-9-]{2,8}$'`,
    ),
    check(
      "operations_duree_positive_ck",
      sql`${table.dureePrevueJours} IS NULL OR ${table.dureePrevueJours} >= 0`,
    ),
  ],
);

// ============================================================
// operation_stakeholders — MOA secondaires, MOE, BET, etc.
// ============================================================

export const operationStakeholders = pgTable(
  "operation_stakeholders",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    kind: operationStakeholderKindEnum("kind").notNull(),
    label: text("label").notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    ...timestamps(),
  },
  (table) => [
    index("operation_stakeholders_operation_idx").on(table.operationId),
  ],
);

// ============================================================
// lots — un par lot du chantier
// ============================================================

export const lots = pgTable(
  "lots",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    /** Numéro de lot ("01", "02a", "03"…). */
    numero: text("numero").notNull(),
    libelle: text("libelle").notNull(),
    /** Entreprise titulaire du marché. */
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "restrict",
    }),
    montantMarcheHt: money("montant_marche_ht"),
    /** TVA — 20 % par défaut (NF P03-001). */
    tauxTva: pctValue("taux_tva").notNull().default("20.00"),
    /** Formule de révision — "BT01" par défaut. Texte libre. */
    modeRevision: text("mode_revision").default("BT01"),
    /** Retenue garantie — 5 % par défaut, max 5 % (NF P03-001). */
    retenueGarantiePct: pctValue("retenue_garantie_pct")
      .notNull()
      .default("5.00"),
    /** Délai de paiement — 30 jours fin de mois par défaut. */
    delaiPaiementJours: integer("delai_paiement_jours").notNull().default(30),
    /** Snapshot : moment où la décennale a été vérifiée à la signature. */
    decennaleCheckAt: timestamp("decennale_check_at", {
      withTimezone: true,
      mode: "date",
    }),
    /** Activités attendues sur le lot (utilisées pour vérifier la décennale). */
    activitesAttendues: text("activites_attendues")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    statut: lotStatusEnum("statut").notNull().default("en_preparation"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("lots_operation_numero_unique").on(
      table.operationId,
      table.numero,
    ),
    index("lots_operation_id_idx").on(table.operationId),
    index("lots_company_id_idx").on(table.companyId),
    check("lots_montant_positive_ck", sql`${table.montantMarcheHt} >= 0`),
    check(
      "lots_tva_range_ck",
      sql`${table.tauxTva} >= 0 AND ${table.tauxTva} <= 100`,
    ),
    check(
      "lots_retenue_range_ck",
      sql`${table.retenueGarantiePct} >= 0 AND ${table.retenueGarantiePct} <= 5`,
    ),
    check(
      "lots_delai_range_ck",
      sql`${table.delaiPaiementJours} >= 0 AND ${table.delaiPaiementJours} <= 365`,
    ),
  ],
);

// ============================================================
// avenants — modifications du marché
// ============================================================

export const avenants = pgTable(
  "avenants",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    /** Numéro auto-incrémenté par lot. */
    numero: integer("numero").notNull(),
    objet: text("objet").notNull(),
    /** Peut être négatif (avenant en moins). */
    montantHt: money("montant_ht"),
    impactDelaiJours: integer("impact_delai_jours").notNull().default(0),
    dateSignature: date("date_signature", { mode: "date" }),
    statut: avenantStatusEnum("statut").notNull().default("brouillon"),
    signedFileId: uuid("signed_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("avenants_lot_numero_unique").on(table.lotId, table.numero),
    index("avenants_lot_idx").on(table.lotId),
    index("avenants_statut_idx").on(table.statut),
  ],
);

// ============================================================
// dpgf_lines — postes du Décompte Général
// ============================================================

export const dpgfLines = pgTable(
  "dpgf_lines",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    designation: text("designation").notNull(),
    unite: text("unite"),
    quantite: quantity("quantite"),
    prixUnitaireHt: moneyOptional("prix_unitaire_ht"),
    montantTotalHt: moneyOptional("montant_total_ht"),
    /** Confiance OCR 0..100 (null si saisie manuelle). */
    ocrConfidence: integer("ocr_confidence"),
    /** Commentaires libres par poste (bonus demandé par Arthur). */
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => [
    index("dpgf_lines_lot_idx").on(table.lotId),
    uniqueIndex("dpgf_lines_lot_ordre_unique").on(table.lotId, table.ordre),
    check(
      "dpgf_lines_confidence_range_ck",
      sql`${table.ocrConfidence} IS NULL OR (${table.ocrConfidence} >= 0 AND ${table.ocrConfidence} <= 100)`,
    ),
    check(
      "dpgf_lines_amounts_positive_ck",
      sql`${table.prixUnitaireHt} IS NULL OR ${table.prixUnitaireHt} >= 0`,
    ),
  ],
);

// ============================================================
// situations — situations mensuelles d'avancement (PDF entreprise)
// ============================================================

export const situations = pgTable(
  "situations",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    periodeMois: integer("periode_mois").notNull(),
    periodeAnnee: integer("periode_annee").notNull(),
    source: situationSourceEnum("source").notNull(),
    fileId: uuid("file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ocrStatus: ocrStatusEnum("ocr_status").notNull().default("pending"),
    ocrConfidence: integer("ocr_confidence"),
    ...timestamps(),
  },
  (table) => [
    index("situations_lot_idx").on(table.lotId),
    uniqueIndex("situations_lot_period_unique").on(
      table.lotId,
      table.periodeAnnee,
      table.periodeMois,
    ),
    check(
      "situations_mois_range_ck",
      sql`${table.periodeMois} >= 1 AND ${table.periodeMois} <= 12`,
    ),
    check(
      "situations_annee_range_ck",
      sql`${table.periodeAnnee} >= 2020 AND ${table.periodeAnnee} <= 2100`,
    ),
  ],
);

// ============================================================
// situation_lines — postes extraits par OCR
// ============================================================

export const situationLines = pgTable(
  "situation_lines",
  {
    id: pk(),
    situationId: uuid("situation_id")
      .notNull()
      .references(() => situations.id, { onDelete: "cascade" }),
    /** Référence au poste DPGF — null si poste hors DPGF (avenant, etc.). */
    dpgfLineId: uuid("dpgf_line_id").references(() => dpgfLines.id, {
      onDelete: "set null",
    }),
    pctAvancement: pctValue("pct_avancement").notNull(),
    montantCumuleHt: money("montant_cumule_ht"),
    ocrConfidence: integer("ocr_confidence"),
    ...timestamps(),
  },
  (table) => [
    index("situation_lines_situation_idx").on(table.situationId),
    check(
      "situation_lines_pct_range_ck",
      sql`${table.pctAvancement} >= 0 AND ${table.pctAvancement} <= 100`,
    ),
  ],
);

// ============================================================
// planning_tasks — Gantt par opération
// ============================================================

export const planningTasks = pgTable(
  "planning_tasks",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    /** Nullable si jalon global non-rattaché à un lot. */
    lotId: uuid("lot_id").references(() => lots.id, { onDelete: "cascade" }),
    type: planningTaskTypeEnum("type").notNull(),
    libelle: text("libelle").notNull(),
    dateDebutPrevue: date("date_debut_prevue", { mode: "date" }),
    dateFinPrevue: date("date_fin_prevue", { mode: "date" }),
    dateDebutReelle: date("date_debut_reelle", { mode: "date" }),
    dateFinReelle: date("date_fin_reelle", { mode: "date" }),
    statut: planningTaskStatusEnum("statut").notNull().default("a_venir"),
    milestoneKind: milestoneKindEnum("milestone_kind"),
    ...timestamps(),
  },
  (table) => [
    index("planning_tasks_operation_idx").on(table.operationId),
    index("planning_tasks_lot_idx").on(table.lotId),
    check(
      "planning_tasks_dates_order_ck",
      sql`${table.dateFinPrevue} IS NULL OR ${table.dateDebutPrevue} IS NULL OR ${table.dateFinPrevue} >= ${table.dateDebutPrevue}`,
    ),
  ],
);

// ============================================================
// pv_reception — PV de réception (1:1 avec operation)
// ============================================================

export const pvReceptions = pgTable(
  "pv_receptions",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    dateReception: date("date_reception", { mode: "date" }).notNull(),
    avecReserves: text("avec_reserves").notNull().default("non"),
    signedFileId: uuid("signed_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("pv_receptions_operation_unique").on(table.operationId),
  ],
);

// ============================================================
// dgds — Décompte Général Définitif par lot (1:1 avec lot)
// ============================================================

export const dgds = pgTable(
  "dgds",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    marcheReviseHt: money("marche_revise_ht"),
    travauxSupplAcceptesHt: money("travaux_suppl_acceptes_ht"),
    penalitesHt: money("penalites_ht"),
    cumulCpVersesHt: money("cumul_cp_verses_ht"),
    soldeHt: money("solde_ht"),
    soldeTtc: money("solde_ttc"),
    statut: dgdStatusEnum("statut").notNull().default("brouillon"),
    signedFileId: uuid("signed_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    computedAt: timestamp("computed_at", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("dgds_lot_unique").on(table.lotId),
    check(
      "dgds_amounts_non_negative_ck",
      sql`${table.marcheReviseHt} >= 0 AND ${table.cumulCpVersesHt} >= 0 AND ${table.penalitesHt} >= 0`,
    ),
  ],
);

// ============================================================
// cautions — RBQS (Retenue Bancaire de Qualité Substitutive)
// ============================================================

export const cautions = pgTable(
  "cautions",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    montant: money("montant"),
    dateEmission: date("date_emission", { mode: "date" }).notNull(),
    dateExpiration: date("date_expiration", { mode: "date" }).notNull(),
    banque: text("banque").notNull(),
    numCaution: text("num_caution").notNull(),
    statut: cautionStatusEnum("statut").notNull().default("active"),
    fileId: uuid("file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("cautions_lot_idx").on(table.lotId),
    index("cautions_date_expiration_idx").on(table.dateExpiration),
    check(
      "cautions_dates_order_ck",
      sql`${table.dateExpiration} > ${table.dateEmission}`,
    ),
    check("cautions_montant_positive_ck", sql`${table.montant} >= 0`),
  ],
);

// ============================================================
// retentions — suivi retenue de garantie (1 an après réception)
// ============================================================

export const retentions = pgTable(
  "retentions",
  {
    id: pk(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    montantRetenu: money("montant_retenu"),
    dateReceptionLot: date("date_reception_lot", { mode: "date" }).notNull(),
    /** Échéance de libération = date_reception + 1 an (NF P03-001). */
    echeanceLiberation: date("echeance_liberation", { mode: "date" }).notNull(),
    dateLiberationReelle: date("date_liberation_reelle", { mode: "date" }),
    statut: retentionStatusEnum("statut").notNull().default("en_cours"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("retentions_lot_unique").on(table.lotId),
    index("retentions_echeance_idx").on(table.echeanceLiberation),
    check(
      "retentions_echeance_after_reception_ck",
      sql`${table.echeanceLiberation} > ${table.dateReceptionLot}`,
    ),
    check(
      "retentions_montant_positive_ck",
      sql`${table.montantRetenu} >= 0`,
    ),
  ],
);

// ============================================================
// Relations
// ============================================================

export const operationsRelations = relations(operations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [operations.organizationId],
    references: [organizations.id],
  }),
  moa: one(moas, {
    fields: [operations.moaId],
    references: [moas.id],
  }),
  pilot: one(users, {
    fields: [operations.pilotUserId],
    references: [users.id],
    relationName: "pilot",
  }),
  createdByUser: one(users, {
    fields: [operations.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  lots: many(lots),
  stakeholders: many(operationStakeholders),
  planningTasks: many(planningTasks),
  pvReception: one(pvReceptions, {
    fields: [operations.id],
    references: [pvReceptions.operationId],
  }),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  operation: one(operations, {
    fields: [lots.operationId],
    references: [operations.id],
  }),
  company: one(companies, {
    fields: [lots.companyId],
    references: [companies.id],
  }),
  avenants: many(avenants),
  dpgfLines: many(dpgfLines),
  situations: many(situations),
  planningTasks: many(planningTasks),
  cautions: many(cautions),
  dgd: one(dgds, {
    fields: [lots.id],
    references: [dgds.lotId],
  }),
  retention: one(retentions, {
    fields: [lots.id],
    references: [retentions.lotId],
  }),
}));

export const operationStakeholdersRelations = relations(
  operationStakeholders,
  ({ one }) => ({
    operation: one(operations, {
      fields: [operationStakeholders.operationId],
      references: [operations.id],
    }),
    company: one(companies, {
      fields: [operationStakeholders.companyId],
      references: [companies.id],
    }),
  }),
);

export const avenantsRelations = relations(avenants, ({ one }) => ({
  lot: one(lots, {
    fields: [avenants.lotId],
    references: [lots.id],
  }),
  signedFile: one(files, {
    fields: [avenants.signedFileId],
    references: [files.id],
  }),
}));

export const dpgfLinesRelations = relations(dpgfLines, ({ one }) => ({
  lot: one(lots, {
    fields: [dpgfLines.lotId],
    references: [lots.id],
  }),
}));

export const situationsRelations = relations(situations, ({ one, many }) => ({
  lot: one(lots, {
    fields: [situations.lotId],
    references: [lots.id],
  }),
  file: one(files, {
    fields: [situations.fileId],
    references: [files.id],
  }),
  lines: many(situationLines),
}));

export const situationLinesRelations = relations(situationLines, ({ one }) => ({
  situation: one(situations, {
    fields: [situationLines.situationId],
    references: [situations.id],
  }),
  dpgfLine: one(dpgfLines, {
    fields: [situationLines.dpgfLineId],
    references: [dpgfLines.id],
  }),
}));

export const planningTasksRelations = relations(planningTasks, ({ one }) => ({
  operation: one(operations, {
    fields: [planningTasks.operationId],
    references: [operations.id],
  }),
  lot: one(lots, {
    fields: [planningTasks.lotId],
    references: [lots.id],
  }),
}));

export const pvReceptionsRelations = relations(pvReceptions, ({ one }) => ({
  operation: one(operations, {
    fields: [pvReceptions.operationId],
    references: [operations.id],
  }),
}));

export const dgdsRelations = relations(dgds, ({ one }) => ({
  lot: one(lots, {
    fields: [dgds.lotId],
    references: [lots.id],
  }),
}));

export const cautionsRelations = relations(cautions, ({ one }) => ({
  lot: one(lots, {
    fields: [cautions.lotId],
    references: [lots.id],
  }),
}));

export const retentionsRelations = relations(retentions, ({ one }) => ({
  lot: one(lots, {
    fields: [retentions.lotId],
    references: [lots.id],
  }),
}));
