import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, timestamps } from "./_shared";

// ============================================================
// Enums
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const signatureProviderEnum = pgEnum("signature_provider", [
  "yousign",
  "docusign",
]);

export const pdpProviderEnum = pgEnum("pdp_provider", [
  "pennylane",
  "sage",
  "esker",
  "generix",
  "autre",
]);

export const bankProviderEnum = pgEnum("bank_provider", [
  "bridge",
  "powens",
]);

// ============================================================
// organizations — l'agence d'architecture
// ============================================================

export const organizations = pgTable(
  "organizations",
  {
    id: pk(),
    clerkOrgId: text("clerk_org_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // Logo agence (référence vers files.id) — FK ajoutée plus tard pour éviter le cycle.
    brandingLogoFileId: uuid("branding_logo_file_id"),
    defaultSignatureProvider: signatureProviderEnum(
      "default_signature_provider",
    ),
    defaultPdpProvider: pdpProviderEnum("default_pdp_provider"),
    defaultBankProvider: bankProviderEnum("default_bank_provider"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("organizations_clerk_org_id_unique").on(table.clerkOrgId),
    uniqueIndex("organizations_slug_unique").on(table.slug),
  ],
);

// ============================================================
// users — un row par (humain × organisation)
// ============================================================

export const users = pgTable(
  "users",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("member"),
    ...timestamps(),
  },
  (table) => [
    // Un humain peut être dans plusieurs agences, mais une seule fois par agence.
    uniqueIndex("users_clerk_org_unique").on(
      table.clerkUserId,
      table.organizationId,
    ),
    index("users_organization_id_idx").on(table.organizationId),
    index("users_email_idx").on(table.email),
  ],
);

// ============================================================
// audit_logs — INSERT-only en MVP (immutabilité enforced en code)
//
// TODO V1 : ajouter trigger Postgres
//   CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE
//   ON audit_logs FOR EACH ROW EXECUTE FUNCTION raise_immutable();
// ============================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    payloadDiff: jsonb("payload_diff").default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
    index("audit_logs_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

// ============================================================
// Relations
// ============================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
