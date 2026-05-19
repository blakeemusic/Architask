import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { companies } from "./annuaire";
import { files } from "./files";
import { lots, operations } from "./operations";
import { pctValue, pk, timestamps } from "./_shared";

// ============================================================
// Enums
// ============================================================

export const meetingTypeEnum = pgEnum("meeting_type", [
  "cr_chantier",
  "opr",
  "livraison",
  "visite_libre",
]);

export const observationCategorieEnum = pgEnum("observation_categorie", [
  "defaut",
  "demande_info",
  "validation",
  "securite",
  "reserve_opr",
]);

export const observationStatusEnum = pgEnum("observation_status", [
  "ouvert",
  "en_cours",
  "resolu",
  "leve",
]);

export const observationPriorityEnum = pgEnum("observation_priority", [
  "basse",
  "normale",
  "haute",
  "critique",
]);

export const reserveStatusEnum = pgEnum("reserve_status", [
  "a_lever",
  "en_cours",
  "levee",
]);

// ============================================================
// plans — PDF/image de plan
// ============================================================

export const plans = pgTable(
  "plans",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => lots.id, { onDelete: "set null" }),
    libelle: text("libelle").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    pageCount: integer("page_count").notNull().default(1),
    ...timestamps(),
  },
  (table) => [
    index("plans_operation_idx").on(table.operationId),
    index("plans_lot_idx").on(table.lotId),
  ],
);

// ============================================================
// site_meetings — réunions de chantier / OPR / livraisons
// ============================================================

export const siteMeetings = pgTable(
  "site_meetings",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    type: meetingTypeEnum("type").notNull().default("cr_chantier"),
    date: date("date", { mode: "date" }).notNull(),
    lieu: text("lieu"),
    ordreDuJour: text("ordre_du_jour"),
    generatedPdfFileId: uuid("generated_pdf_file_id").references(
      () => files.id,
      { onDelete: "set null" },
    ),
    signedPdfFileId: uuid("signed_pdf_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("site_meetings_operation_idx").on(table.operationId),
    index("site_meetings_date_idx").on(table.date),
  ],
);

// ============================================================
// site_meeting_attendees — pointage présence
// ============================================================

export const siteMeetingAttendees = pgTable(
  "site_meeting_attendees",
  {
    id: pk(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => siteMeetings.id, { onDelete: "cascade" }),
    /** Nullable : non renseigné si participant externe. */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    /** Snapshots — utiles si user/company supprimés ensuite. */
    contactNameSnapshot: text("contact_name_snapshot").notNull(),
    contactEmailSnapshot: text("contact_email_snapshot"),
    present: text("present").notNull().default("oui"),
    invitedOnly: text("invited_only").notNull().default("non"),
    ...timestamps(),
  },
  (table) => [
    index("attendees_meeting_idx").on(table.meetingId),
  ],
);

// ============================================================
// observations — pins sur plan + descriptions
//
// x_pct/y_pct : coordonnées 0..100 relatives à la page du plan,
// stockées en double precision pour le placement sub-pixel.
// ============================================================

export const observations = pgTable(
  "observations",
  {
    id: pk(),
    siteMeetingId: uuid("site_meeting_id")
      .notNull()
      .references(() => siteMeetings.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "set null",
    }),
    /** 0..100 en %, position sur la page du plan. */
    xPct: doublePrecision("x_pct"),
    yPct: doublePrecision("y_pct"),
    categorie: observationCategorieEnum("categorie")
      .notNull()
      .default("defaut"),
    description: text("description").notNull(),
    assignedToCompanyId: uuid("assigned_to_company_id").references(
      () => companies.id,
      { onDelete: "set null" },
    ),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    echeance: date("echeance", { mode: "date" }),
    statut: observationStatusEnum("statut").notNull().default("ouvert"),
    lotId: uuid("lot_id").references(() => lots.id, {
      onDelete: "set null",
    }),
    priority: observationPriorityEnum("priority").notNull().default("normale"),
    ...timestamps(),
  },
  (table) => [
    index("observations_meeting_idx").on(table.siteMeetingId),
    index("observations_plan_idx").on(table.planId),
    index("observations_statut_idx").on(table.statut),
    check(
      "observations_x_range_ck",
      sql`${table.xPct} IS NULL OR (${table.xPct} >= 0 AND ${table.xPct} <= 100)`,
    ),
    check(
      "observations_y_range_ck",
      sql`${table.yPct} IS NULL OR (${table.yPct} >= 0 AND ${table.yPct} <= 100)`,
    ),
  ],
);

// ============================================================
// observation_photos — junction photos × observation
// ============================================================

