import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bankProviderEnum, organizations, pdpProviderEnum } from "./auth";
import { companies } from "./annuaire";
import { files } from "./files";
import {
  money,
  moneyOptional,
  pctValue,
  pk,
  timestamps,
} from "./_shared";
import { honoraireSituations } from "./honoraires";

// ============================================================
// Enums
// ============================================================

export const transactionSourceEnum = pgEnum("transaction_source", [
  "bank",
  "manual",
]);

export const recurrenceKindEnum = pgEnum("recurrence_kind", [
  "monthly",
  "quarterly",
  "yearly",
  "punctual",
]);

export const expenseSourceEnum = pgEnum("expense_source", [
  "photo",
  "upload",
  "pennylane",
  "factur_x",
]);

export const einvoiceDirectionEnum = pgEnum("einvoice_direction", [
  "out",
  "in",
]);

export const einvoiceStatusEnum = pgEnum("einvoice_status", [
  "envoyee",
  "transmise",
  "acceptee",
  "refusee",
  "payee",
]);

export const vatStatusEnum = pgEnum("vat_status", [
  "brouillon",
  "declare",
]);

// ============================================================
// bank_accounts — comptes pro connectés via Bridge/Powens
//
// TODO KMS : encrypted_credentials_ref pointera vers une clé chiffrée
// dans Vercel KV / Doppler / pg_crypto (jamais en clair en DB).
// ============================================================

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: bankProviderEnum("provider").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    libelle: text("libelle").notNull(),
    ibanLast4: text("iban_last4"),
    currency: text("currency").notNull().default("EUR"),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      mode: "date",
    }),
    currentBalance: moneyOptional("current_balance"),
    /** TODO KMS : référence vers secret manager — jamais en clair. */
    encryptedCredentialsRef: text("encrypted_credentials_ref"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("bank_accounts_provider_external_unique").on(
      table.provider,
      table.externalAccountId,
    ),
    index("bank_accounts_organization_idx").on(table.organizationId),
  ],
);

// ============================================================
// bank_transactions — transactions importées depuis la banque
// ============================================================

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: pk(),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    /** ID unique de la transaction côté Bridge/Powens. */
    externalTxId: text("external_tx_id"),
    transactionDate: date("transaction_date", { mode: "date" }).notNull(),
    amountTtc: money("amount_ttc"),
    libelle: text("libelle").notNull(),
    /** Catégorie auto/manuelle libre — pas d'enum (extensible). */
    category: text("category"),
    needsReconciliation: boolean("needs_reconciliation")
      .notNull()
      .default(true),
    invoiceAttachedAt: timestamp("invoice_attached_at", {
      withTimezone: true,
      mode: "date",
    }),
    linkedHonoraireSituationId: uuid("linked_honoraire_situation_id").references(
      () => honoraireSituations.id,
      { onDelete: "set null" },
    ),
    linkedRecurringChargeId: uuid("linked_recurring_charge_id"),
    source: transactionSourceEnum("source").notNull().default("bank"),
    ...timestamps(),
  },
  (table) => [
    index("bank_transactions_account_idx").on(table.bankAccountId),
    index("bank_transactions_date_idx").on(table.transactionDate),
    uniqueIndex("bank_transactions_external_unique")
      .on(table.bankAccountId, table.externalTxId)
      .where(sql`${table.externalTxId} IS NOT NULL`),
    index("bank_transactions_needs_reco_idx").on(table.needsReconciliation),
  ],
);

// ============================================================
// recurring_charges — charges fixes de l'agence
// ============================================================

export const recurringCharges = pgTable(
  "recurring_charges",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    libelle: text("libelle").notNull(),
    /** Catégorie libre : "Salaires", "Loyer", "Logiciels", etc. */
    category: text("category").notNull(),
    montantHt: money("montant_ht"),
    tauxTva: pctValue("taux_tva").notNull().default("20.00"),
    recurrence: recurrenceKindEnum("recurrence").notNull(),
    nextDueDate: date("next_due_date", { mode: "date" }),
    supplierCompanyId: uuid("supplier_company_id").references(
      () => companies.id,
      { onDelete: "set null" },
    ),
    attachedFileId: uuid("attached_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    index("recurring_charges_organization_idx").on(table.organizationId),
    index("recurring_charges_next_due_idx").on(table.nextDueDate),
    check(
      "recurring_charges_montant_positive_ck",
      sql`${table.montantHt} >= 0`,
    ),
  ],
);

// ============================================================
// expense_invoices — factures fournisseurs attachées
// ============================================================

export const expenseInvoices = pgTable(
  "expense_invoices",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierName: text("supplier_name").notNull(),
    supplierCompanyId: uuid("supplier_company_id").references(
      () => companies.id,
      { onDelete: "set null" },
    ),
    dateFacture: date("date_facture", { mode: "date" }).notNull(),
    montantTtc: money("montant_ttc"),
    montantHt: money("montant_ht"),
    montantTva: money("montant_tva"),
    tauxTva: pctValue("taux_tva").notNull(),
    deductible: boolean("deductible").notNull().default(true),
    source: expenseSourceEnum("source").notNull(),
    fileId: uuid("file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ocrConfidence: integer("ocr_confidence"),
    linkedTransactionId: uuid("linked_transaction_id").references(
      () => bankTransactions.id,
      { onDelete: "set null" },
    ),
    pennylaneExternalId: text("pennylane_external_id"),
    ...timestamps(),
  },
  (table) => [
    index("expense_invoices_organization_idx").on(table.organizationId),
    index("expense_invoices_supplier_idx").on(table.supplierCompanyId),
    index("expense_invoices_date_idx").on(table.dateFacture),
    check(
      "expense_invoices_amounts_positive_ck",
      sql`${table.montantTtc} >= 0 AND ${table.montantHt} >= 0 AND ${table.montantTva} >= 0`,
    ),
    check(
      "expense_invoices_tva_range_ck",
      sql`${table.tauxTva} >= 0 AND ${table.tauxTva} <= 100`,
    ),
  ],
);

