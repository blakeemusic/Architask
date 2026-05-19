CREATE TYPE "public"."bank_provider" AS ENUM('bridge', 'powens');--> statement-breakpoint
CREATE TYPE "public"."pdp_provider" AS ENUM('pennylane', 'sage', 'esker', 'generix', 'autre');--> statement-breakpoint
CREATE TYPE "public"."signature_provider" AS ENUM('yousign', 'docusign');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."cockpit_grant_scope" AS ENUM('global', 'operation');--> statement-breakpoint
CREATE TYPE "public"."company_contact_role" AS ENUM('gerant', 'conducteur', 'comptabilite', 'autre');--> statement-breakpoint
CREATE TYPE "public"."insurance_status" AS ENUM('valide', 'expirant_60j', 'expire');--> statement-breakpoint
CREATE TYPE "public"."insurance_type" AS ENUM('decennale', 'rc_pro', 'gpa');--> statement-breakpoint
CREATE TYPE "public"."moa_type_juridique" AS ENUM('particulier', 'sci', 'sas', 'sarl', 'sa', 'association', 'collectivite', 'autre');--> statement-breakpoint
CREATE TYPE "public"."avenant_status" AS ENUM('brouillon', 'a_signer', 'signe');--> statement-breakpoint
CREATE TYPE "public"."caution_status" AS ENUM('active', 'liberee', 'expiree');--> statement-breakpoint
CREATE TYPE "public"."dgd_status" AS ENUM('brouillon', 'a_valider', 'signe');--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('en_preparation', 'signe', 'en_execution', 'en_reception', 'solde');--> statement-breakpoint
CREATE TYPE "public"."milestone_kind" AS ENUM('os', 'demarrage_lot', 'fin_lot', 'reception', 'dgd', 'libere_retenue', 'autre');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('pending', 'processing', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."operation_stakeholder_kind" AS ENUM('moa_secondaire', 'moe', 'bet', 'autre');--> statement-breakpoint
CREATE TYPE "public"."operation_status" AS ENUM('en_preparation', 'signe', 'en_execution', 'en_reception', 'dgd', 'clos');--> statement-breakpoint
CREATE TYPE "public"."planning_task_status" AS ENUM('a_venir', 'en_cours', 'termine', 'en_retard');--> statement-breakpoint
CREATE TYPE "public"."planning_task_type" AS ENUM('lot', 'jalon');--> statement-breakpoint
CREATE TYPE "public"."retention_status" AS ENUM('en_cours', 'liberee');--> statement-breakpoint
CREATE TYPE "public"."situation_source" AS ENUM('pdf', 'excel', 'manual');--> statement-breakpoint
CREATE TYPE "public"."cp_status" AS ENUM('brouillon', 'a_valider', 'signe', 'envoye', 'paye');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('cr_chantier', 'opr', 'livraison', 'visite_libre');--> statement-breakpoint
CREATE TYPE "public"."observation_categorie" AS ENUM('defaut', 'demande_info', 'validation', 'securite', 'reserve_opr');--> statement-breakpoint
CREATE TYPE "public"."observation_priority" AS ENUM('basse', 'normale', 'haute', 'critique');--> statement-breakpoint
CREATE TYPE "public"."observation_status" AS ENUM('ouvert', 'en_cours', 'resolu', 'leve');--> statement-breakpoint
CREATE TYPE "public"."reserve_status" AS ENUM('a_lever', 'en_cours', 'levee');--> statement-breakpoint
CREATE TYPE "public"."honoraire_contract_status" AS ENUM('brouillon', 'a_signer', 'signe', 'en_execution', 'clos');--> statement-breakpoint
CREATE TYPE "public"."honoraire_situation_status" AS ENUM('brouillon', 'a_valider', 'signee', 'envoyee', 'payee');--> statement-breakpoint
CREATE TYPE "public"."mission_type_valeur" AS ENUM('pct', 'montant');--> statement-breakpoint
CREATE TYPE "public"."mode_facturation" AS ENUM('forfait', 'pct_travaux', 'mixte');--> statement-breakpoint
CREATE TYPE "public"."einvoice_direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."einvoice_status" AS ENUM('envoyee', 'transmise', 'acceptee', 'refusee', 'payee');--> statement-breakpoint
CREATE TYPE "public"."expense_source" AS ENUM('photo', 'upload', 'pennylane', 'factur_x');--> statement-breakpoint
CREATE TYPE "public"."recurrence_kind" AS ENUM('monthly', 'quarterly', 'yearly', 'punctual');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('bank', 'manual');--> statement-breakpoint
CREATE TYPE "public"."vat_status" AS ENUM('brouillon', 'declare');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload_diff" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"branding_logo_file_id" uuid,
	"default_signature_provider" "signature_provider",
	"default_pdp_provider" "pdp_provider",
	"default_bank_provider" "bank_provider",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cockpit_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "cockpit_grant_scope" NOT NULL,
	"operation_id" uuid,
	"granted_by_user_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"original_filename" text NOT NULL,
	"kind" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"raison_sociale" text NOT NULL,
	"siret" text,
	"forme_juridique" text,
	"adresse_ligne_1" text,
	"adresse_ligne_2" text,
	"code_postal" text,
	"ville" text,
	"pays" text DEFAULT 'France',
	"logo_file_id" uuid,
	"palette_seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "company_contact_role" DEFAULT 'autre' NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" "insurance_type" NOT NULL,
	"compagnie" text NOT NULL,
	"num_police" text NOT NULL,
	"montant_garanti" numeric(14, 2) NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"activites_couvertes" text[] DEFAULT '{}'::text[] NOT NULL,
	"attestation_file_id" uuid,
	"status" "insurance_status" DEFAULT 'valide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insurances_date_range_ck" CHECK ("insurances"."date_fin" > "insurances"."date_debut"),
	CONSTRAINT "insurances_montant_positive_ck" CHECK ("insurances"."montant_garanti" >= 0)
);
--> statement-breakpoint
CREATE TABLE "moa_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moa_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type_juridique" "moa_type_juridique" NOT NULL,
	"raison_sociale" text NOT NULL,
	"siret" text,
	"adresse_ligne_1" text,
	"adresse_ligne_2" text,
	"code_postal" text,
	"ville" text,
	"pays" text DEFAULT 'France',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"objet" text NOT NULL,
	"montant_ht" numeric(14, 2) NOT NULL,
	"impact_delai_jours" integer DEFAULT 0 NOT NULL,
	"date_signature" date,
	"statut" "avenant_status" DEFAULT 'brouillon' NOT NULL,
	"signed_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cautions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"montant" numeric(14, 2) NOT NULL,
	"date_emission" date NOT NULL,
	"date_expiration" date NOT NULL,
	"banque" text NOT NULL,
	"num_caution" text NOT NULL,
	"statut" "caution_status" DEFAULT 'active' NOT NULL,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cautions_dates_order_ck" CHECK ("cautions"."date_expiration" > "cautions"."date_emission"),
	CONSTRAINT "cautions_montant_positive_ck" CHECK ("cautions"."montant" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dgds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"marche_revise_ht" numeric(14, 2) NOT NULL,
	"travaux_suppl_acceptes_ht" numeric(14, 2) NOT NULL,
	"penalites_ht" numeric(14, 2) NOT NULL,
	"cumul_cp_verses_ht" numeric(14, 2) NOT NULL,
	"solde_ht" numeric(14, 2) NOT NULL,
	"solde_ttc" numeric(14, 2) NOT NULL,
	"statut" "dgd_status" DEFAULT 'brouillon' NOT NULL,
	"signed_file_id" uuid,
	"computed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dgds_amounts_non_negative_ck" CHECK ("dgds"."marche_revise_ht" >= 0 AND "dgds"."cumul_cp_verses_ht" >= 0 AND "dgds"."penalites_ht" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dpgf_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"ordre" integer NOT NULL,
	"designation" text NOT NULL,
	"unite" text,
	"quantite" numeric(12, 4),
	"prix_unitaire_ht" numeric(14, 2),
	"montant_total_ht" numeric(14, 2),
	"ocr_confidence" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dpgf_lines_confidence_range_ck" CHECK ("dpgf_lines"."ocr_confidence" IS NULL OR ("dpgf_lines"."ocr_confidence" >= 0 AND "dpgf_lines"."ocr_confidence" <= 100)),
	CONSTRAINT "dpgf_lines_amounts_positive_ck" CHECK ("dpgf_lines"."prix_unitaire_ht" IS NULL OR "dpgf_lines"."prix_unitaire_ht" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"libelle" text NOT NULL,
	"company_id" uuid,
	"montant_marche_ht" numeric(14, 2) NOT NULL,
	"taux_tva" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"mode_revision" text DEFAULT 'BT01',
	"retenue_garantie_pct" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"delai_paiement_jours" integer DEFAULT 30 NOT NULL,
	"decennale_check_at" timestamp with time zone,
	"activites_attendues" text[] DEFAULT '{}'::text[] NOT NULL,
	"statut" "lot_status" DEFAULT 'en_preparation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lots_montant_positive_ck" CHECK ("lots"."montant_marche_ht" >= 0),
	CONSTRAINT "lots_tva_range_ck" CHECK ("lots"."taux_tva" >= 0 AND "lots"."taux_tva" <= 100),
	CONSTRAINT "lots_retenue_range_ck" CHECK ("lots"."retenue_garantie_pct" >= 0 AND "lots"."retenue_garantie_pct" <= 5),
	CONSTRAINT "lots_delai_range_ck" CHECK ("lots"."delai_paiement_jours" >= 0 AND "lots"."delai_paiement_jours" <= 365)
);
--> statement-breakpoint
CREATE TABLE "operation_stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"kind" "operation_stakeholder_kind" NOT NULL,
	"label" text NOT NULL,
	"company_id" uuid,
	"contact_name" text,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"moa_id" uuid,
	"adresse_ligne_1" text,
	"adresse_ligne_2" text,
	"code_postal" text,
	"ville" text,
	"pays" text DEFAULT 'France',
	"date_os" date,
	"date_reception_cible" date,
	"duree_prevue_jours" integer,
	"montant_previsionnel_ht" numeric(14, 2),
	"pilot_user_id" uuid,
	"statut" "operation_status" DEFAULT 'en_preparation' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operations_code_format_ck" CHECK ("operations"."code" ~ '^[A-Z0-9-]{2,8}$'),
	CONSTRAINT "operations_duree_positive_ck" CHECK ("operations"."duree_prevue_jours" IS NULL OR "operations"."duree_prevue_jours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planning_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"lot_id" uuid,
	"type" "planning_task_type" NOT NULL,
	"libelle" text NOT NULL,
	"date_debut_prevue" date,
	"date_fin_prevue" date,
	"date_debut_reelle" date,
	"date_fin_reelle" date,
	"statut" "planning_task_status" DEFAULT 'a_venir' NOT NULL,
	"milestone_kind" "milestone_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_tasks_dates_order_ck" CHECK ("planning_tasks"."date_fin_prevue" IS NULL OR "planning_tasks"."date_debut_prevue" IS NULL OR "planning_tasks"."date_fin_prevue" >= "planning_tasks"."date_debut_prevue")
);
--> statement-breakpoint
CREATE TABLE "pv_receptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"date_reception" date NOT NULL,
	"avec_reserves" text DEFAULT 'non' NOT NULL,
	"signed_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"montant_retenu" numeric(14, 2) NOT NULL,
	"date_reception_lot" date NOT NULL,
	"echeance_liberation" date NOT NULL,
	"date_liberation_reelle" date,
	"statut" "retention_status" DEFAULT 'en_cours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retentions_echeance_after_reception_ck" CHECK ("retentions"."echeance_liberation" > "retentions"."date_reception_lot"),
	CONSTRAINT "retentions_montant_positive_ck" CHECK ("retentions"."montant_retenu" >= 0)
);
--> statement-breakpoint
CREATE TABLE "situation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"situation_id" uuid NOT NULL,
	"dpgf_line_id" uuid,
	"pct_avancement" numeric(5, 2) NOT NULL,
	"montant_cumule_ht" numeric(14, 2) NOT NULL,
	"ocr_confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "situation_lines_pct_range_ck" CHECK ("situation_lines"."pct_avancement" >= 0 AND "situation_lines"."pct_avancement" <= 100)
);
--> statement-breakpoint
CREATE TABLE "situations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"periode_mois" integer NOT NULL,
	"periode_annee" integer NOT NULL,
	"source" "situation_source" NOT NULL,
	"file_id" uuid,
	"ocr_status" "ocr_status" DEFAULT 'pending' NOT NULL,
	"ocr_confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "situations_mois_range_ck" CHECK ("situations"."periode_mois" >= 1 AND "situations"."periode_mois" <= 12),
	CONSTRAINT "situations_annee_range_ck" CHECK ("situations"."periode_annee" >= 2020 AND "situations"."periode_annee" <= 2100)
);
--> statement-breakpoint
CREATE TABLE "certificats_paiement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"situation_id" uuid,
	"periode_mois" integer NOT NULL,
	"periode_annee" integer NOT NULL,
	"cumul_travaux_ht" numeric(14, 2) NOT NULL,
	"cumul_cp_precedents_ht" numeric(14, 2) NOT NULL,
	"brut_a_payer_ht" numeric(14, 2) NOT NULL,
	"retenue_garantie" numeric(14, 2) NOT NULL,
	"revision_montant_ht" numeric(14, 2),
	"tva" numeric(14, 2) NOT NULL,
	"net_ttc" numeric(14, 2) NOT NULL,
	"statut" "cp_status" DEFAULT 'brouillon' NOT NULL,
	"signed_file_id" uuid,
	"due_date" date,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cp_mois_range_ck" CHECK ("certificats_paiement"."periode_mois" >= 1 AND "certificats_paiement"."periode_mois" <= 12),
	CONSTRAINT "cp_net_positive_ck" CHECK ("certificats_paiement"."net_ttc" >= 0),
	CONSTRAINT "cp_cumul_ordering_ck" CHECK ("certificats_paiement"."cumul_travaux_ht" >= "certificats_paiement"."cumul_cp_precedents_ht")
);
--> statement-breakpoint
CREATE TABLE "numbering_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbering_counters_value_positive_ck" CHECK ("numbering_counters"."current_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meeting_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_meeting_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"thumbnail_file_id" uuid,
	"legende" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observation_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"thumbnail_file_id" uuid,
	"annotations_json" jsonb DEFAULT '{}'::jsonb,
	"exif_taken_at" timestamp with time zone,
	"gps_lat" double precision,
	"gps_lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_meeting_id" uuid NOT NULL,
	"plan_id" uuid,
	"x_pct" double precision,
	"y_pct" double precision,
	"categorie" "observation_categorie" DEFAULT 'defaut' NOT NULL,
	"description" text NOT NULL,
	"assigned_to_company_id" uuid,
	"assigned_to_user_id" uuid,
	"echeance" date,
	"statut" "observation_status" DEFAULT 'ouvert' NOT NULL,
	"lot_id" uuid,
	"priority" "observation_priority" DEFAULT 'normale' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observations_x_range_ck" CHECK ("observations"."x_pct" IS NULL OR ("observations"."x_pct" >= 0 AND "observations"."x_pct" <= 100)),
	CONSTRAINT "observations_y_range_ck" CHECK ("observations"."y_pct" IS NULL OR ("observations"."y_pct" >= 0 AND "observations"."y_pct" <= 100))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"lot_id" uuid,
	"libelle" text NOT NULL,
	"file_id" uuid NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"observation_id" uuid,
	"description" text NOT NULL,
	"statut" "reserve_status" DEFAULT 'a_lever' NOT NULL,
	"date_releve" date NOT NULL,
	"date_levee" date,
	"photo_avant_file_id" uuid,
	"photo_apres_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_meeting_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"company_id" uuid,
	"contact_name_snapshot" text NOT NULL,
	"contact_email_snapshot" text,
	"present" text DEFAULT 'oui' NOT NULL,
	"invited_only" text DEFAULT 'non' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"type" "meeting_type" DEFAULT 'cr_chantier' NOT NULL,
	"date" date NOT NULL,
	"lieu" text,
	"ordre_du_jour" text,
	"generated_pdf_file_id" uuid,
	"signed_pdf_file_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "honoraire_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"moa_id" uuid,
	"date_signature" date,
	"mode_facturation" "mode_facturation" NOT NULL,
	"montant_total_ht" numeric(14, 2) NOT NULL,
	"taux_tva" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"delai_paiement_jours" integer DEFAULT 30 NOT NULL,
	"marche_reference_ht" numeric(14, 2),
	"signed_file_id" uuid,
	"statut" "honoraire_contract_status" DEFAULT 'brouillon' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honoraire_contracts_montant_positive_ck" CHECK ("honoraire_contracts"."montant_total_ht" >= 0),
	CONSTRAINT "honoraire_contracts_tva_range_ck" CHECK ("honoraire_contracts"."taux_tva" >= 0 AND "honoraire_contracts"."taux_tva" <= 100)
);
--> statement-breakpoint
CREATE TABLE "honoraire_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer NOT NULL,
	"type_valeur" "mission_type_valeur" NOT NULL,
	"pct_du_total" numeric(5, 2),
	"montant_ht" numeric(14, 2),
	"montant_calcule" numeric(14, 2),
	"pct_avancement_courant" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honoraire_missions_pct_range_ck" CHECK ("honoraire_missions"."pct_du_total" IS NULL OR ("honoraire_missions"."pct_du_total" >= 0 AND "honoraire_missions"."pct_du_total" <= 100)),
	CONSTRAINT "honoraire_missions_avancement_range_ck" CHECK ("honoraire_missions"."pct_avancement_courant" >= 0 AND "honoraire_missions"."pct_avancement_courant" <= 100),
	CONSTRAINT "honoraire_missions_type_valeur_consistency_ck" CHECK (("honoraire_missions"."type_valeur" = 'pct' AND "honoraire_missions"."pct_du_total" IS NOT NULL) OR ("honoraire_missions"."type_valeur" = 'montant' AND "honoraire_missions"."montant_ht" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "honoraire_situations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"date_emission" date NOT NULL,
	"pct_avancement_nouveau" numeric(5, 2) NOT NULL,
	"pct_avancement_precedent" numeric(5, 2) NOT NULL,
	"montant_ht" numeric(14, 2) NOT NULL,
	"montant_tva" numeric(14, 2) NOT NULL,
	"montant_ttc" numeric(14, 2) NOT NULL,
	"statut" "honoraire_situation_status" DEFAULT 'brouillon' NOT NULL,
	"generated_pdf_file_id" uuid,
	"signed_pdf_file_id" uuid,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honoraire_situations_avancement_monotone_ck" CHECK ("honoraire_situations"."pct_avancement_nouveau" >= "honoraire_situations"."pct_avancement_precedent"),
	CONSTRAINT "honoraire_situations_pct_range_ck" CHECK ("honoraire_situations"."pct_avancement_nouveau" >= 0 AND "honoraire_situations"."pct_avancement_nouveau" <= 100),
	CONSTRAINT "honoraire_situations_ttc_positive_ck" CHECK ("honoraire_situations"."montant_ttc" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "bank_provider" NOT NULL,
	"external_account_id" text NOT NULL,
	"libelle" text NOT NULL,
	"iban_last4" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"current_balance" numeric(14, 2),
	"encrypted_credentials_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"external_tx_id" text,
	"transaction_date" date NOT NULL,
	"amount_ttc" numeric(14, 2) NOT NULL,
	"libelle" text NOT NULL,
	"category" text,
	"needs_reconciliation" boolean DEFAULT true NOT NULL,
	"invoice_attached_at" timestamp with time zone,
	"linked_honoraire_situation_id" uuid,
	"linked_recurring_charge_id" uuid,
	"source" "transaction_source" DEFAULT 'bank' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "einvoice_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "pdp_provider" NOT NULL,
	"external_org_id" text,
	"encrypted_credentials_ref" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "einvoice_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"honoraire_situation_id" uuid,
	"expense_invoice_id" uuid,
	"direction" "einvoice_direction" NOT NULL,
	"status" "einvoice_status" NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_company_id" uuid,
	"date_facture" date NOT NULL,
	"montant_ttc" numeric(14, 2) NOT NULL,
	"montant_ht" numeric(14, 2) NOT NULL,
	"montant_tva" numeric(14, 2) NOT NULL,
	"taux_tva" numeric(5, 2) NOT NULL,
	"deductible" boolean DEFAULT true NOT NULL,
	"source" "expense_source" NOT NULL,
	"file_id" uuid,
	"ocr_confidence" integer,
	"linked_transaction_id" uuid,
	"pennylane_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_invoices_amounts_positive_ck" CHECK ("expense_invoices"."montant_ttc" >= 0 AND "expense_invoices"."montant_ht" >= 0 AND "expense_invoices"."montant_tva" >= 0),
	CONSTRAINT "expense_invoices_tva_range_ck" CHECK ("expense_invoices"."taux_tva" >= 0 AND "expense_invoices"."taux_tva" <= 100)
);
--> statement-breakpoint
CREATE TABLE "recurring_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"category" text NOT NULL,
	"montant_ht" numeric(14, 2) NOT NULL,
	"taux_tva" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"recurrence" "recurrence_kind" NOT NULL,
	"next_due_date" date,
	"supplier_company_id" uuid,
	"attached_file_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_charges_montant_positive_ck" CHECK ("recurring_charges"."montant_ht" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vat_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"periode_mois" integer NOT NULL,
	"periode_annee" integer NOT NULL,
	"tva_collectee" numeric(14, 2) NOT NULL,
	"tva_deductible" numeric(14, 2) NOT NULL,
	"tva_due" numeric(14, 2) NOT NULL,
	"statut" "vat_status" DEFAULT 'brouillon' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vat_summaries_mois_range_ck" CHECK ("vat_summaries"."periode_mois" >= 1 AND "vat_summaries"."periode_mois" <= 12)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_access_grants" ADD CONSTRAINT "cockpit_access_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_access_grants" ADD CONSTRAINT "cockpit_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_access_grants" ADD CONSTRAINT "cockpit_access_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_attestation_file_id_files_id_fk" FOREIGN KEY ("attestation_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moa_contacts" ADD CONSTRAINT "moa_contacts_moa_id_moas_id_fk" FOREIGN KEY ("moa_id") REFERENCES "public"."moas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moas" ADD CONSTRAINT "moas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_signed_file_id_files_id_fk" FOREIGN KEY ("signed_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cautions" ADD CONSTRAINT "cautions_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cautions" ADD CONSTRAINT "cautions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dgds" ADD CONSTRAINT "dgds_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dgds" ADD CONSTRAINT "dgds_signed_file_id_files_id_fk" FOREIGN KEY ("signed_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpgf_lines" ADD CONSTRAINT "dpgf_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_stakeholders" ADD CONSTRAINT "operation_stakeholders_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_stakeholders" ADD CONSTRAINT "operation_stakeholders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_moa_id_moas_id_fk" FOREIGN KEY ("moa_id") REFERENCES "public"."moas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_pilot_user_id_users_id_fk" FOREIGN KEY ("pilot_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_tasks" ADD CONSTRAINT "planning_tasks_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_tasks" ADD CONSTRAINT "planning_tasks_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pv_receptions" ADD CONSTRAINT "pv_receptions_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pv_receptions" ADD CONSTRAINT "pv_receptions_signed_file_id_files_id_fk" FOREIGN KEY ("signed_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retentions" ADD CONSTRAINT "retentions_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situation_lines" ADD CONSTRAINT "situation_lines_situation_id_situations_id_fk" FOREIGN KEY ("situation_id") REFERENCES "public"."situations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situation_lines" ADD CONSTRAINT "situation_lines_dpgf_line_id_dpgf_lines_id_fk" FOREIGN KEY ("dpgf_line_id") REFERENCES "public"."dpgf_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situations" ADD CONSTRAINT "situations_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situations" ADD CONSTRAINT "situations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_paiement" ADD CONSTRAINT "certificats_paiement_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_paiement" ADD CONSTRAINT "certificats_paiement_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_paiement" ADD CONSTRAINT "certificats_paiement_situation_id_situations_id_fk" FOREIGN KEY ("situation_id") REFERENCES "public"."situations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_paiement" ADD CONSTRAINT "certificats_paiement_signed_file_id_files_id_fk" FOREIGN KEY ("signed_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_paiement" ADD CONSTRAINT "certificats_paiement_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbering_counters" ADD CONSTRAINT "numbering_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_photos" ADD CONSTRAINT "meeting_photos_site_meeting_id_site_meetings_id_fk" FOREIGN KEY ("site_meeting_id") REFERENCES "public"."site_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_photos" ADD CONSTRAINT "meeting_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_photos" ADD CONSTRAINT "meeting_photos_thumbnail_file_id_files_id_fk" FOREIGN KEY ("thumbnail_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_photos" ADD CONSTRAINT "observation_photos_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_photos" ADD CONSTRAINT "observation_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_photos" ADD CONSTRAINT "observation_photos_thumbnail_file_id_files_id_fk" FOREIGN KEY ("thumbnail_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_site_meeting_id_site_meetings_id_fk" FOREIGN KEY ("site_meeting_id") REFERENCES "public"."site_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_assigned_to_company_id_companies_id_fk" FOREIGN KEY ("assigned_to_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserves" ADD CONSTRAINT "reserves_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserves" ADD CONSTRAINT "reserves_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserves" ADD CONSTRAINT "reserves_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserves" ADD CONSTRAINT "reserves_photo_avant_file_id_files_id_fk" FOREIGN KEY ("photo_avant_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserves" ADD CONSTRAINT "reserves_photo_apres_file_id_files_id_fk" FOREIGN KEY ("photo_apres_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meeting_attendees" ADD CONSTRAINT "site_meeting_attendees_meeting_id_site_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."site_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meeting_attendees" ADD CONSTRAINT "site_meeting_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meeting_attendees" ADD CONSTRAINT "site_meeting_attendees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meetings" ADD CONSTRAINT "site_meetings_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meetings" ADD CONSTRAINT "site_meetings_generated_pdf_file_id_files_id_fk" FOREIGN KEY ("generated_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meetings" ADD CONSTRAINT "site_meetings_signed_pdf_file_id_files_id_fk" FOREIGN KEY ("signed_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_meetings" ADD CONSTRAINT "site_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD CONSTRAINT "honoraire_contracts_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD CONSTRAINT "honoraire_contracts_moa_id_moas_id_fk" FOREIGN KEY ("moa_id") REFERENCES "public"."moas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD CONSTRAINT "honoraire_contracts_signed_file_id_files_id_fk" FOREIGN KEY ("signed_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_contracts" ADD CONSTRAINT "honoraire_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_missions" ADD CONSTRAINT "honoraire_missions_contract_id_honoraire_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."honoraire_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_contract_id_honoraire_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."honoraire_contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_mission_id_honoraire_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."honoraire_missions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_generated_pdf_file_id_files_id_fk" FOREIGN KEY ("generated_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_signed_pdf_file_id_files_id_fk" FOREIGN KEY ("signed_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honoraire_situations" ADD CONSTRAINT "honoraire_situations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_linked_honoraire_situation_id_honoraire_situations_id_fk" FOREIGN KEY ("linked_honoraire_situation_id") REFERENCES "public"."honoraire_situations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_configurations" ADD CONSTRAINT "einvoice_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_events" ADD CONSTRAINT "einvoice_events_honoraire_situation_id_honoraire_situations_id_fk" FOREIGN KEY ("honoraire_situation_id") REFERENCES "public"."honoraire_situations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_events" ADD CONSTRAINT "einvoice_events_expense_invoice_id_expense_invoices_id_fk" FOREIGN KEY ("expense_invoice_id") REFERENCES "public"."expense_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_invoices" ADD CONSTRAINT "expense_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_invoices" ADD CONSTRAINT "expense_invoices_supplier_company_id_companies_id_fk" FOREIGN KEY ("supplier_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_invoices" ADD CONSTRAINT "expense_invoices_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_invoices" ADD CONSTRAINT "expense_invoices_linked_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("linked_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_supplier_company_id_companies_id_fk" FOREIGN KEY ("supplier_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_attached_file_id_files_id_fk" FOREIGN KEY ("attached_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_summaries" ADD CONSTRAINT "vat_summaries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_entity_idx" ON "audit_logs" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_unique" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_org_unique" ON "users" USING btree ("clerk_user_id","organization_id");--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "cockpit_grants_user_idx" ON "cockpit_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cockpit_grants_org_scope_idx" ON "cockpit_access_grants" USING btree ("organization_id","scope");--> statement-breakpoint
CREATE INDEX "cockpit_grants_operation_idx" ON "cockpit_access_grants" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_r2_key_unique" ON "files" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "files_organization_id_idx" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "files_kind_idx" ON "files" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "companies_organization_id_idx" ON "companies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_org_siret_unique" ON "companies" USING btree ("organization_id","siret") WHERE "companies"."siret" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "companies_raison_sociale_idx" ON "companies" USING btree ("raison_sociale");--> statement-breakpoint
CREATE INDEX "company_contacts_company_idx" ON "company_contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "insurances_company_idx" ON "insurances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "insurances_company_type_idx" ON "insurances" USING btree ("company_id","type");--> statement-breakpoint
CREATE INDEX "insurances_date_fin_idx" ON "insurances" USING btree ("date_fin");--> statement-breakpoint
CREATE INDEX "moa_contacts_moa_idx" ON "moa_contacts" USING btree ("moa_id");--> statement-breakpoint
CREATE INDEX "moas_organization_id_idx" ON "moas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "moas_raison_sociale_idx" ON "moas" USING btree ("raison_sociale");--> statement-breakpoint
CREATE UNIQUE INDEX "avenants_lot_numero_unique" ON "avenants" USING btree ("lot_id","numero");--> statement-breakpoint
CREATE INDEX "avenants_lot_idx" ON "avenants" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "avenants_statut_idx" ON "avenants" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "cautions_lot_idx" ON "cautions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "cautions_date_expiration_idx" ON "cautions" USING btree ("date_expiration");--> statement-breakpoint
CREATE UNIQUE INDEX "dgds_lot_unique" ON "dgds" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "dpgf_lines_lot_idx" ON "dpgf_lines" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dpgf_lines_lot_ordre_unique" ON "dpgf_lines" USING btree ("lot_id","ordre");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_operation_numero_unique" ON "lots" USING btree ("operation_id","numero");--> statement-breakpoint
CREATE INDEX "lots_operation_id_idx" ON "lots" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "lots_company_id_idx" ON "lots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "operation_stakeholders_operation_idx" ON "operation_stakeholders" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operations_org_code_unique" ON "operations" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "operations_organization_id_idx" ON "operations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "operations_moa_idx" ON "operations" USING btree ("moa_id");--> statement-breakpoint
CREATE INDEX "planning_tasks_operation_idx" ON "planning_tasks" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "planning_tasks_lot_idx" ON "planning_tasks" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pv_receptions_operation_unique" ON "pv_receptions" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retentions_lot_unique" ON "retentions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "retentions_echeance_idx" ON "retentions" USING btree ("echeance_liberation");--> statement-breakpoint
CREATE INDEX "situation_lines_situation_idx" ON "situation_lines" USING btree ("situation_id");--> statement-breakpoint
CREATE INDEX "situations_lot_idx" ON "situations" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "situations_lot_period_unique" ON "situations" USING btree ("lot_id","periode_annee","periode_mois");--> statement-breakpoint
CREATE UNIQUE INDEX "cp_lot_numero_unique" ON "certificats_paiement" USING btree ("lot_id","numero");--> statement-breakpoint
CREATE INDEX "cp_operation_idx" ON "certificats_paiement" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "cp_lot_idx" ON "certificats_paiement" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "cp_statut_idx" ON "certificats_paiement" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "numbering_counters_org_scope_unique" ON "numbering_counters" USING btree ("organization_id","scope");--> statement-breakpoint
CREATE INDEX "meeting_photos_meeting_idx" ON "meeting_photos" USING btree ("site_meeting_id");--> statement-breakpoint
CREATE INDEX "observation_photos_observation_idx" ON "observation_photos" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "observations_meeting_idx" ON "observations" USING btree ("site_meeting_id");--> statement-breakpoint
CREATE INDEX "observations_plan_idx" ON "observations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "observations_statut_idx" ON "observations" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "plans_operation_idx" ON "plans" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "plans_lot_idx" ON "plans" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "reserves_operation_idx" ON "reserves" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "reserves_lot_idx" ON "reserves" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "reserves_statut_idx" ON "reserves" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "attendees_meeting_idx" ON "site_meeting_attendees" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "site_meetings_operation_idx" ON "site_meetings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "site_meetings_date_idx" ON "site_meetings" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "honoraire_contracts_operation_unique" ON "honoraire_contracts" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "honoraire_contracts_moa_idx" ON "honoraire_contracts" USING btree ("moa_id");--> statement-breakpoint
CREATE INDEX "honoraire_missions_contract_idx" ON "honoraire_missions" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "honoraire_missions_contract_ordre_unique" ON "honoraire_missions" USING btree ("contract_id","ordre");--> statement-breakpoint
CREATE UNIQUE INDEX "honoraire_situations_contract_numero_unique" ON "honoraire_situations" USING btree ("contract_id","numero");--> statement-breakpoint
CREATE INDEX "honoraire_situations_contract_idx" ON "honoraire_situations" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "honoraire_situations_mission_idx" ON "honoraire_situations" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "honoraire_situations_statut_idx" ON "honoraire_situations" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_provider_external_unique" ON "bank_accounts" USING btree ("provider","external_account_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_organization_idx" ON "bank_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_account_idx" ON "bank_transactions" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_external_unique" ON "bank_transactions" USING btree ("bank_account_id","external_tx_id") WHERE "bank_transactions"."external_tx_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bank_transactions_needs_reco_idx" ON "bank_transactions" USING btree ("needs_reconciliation");--> statement-breakpoint
CREATE UNIQUE INDEX "einvoice_configurations_organization_unique" ON "einvoice_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "einvoice_events_situation_idx" ON "einvoice_events" USING btree ("honoraire_situation_id");--> statement-breakpoint
CREATE INDEX "einvoice_events_expense_idx" ON "einvoice_events" USING btree ("expense_invoice_id");--> statement-breakpoint
CREATE INDEX "einvoice_events_status_idx" ON "einvoice_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expense_invoices_organization_idx" ON "expense_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expense_invoices_supplier_idx" ON "expense_invoices" USING btree ("supplier_company_id");--> statement-breakpoint
CREATE INDEX "expense_invoices_date_idx" ON "expense_invoices" USING btree ("date_facture");--> statement-breakpoint
CREATE INDEX "recurring_charges_organization_idx" ON "recurring_charges" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "recurring_charges_next_due_idx" ON "recurring_charges" USING btree ("next_due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "vat_summaries_org_period_unique" ON "vat_summaries" USING btree ("organization_id","periode_annee","periode_mois");