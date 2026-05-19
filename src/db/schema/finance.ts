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
import { files } from "./files";
import { lots, operations, situations } from "./operations";
import { money, moneyOptional, pk, timestamps } from "./_shared";

// ============================================================
// Enums
// ============================================================

export const cpStatusEnum = pgEnum("cp_status", [
  "brouillon",
  "a_valider",
  "signe",
  "envoye",
  "paye",
]);

// ============================================================
// certificats_paiement — un CP par lot par mois
//
// Numérotation : CP-{op-code}-{lot-num}-{N} (généré côté code via
// numbering_counters + UPDATE … RETURNING atomique).
//
// Règle métier critique (NF P03-001) :
//   Σ CP émis ≤ marché révisé + travaux suppl. acceptés
// Vérifiée en server action AVANT INSERT (pas de trigger Postgres).
// ============================================================

export const certificatsPaiement = pgTable(
  "certificats_paiement",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "restrict" }),
    /** Numéro humain : "CP-RC-01-007". */
    numero: text("numero").notNull(),
    /** Référence à la situation OCR/Excel/manuelle qui a alimenté ce CP. */
    situationId: uuid("situation_id").references(() => situations.id, {
      onDelete: "set null",
    }),
    periodeMois: integer("periode_mois").notNull(),
    periodeAnnee: integer("periode_annee").notNull(),
    cumulTravauxHt: money("cumul_travaux_ht"),
    cumulCpPrecedentsHt: money("cumul_cp_precedents_ht"),
    brutAPayerHt: money("brut_a_payer_ht"),
    retenueGarantie: money("retenue_garantie"),
    revisionMontantHt: moneyOptional("revision_montant_ht"),
    tva: money("tva"),
    netTtc: money("net_ttc"),
    statut: cpStatusEnum("statut").notNull().default("brouillon"),
    signedFileId: uuid("signed_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date", { mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    /** Snapshot signature MVP (mock — pas d'appel Yousign/DocuSign en MVP). */
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    signedByUserId: uuid("signed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("cp_lot_numero_unique").on(table.lotId, table.numero),
    index("cp_operation_idx").on(table.operationId),
    index("cp_lot_idx").on(table.lotId),
    index("cp_statut_idx").on(table.statut),
    check(
      "cp_mois_range_ck",
      sql`${table.periodeMois} >= 1 AND ${table.periodeMois} <= 12`,
    ),
    check("cp_net_positive_ck", sql`${table.netTtc} >= 0`),
    check(
      "cp_cumul_ordering_ck",
      sql`${table.cumulTravauxHt} >= ${table.cumulCpPrecedentsHt}`,
    ),
  ],
);

// ============================================================
// numbering_counters — séquences atomiques par scope
//
// Scope examples :
//   "cp:<lot_id>"          → numéro CP par lot
//   "nh:<operation_id>:<year>" → numéro note d'honoraires par op-année
//   "avenant:<lot_id>"     → numéro avenant par lot
//
// Usage côté server action :
//   UPDATE numbering_counters
//     SET current_value = current_value + 1
//     WHERE organization_id = $1 AND scope = $2
//     RETURNING current_value;
//   (ou INSERT … ON CONFLICT DO UPDATE pour création atomique)
// ============================================================

export const numberingCounters = pgTable(
  "numbering_counters",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    currentValue: integer("current_value").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("numbering_counters_org_scope_unique").on(
      table.organizationId,
      table.scope,
    ),
    check(
      "numbering_counters_value_positive_ck",
      sql`${table.currentValue} >= 0`,
    ),
  ],
);

// ============================================================
// Relations
// ============================================================

export const certificatsPaiementRelations = relations(
  certificatsPaiement,
  ({ one }) => ({
    operation: one(operations, {
      fields: [certificatsPaiement.operationId],
      references: [operations.id],
    }),
    lot: one(lots, {
      fields: [certificatsPaiement.lotId],
      references: [lots.id],
    }),
    situation: one(situations, {
      fields: [certificatsPaiement.situationId],
      references: [situations.id],
    }),
    signedFile: one(files, {
      fields: [certificatsPaiement.signedFileId],
      references: [files.id],
    }),
    creator: one(users, {
      fields: [certificatsPaiement.createdBy],
      references: [users.id],
      relationName: "creator",
    }),
    signedByUser: one(users, {
      fields: [certificatsPaiement.signedByUserId],
      references: [users.id],
      relationName: "signer",
    }),
  }),
);

export const numberingCountersRelations = relations(
  numberingCounters,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [numberingCounters.organizationId],
      references: [organizations.id],
    }),
  }),
);