// ============================================================
// vat_summaries — récap mensuel TVA (collectée vs déductible)
// ============================================================

export const vatSummaries = pgTable(
  "vat_summaries",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    periodeMois: integer("periode_mois").notNull(),
    periodeAnnee: integer("periode_annee").notNull(),
    tvaCollectee: money("tva_collectee"),
    tvaDeductible: money("tva_deductible"),
    tvaDue: money("tva_due"),
    statut: vatStatusEnum("statut").notNull().default("brouillon"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("vat_summaries_org_period_unique").on(
      table.organizationId,
      table.periodeAnnee,
      table.periodeMois,
    ),
    check(
      "vat_summaries_mois_range_ck",
      sql`${table.periodeMois} >= 1 AND ${table.periodeMois} <= 12`,
    ),
  ],
);

// ============================================================
// einvoice_configurations — config PDP par agence (Pennylane, etc.)
//
// TODO KMS : encrypted_credentials_ref pointera vers secret manager.
// ============================================================

export const einvoiceConfigurations = pgTable(
  "einvoice_configurations",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: pdpProviderEnum("provider").notNull(),
    externalOrgId: text("external_org_id"),
    /** TODO KMS : référence vers secret manager — jamais en clair. */
    encryptedCredentialsRef: text("encrypted_credentials_ref"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("einvoice_configurations_organization_unique").on(
      table.organizationId,
    ),
  ],
);

// ============================================================
// einvoice_events — log des événements Factur-X (in/out)
// ============================================================

export const einvoiceEvents = pgTable(
  "einvoice_events",
  {
    id: pk(),
    honoraireSituationId: uuid("honoraire_situation_id").references(
      () => honoraireSituations.id,
      { onDelete: "set null" },
    ),
    expenseInvoiceId: uuid("expense_invoice_id").references(
      () => expenseInvoices.id,
      { onDelete: "set null" },
    ),
    direction: einvoiceDirectionEnum("direction").notNull(),
    status: einvoiceStatusEnum("status").notNull(),
    rawPayload: jsonb("raw_payload").default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (table) => [
    index("einvoice_events_situation_idx").on(table.honoraireSituationId),
    index("einvoice_events_expense_idx").on(table.expenseInvoiceId),
    index("einvoice_events_status_idx").on(table.status),
  ],
);

// ============================================================
// Relations
// ============================================================

export const bankAccountsRelations = relations(
  bankAccounts,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [bankAccounts.organizationId],
      references: [organizations.id],
    }),
    transactions: many(bankTransactions),
  }),
);

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one }) => ({
    account: one(bankAccounts, {
      fields: [bankTransactions.bankAccountId],
      references: [bankAccounts.id],
    }),
    linkedHonoraireSituation: one(honoraireSituations, {
      fields: [bankTransactions.linkedHonoraireSituationId],
      references: [honoraireSituations.id],
    }),
    linkedRecurringCharge: one(recurringCharges, {
      fields: [bankTransactions.linkedRecurringChargeId],
      references: [recurringCharges.id],
    }),
  }),
);

export const recurringChargesRelations = relations(
  recurringCharges,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [recurringCharges.organizationId],
      references: [organizations.id],
    }),
    supplier: one(companies, {
      fields: [recurringCharges.supplierCompanyId],
      references: [companies.id],
    }),
  }),
);

export const expenseInvoicesRelations = relations(
  expenseInvoices,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [expenseInvoices.organizationId],
      references: [organizations.id],
    }),
    supplier: one(companies, {
      fields: [expenseInvoices.supplierCompanyId],
      references: [companies.id],
    }),
    linkedTransaction: one(bankTransactions, {
      fields: [expenseInvoices.linkedTransactionId],
      references: [bankTransactions.id],
    }),
    file: one(files, {
      fields: [expenseInvoices.fileId],
      references: [files.id],
    }),
  }),
);

export const vatSummariesRelations = relations(vatSummaries, ({ one }) => ({
  organization: one(organizations, {
    fields: [vatSummaries.organizationId],
    references: [organizations.id],
  }),
}));

export const einvoiceConfigurationsRelations = relations(
  einvoiceConfigurations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [einvoiceConfigurations.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const einvoiceEventsRelations = relations(einvoiceEvents, ({ one }) => ({
  situation: one(honoraireSituations, {
    fields: [einvoiceEvents.honoraireSituationId],
    references: [honoraireSituations.id],
  }),
  expense: one(expenseInvoices, {
    fields: [einvoiceEvents.expenseInvoiceId],
    references: [expenseInvoices.id],
  }),
}));
