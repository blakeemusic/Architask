# Architask — Mémoire projet pour Claude Code

> Ce fichier est ta source de vérité à chaque session. Lis-le toujours en premier.
> Pour le détail métier complet, consulte `PRD_Architask_v0.2.md` à la racine.
> Pour les maquettes visuelles, consulte `mockups_Architask_v0.3.html`.

---

## Contexte

**Architask** est un SaaS web + iPad de gestion de chantier pour PME d'architecture (cible : agences 4-15 personnes en France). Positionnement : fusion BIM Office (admin/financier) + Archipad (CR chantier terrain) avec une UX moderne style Apple/Revolut. Construit en vibe coding avec Claude Code. Arthur est le product owner, non-développeur.

**Marché privé NF P03-001 uniquement en MVP** (marché public CCAG = V2).

## Stack technique

- **Framework** : Next.js 15 (App Router, Server Components, Turbopack)
- **Langage** : TypeScript strict (jamais `any`, jamais `eslint-disable`)
- **UI** : Tailwind v4 + shadcn/ui customisé + Framer Motion
- **Base de données** : Postgres (Neon) + Drizzle ORM
- **Auth** : Clerk (multi-org natif, SSO en V1)
- **Storage** : Cloudflare R2 (PDF, photos, plans, attestations décennale)
- **OCR / IA** : `@anthropic-ai/sdk` (Claude Sonnet 4.6 Vision)
- **Email** : Resend
- **Signature électronique** : **pluggable** (Yousign + DocuSign, choix par agence)
- **PDP Factur-X** : Pennylane par défaut, abstraction `EInvoiceProvider`
- **Bank connect DSP2** : Bridge par défaut, abstraction `BankProvider`
- **Génération PDF** : `@react-pdf/renderer` + Puppeteer (templates HTML)
- **Plan viewer iPad** : `pdfjs-dist` + `konva` / `react-konva`
- **Jobs async** : Trigger.dev (OCR batch, alertes planifiées)
- **Hosting** : Vercel + Neon EU + R2 EU
- **Monitoring** : Sentry (à brancher quand on aura des utilisateurs réels)

## 10 modules MVP (architecture fonctionnelle)

1. **Opérations & marchés travaux** — import DPGF en PDF (OCR Claude Vision) ou Excel
2. **Avenants**
3. **Certificats de paiement (CP)** — situations entreprises en PDF avec OCR, calcul auto retenue/révision/TVA
4. **Récap situation générale** — par lot et globale
5. **Réception, DGD, cautions, PV**
6. **Planning chantier Gantt** simple (barres par lot, jalons, pas de dépendances en MVP)
7. **Annuaire MOA + Entreprises** — assurances décennales versionnées, contrôle bloquant à la signature
8. **CR de chantier iPad** style Archipad (plans annotés, observations géolocalisées, photos, dictée, génération PDF, OPR, hors-ligne PWA)
9. **Cockpit · Honoraires** — contrats archi avec missions libres + situations cumulatives, accès restreint Owner
10. **Cockpit · Trésorerie** — bank connect DSP2, charges récurrentes, cash flow prévisionnel, rapprochement bancaire automatique avec calcul TVA déductible, facturation électronique Factur-X via PDP Pennylane

Modules 9-10 regroupés dans l'espace **Cockpit** (accès Owner par défaut, autorisations ponctuelles via `CockpitAccessGrant`).

## Règles métier critiques (NF P03-001 — non négociables)

- Tous les montants : **2 décimales, arrondi au centime supérieur**.
- Retenue garantie : **5 % par défaut**, plafonnée à 5 % du marché. Libération 1 an après réception.
- Délai paiement légal : **30 jours fin de mois**.
- **Σ CP émis ≤ marché révisé + travaux suppl. acceptés** — assertion bloquante serveur.
- **Assurance décennale valide à `operation.date_os`** pour signer un marché — assertion bloquante.
- Activité couverte par la décennale doit ∈ activités déclarées de l'entreprise.
- Alerte expiration décennale à **−60 j**.
- Σ % missions honoraires = 100% (ou Σ montants = total) à la signature contrat archi.
- `pct_avancement_nouveau ≥ pct_avancement_precedent` sur HonoraireSituation (pas de retour en arrière).
- Numérotation CP : auto, format `CP-{op-code}-{lot-num}-{n°}`.
- Numérotation notes honoraires : auto, format `NH-{op-code}-{année}-{n°}`.

## Conventions code

- **App Router** + Server Components par défaut. Server Actions pour mutations.
- **React Hook Form + Zod** pour tous les formulaires (jamais `useState` seul).
- **Tabular nums** sur tous les montants (`className="tabular-nums"` ou `font-tabular`).
- **Pas de any** en TS. Pas de `eslint-disable`.
- **Server actions** retournent `{ data, error }` typés, jamais `throw` côté client.
- **Tests Vitest obligatoires** (couverture > 90 %) sur :
  - `lib/finance/computeCP.ts` (moteur calcul CP)
  - `lib/finance/computeDGD.ts` (moteur DGD)
  - `lib/ocr/extractDPGF.ts` et `extractSituation.ts` (avec PDF fixtures)
  - `lib/validation/insurance.ts` (validation décennale)
  - `lib/finance/computeHonoraireSituation.ts`
