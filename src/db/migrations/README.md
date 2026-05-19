# Migrations Architask

Fichiers SQL générés par `drizzle-kit generate`. **Ne pas éditer à la main** — toute modification d'une migration déjà appliquée invalide le hash dans `meta/_journal.json`.

## Workflow

- `npm run db:generate` → génère le diff schema → SQL dans `0000_*.sql`, `0001_*.sql`, etc.
- `npm run db:push` → applique le dernier état du schema directement (dev / Neon préview).
- `npm run db:migrate` → applique les migrations de manière transactionnelle (prod).

## TODO V1 — RLS Postgres

Les policies Row Level Security sont **prévues mais non activées en MVP** (cf. CLAUDE.md). Filtrage par `organization_id` géré exclusivement en code côté server actions pour l'instant.

À ajouter dans une migration `00XX_enable_rls.sql` au sprint sécurité V1 :

```sql
-- Pattern de base, à dupliquer sur toutes les tables ayant organization_id
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY operations_org_isolation ON operations
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Côté server action, avant chaque transaction :
--   await db.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
```

Tables concernées (toutes celles qui portent une colonne `organization_id` directe ou indirecte via une chaîne FK) :

- Direct : `organizations`, `users`, `audit_logs`, `cockpit_access_grants`, `files`, `companies`, `moas`, `operations`, `numbering_counters`, `bank_accounts`, `recurring_charges`, `expense_invoices`, `vat_summaries`, `einvoice_configurations`
- Indirect (cascade FK) : toutes les tables enfants (lots, avenants, situations, CP, plans, observations, etc.)

## TODO V1 — audit_logs immuables

```sql
CREATE OR REPLACE FUNCTION raise_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION raise_immutable();
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION raise_immutable();
```

## TODO V1 — KMS sur les credentials providers

Aujourd'hui : `bank_accounts.encrypted_credentials_ref` et `einvoice_configurations.encrypted_credentials_ref` stockent un placeholder texte. À remplacer par une **référence opaque** vers un secret manager (Vercel KV chiffré, Doppler, ou `pgcrypto.pgp_sym_encrypt` côté Postgres). Ne **jamais** stocker les clés API en clair.
