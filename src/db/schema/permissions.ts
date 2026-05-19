import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";
import { pk } from "./_shared";

// ============================================================
// Enums
// ============================================================

/**
 * Scope d'un cockpit access grant :
 * - global : accès au Cockpit pour toutes les opérations de l'agence
 * - operation : accès au Cockpit pour une opération précise
 */
export const cockpitGrantScopeEnum = pgEnum("cockpit_grant_scope", [
  "global",
  "operation",
]);

// ============================================================
// cockpit_access_grants — qui peut voir Honoraires + Trésorerie
//
// Par défaut, seuls les rôles owner/admin voient le Cockpit.
// L'Owner peut donner accès à un member (ex. Nathalie l'assistante)
// soit globalement, soit opération par opération.
// ============================================================

export const cockpitAccessGrants = pgTable(
  "cockpit_access_grants",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: cockpitGrantScopeEnum("scope").notNull(),
    // operation_id renseigné uniquement si scope = 'operation'.
    // FK vers operations posée plus tard dans operations.ts (cycle) — ici
    // on garde un uuid simple, on documente la cohérence applicative.
    operationId: uuid("operation_id"),
    grantedByUserId: uuid("granted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    grantedAt: timestamp("granted_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("cockpit_grants_user_idx").on(table.userId),
    index("cockpit_grants_org_scope_idx").on(table.organizationId, table.scope),
    index("cockpit_grants_operation_idx").on(table.operationId),
  ],
);

// ============================================================
// Relations
// ============================================================

export const cockpitAccessGrantsRelations = relations(
  cockpitAccessGrants,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [cockpitAccessGrants.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [cockpitAccessGrants.userId],
      references: [users.id],
      relationName: "grantee",
    }),
    grantedBy: one(users, {
      fields: [cockpitAccessGrants.grantedByUserId],
      references: [users.id],
      relationName: "granter",
    }),
  }),
);