- **RLS Postgres** par `organization_id` sur toutes les tables.
- **Audit log immutable** sur actions financières (CP, DGD, contrat honoraires, signature).

## Design system (tokens dans `src/app/globals.css`)

### Principes design

1. **Big bold typography** sur tous les chiffres clés (56-72px, weight 700, letter-spacing −0.025 à −0.035em). Le chiffre est le héros, le libellé est fin et gris.
2. **Cards très arrondies** : radius **24-32px** pour cards principales, 14-16px pour éléments imbriqués.
3. **Mix de cards de couleurs** : alterner blanc + noir (hero/accent) + mint green (`#B8F2D1 → #DCFCE7`, positif) + lilac (`#DDD6FE → #EDE9FE`, data secondaire).
4. **Tooltips noirs flottants** sur les graphes (pill noire texte blanc).
5. **Flèches ↗ stylisées** systématiques sur variations.
6. **Tabs en pill segmented** Apple-like (container gris + inner-pills blanches avec shadow).
7. **Boutons primaires noirs** (`var(--text-primary)`) plutôt qu'en brand color.
8. **Whitespace radical** : padding 24-32px, gaps 32-40px.
9. **Animations** 120-240ms ease-out (`cubic-bezier(0.2, 0, 0, 1)`), jamais bounce.
10. **Mode sombre** dès le composant, jamais en afterthought.

### Tokens à respecter

- Couleurs light : `--bg-base: #F4F5F7`, `--surface: #FFFFFF`, `--text-primary: #0B0B0F`, `--text-secondary: #5F6675`, `--brand: #1F2DEA`, mint `#B8F2D1→#DCFCE7`, lilac `#DDD6FE→#EDE9FE`.
- Typography : `Inter` variable (Google Fonts), tabular nums obligatoires sur montants.
- Radius : `sm=6, md=10, lg=14, xl=18, hero=28`.
- Référence visuelle complète : voir `mockups_Architask_v0.3.html`.

## UI iPad (Module 8 — CR chantier)

- Plein écran landscape iPad Pro.
- Plan PDF au centre (`pdfjs-dist` viewer), zoom pinch + pan tactile fluide.
- Couche Konva par-dessus pour observations (pins colorés par catégorie).
- Tap sur le plan → drawer création d'observation.
- Mode offline : Service Worker + IndexedDB (Dexie.js).
- Dictée vocale : Web Speech API (fallback iOS Safari natif).

## Couche signature pluggable

- Interface `SignatureProvider` avec méthodes : `createSignatureRequest`, `getStatus`, `downloadSigned`, `webhookHandler`.
- Implémentations : `YousignProvider` (Yousign API v3), `DocusignProvider` (DocuSign eSignature API).
- Singleton `getSignatureProvider(orgId)` lit la config agence (BYOK : clés API agence).
- Endpoint webhook unifié : `/api/signature/webhook?provider=...`.

## OCR PDF (DPGF, situations, factures)

- Service `lib/ocr/extractDPGF.ts` et `extractSituation.ts`.
- Implémenté avec `@anthropic-ai/sdk`, model `claude-sonnet-4-6` (vision).
- Prompt système typé strict, retour JSON validé par schéma Zod.
- Score de confiance par poste (0-100).
- UI `<OCRValidationCard>` : badge vert ≥95, orange 70-95, rouge <70.

## Hors scope MVP — ne PAS ajouter sans validation Arthur

- BIM/IFC, DAO/CAO, viewer 3D
- GED bureau (focus chantier)
- Gantt avancé (dépendances, chemin critique) — c'est V1
- Contrats archi avec modèles type loi MOP (missions 100% libres en MVP)
- Temps passés collaborateurs — V2
- Suivi commercial / pipeline projets — V2
- Marché public CCAG Travaux — V2
- App mobile native iOS/Android (V2 — MVP en PWA mobile + iPad optimisée)
- Multi-bureaux / multi-entités juridiques — V2
- Architask comme PDP Factur-X (on s'intègre à Pennylane PDP, on ne devient pas PDP)
- Compta complète (bilan, CdR, FEC) — on délègue à Pennylane

## Fichiers de référence à consulter

- `PRD_Architask_v0.2.md` — vision, périmètre, modèle de données complet, parcours utilisateurs, roadmap, brief prompts.
- `mockups_Architask_v0.3.html` — référence visuelle pour le design system. Toujours s'inspirer de cette UI avant de pondre des composants.

## Posture d'Arthur

- Arthur est **product owner non-dev**. Explique-lui en français ce que tu fais, sois pédagogue.
- **Toujours poser des questions** si arbitrage ambigu (scope, priorisation, choix techniques structurants). Ne pas trancher seul.
- **Commit petit, commit souvent** : un commit par sous-tâche, message en français clair.
- Si tu détectes une régression métier (ex. tu casses l'assertion Σ CP), **stop et préviens**.
