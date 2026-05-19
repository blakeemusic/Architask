import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";
import { createdAt, pk } from "./_shared";

// ============================================================
// files — table unique pour tous les uploads R2 (PDF, photos, plans, attestations…)
//
// Les entités qui ont un document principal référencent files.id directement
// (ex. insurances.attestation_file_id). Pour les pièces multiples (photos
// d'observation), on utilise une junction explicite côté cr.ts.
// ============================================================

export const files = pgTable(
  "files",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Clé R2 (ex. "org/{orgId}/operations/{opId}/cp-7.pdf"). */
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    originalFilename: text("original_filename").notNull(),
    /**
     * Libellé fonctionnel libre (utile pour filtrer dans l'UI) :
     * "attestation_decennale", "ccap", "cctp", "dpgf", "marche_signe",
     * "pv_reception", "facture_fournisseur", "photo_observation",
     * "logo_agence", "plan", "cp_signed", "nh_signed", …
     */
    kind: text("kind").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("files_r2_key_unique").on(table.r2Key),
    index("files_organization_id_idx").on(table.organizationId),
    index("files_kind_idx").on(table.kind),
  ],
);

// ============================================================
// Relations
// ============================================================

export const filesRelations = relations(files, ({ one }) => ({
  organization: one(organizations, {
    fields: [files.organizationId],
    references: [organizations.id],
  }),
  uploadedByUser: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));