export const observationPhotos = pgTable(
  "observation_photos",
  {
    id: pk(),
    observationId: uuid("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    thumbnailFileId: uuid("thumbnail_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    /** Annotations Konva : flèches, croix, texte, ronds — JSON libre. */
    annotationsJson: jsonb("annotations_json").default(sql`'{}'::jsonb`),
    exifTakenAt: timestamp("exif_taken_at", {
      withTimezone: true,
      mode: "date",
    }),
    gpsLat: doublePrecision("gps_lat"),
    gpsLng: doublePrecision("gps_lng"),
    ...timestamps(),
  },
  (table) => [index("observation_photos_observation_idx").on(table.observationId)],
);

// ============================================================
// meeting_photos — photos générales du CR (pas rattachées à une obs)
// ============================================================

export const meetingPhotos = pgTable(
  "meeting_photos",
  {
    id: pk(),
    siteMeetingId: uuid("site_meeting_id")
      .notNull()
      .references(() => siteMeetings.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    thumbnailFileId: uuid("thumbnail_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    legende: text("legende"),
    ...timestamps(),
  },
  (table) => [index("meeting_photos_meeting_idx").on(table.siteMeetingId)],
);

// ============================================================
// reserves — issues d'OPR, suivi jusqu'à levée
//
// photo_avant_file_id / photo_apres_file_id pointent directement sur
// files.id (pas sur observation_photos) — décision validée par Arthur.
// ============================================================

export const reserves = pgTable(
  "reserves",
  {
    id: pk(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => operations.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "restrict" }),
    /** Observation d'origine (OPR) qui a généré la réserve. */
    observationId: uuid("observation_id").references(() => observations.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    statut: reserveStatusEnum("statut").notNull().default("a_lever"),
    dateReleve: date("date_releve", { mode: "date" }).notNull(),
    dateLevee: date("date_levee", { mode: "date" }),
    photoAvantFileId: uuid("photo_avant_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    photoApresFileId: uuid("photo_apres_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    index("reserves_operation_idx").on(table.operationId),
    index("reserves_lot_idx").on(table.lotId),
    index("reserves_statut_idx").on(table.statut),
  ],
);

// (utilitaire local pour silencer le lint si pctValue non importé ailleurs)
void pctValue;

// ============================================================
// Relations
// ============================================================

export const plansRelations = relations(plans, ({ one }) => ({
  operation: one(operations, {
    fields: [plans.operationId],
    references: [operations.id],
  }),
  lot: one(lots, {
    fields: [plans.lotId],
    references: [lots.id],
  }),
  file: one(files, {
    fields: [plans.fileId],
    references: [files.id],
  }),
}));

export const siteMeetingsRelations = relations(
  siteMeetings,
  ({ one, many }) => ({
    operation: one(operations, {
      fields: [siteMeetings.operationId],
      references: [operations.id],
    }),
    attendees: many(siteMeetingAttendees),
    observations: many(observations),
    photos: many(meetingPhotos),
    creator: one(users, {
      fields: [siteMeetings.createdBy],
      references: [users.id],
    }),
  }),
);

export const siteMeetingAttendeesRelations = relations(
  siteMeetingAttendees,
  ({ one }) => ({
    meeting: one(siteMeetings, {
      fields: [siteMeetingAttendees.meetingId],
      references: [siteMeetings.id],
    }),
    user: one(users, {
      fields: [siteMeetingAttendees.userId],
      references: [users.id],
    }),
    company: one(companies, {
      fields: [siteMeetingAttendees.companyId],
      references: [companies.id],
    }),
  }),
);

export const observationsRelations = relations(
  observations,
  ({ one, many }) => ({
    siteMeeting: one(siteMeetings, {
      fields: [observations.siteMeetingId],
      references: [siteMeetings.id],
    }),
    plan: one(plans, {
      fields: [observations.planId],
      references: [plans.id],
    }),
    assignedCompany: one(companies, {
      fields: [observations.assignedToCompanyId],
      references: [companies.id],
    }),
    assignedUser: one(users, {
      fields: [observations.assignedToUserId],
      references: [users.id],
    }),
    lot: one(lots, {
      fields: [observations.lotId],
      references: [lots.id],
    }),
    photos: many(observationPhotos),
  }),
);

export const observationPhotosRelations = relations(
  observationPhotos,
  ({ one }) => ({
    observation: one(observations, {
      fields: [observationPhotos.observationId],
      references: [observations.id],
    }),
    file: one(files, {
      fields: [observationPhotos.fileId],
      references: [files.id],
    }),
    thumbnail: one(files, {
      fields: [observationPhotos.thumbnailFileId],
      references: [files.id],
    }),
  }),
);

export const meetingPhotosRelations = relations(meetingPhotos, ({ one }) => ({
  meeting: one(siteMeetings, {
    fields: [meetingPhotos.siteMeetingId],
    references: [siteMeetings.id],
  }),
  file: one(files, {
    fields: [meetingPhotos.fileId],
    references: [files.id],
  }),
}));

export const reservesRelations = relations(reserves, ({ one }) => ({
  operation: one(operations, {
    fields: [reserves.operationId],
    references: [operations.id],
  }),
  lot: one(lots, {
    fields: [reserves.lotId],
    references: [lots.id],
  }),
  observation: one(observations, {
    fields: [reserves.observationId],
    references: [observations.id],
  }),
  photoAvant: one(files, {
    fields: [reserves.photoAvantFileId],
    references: [files.id],
  }),
  photoApres: one(files, {
    fields: [reserves.photoApresFileId],
    references: [files.id],
  }),
}));
