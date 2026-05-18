# Architask — Doc de cadrage & PRD v0.2

> **Nom de code projet** : Architask (nom de travail — atelier branding ouvert)
> **Auteur** : Arthur — **Date** : 15 mai 2026
> **Statut** : v0.2 — élargissement du scope MVP (Gantt, Annuaire, CR Chantier Archipad-like), refonte parcours pour PDF + OCR, pricing 3 plans, design Apple/Revolut.

---

## Changelog v0.1 → v0.2

- **Périmètre MVP étendu de 5 à 8 modules** : ajout (6) Planning chantier — Gantt simple, (7) Annuaire MOA & Entreprises avec assurances décennales, (8) Compte-rendu de chantier façon Archipad (plans annotés, observations géolocalisées, photos, génération PDF, gestion réserves OPR).
- **Imports refondus** : la majorité des situations et DPGF arrivent en PDF, pas en Excel. Le produit accepte les deux formats avec **extraction OCR hybride** (IA pré-remplit, l'utilisateur valide).
- **Signature électronique pluggable** : choix Yousign **ou** DocuSign selon abonnement existant de l'archi, configurable au niveau agence.
- **Stratégie pricing** : 3 plans verrouillés — **Starter (financier essentiel)**, **Pro (financier + CR + Gantt complet)**, **Enterprise (Pro + intégrations + SSO + support dédié)**, positionnés mid-market avec capacité premium.
- **Design system** rehaussé : référence Apple + Revolut (verre dépoli, micro-typo, courbes douces, mode sombre soigné, mobile/iPad first-class pour les usages chantier).
- **Roadmap MVP rallongée** de 16 à 22 semaines pour absorber les 3 modules ajoutés.

---

## Sommaire

1. [Executive Summary](#1-executive-summary)
2. [Vision & proposition de valeur](#2-vision--proposition-de-valeur)
3. [Analyse concurrentielle & positionnement](#3-analyse-concurrentielle--positionnement)
4. [Personas & cible](#4-personas--cible)
5. [Périmètre fonctionnel MVP — 8 modules](#5-périmètre-fonctionnel-mvp--8-modules)
6. [Règles métier & conformité NF P03-001](#6-règles-métier--conformité-nf-p03-001)
7. [Modèle de données](#7-modèle-de-données)
8. [Parcours utilisateurs clés](#8-parcours-utilisateurs-clés)
9. [Direction UI/UX (Apple/Revolut)](#9-direction-uiux-applerevolut)
10. [Stack technique & intégrations](#10-stack-technique--intégrations)
11. [Pricing & go-to-market](#11-pricing--go-to-market)
12. [Roadmap MVP → V1 → V2](#12-roadmap-mvp--v1--v2)
13. [Risques & questions ouvertes](#13-risques--questions-ouvertes)
14. [Brief pour Claude Code (vibe coding)](#14-brief-pour-claude-code-vibe-coding)

---

## 1. Executive Summary

**Architask** est un SaaS web (+ iPad) **tout-en-un de gestion de chantier** pour les petites agences d'architecture (4 à 15 personnes), en concurrence frontale avec **BIM Office** (côté financier) et **Archipad** (côté compte-rendu de chantier). Le produit unifie ce qui aujourd'hui se fait dans trois outils distincts : Excel pour la gestion financière, BIM Office pour la structuration administrative, Archipad pour les CR de chantier — en une seule interface, radicalement plus belle, plus rapide, mobile-first.

**Pourquoi maintenant.** BIM Office domine côté admin/financier mais est unanimement perçu comme « lourd, moche, dur à prendre en main ». Archipad domine côté terrain mais ne traite pas la partie financière. Aucun acteur n'a réuni les deux mondes avec une expérience produit moderne, pensée comme un produit grand public (Apple/Revolut/Linear) appliquée au métier archi.

**Le MVP** couvre 10 modules indissociables : (1) opérations & marchés travaux avec import DPGF PDF ou Excel, (2) avenants, (3) certificats de paiement mensuels avec OCR hybride des situations PDF, (4) récapitulatif situation générale, (5) DGD, cautions, PV de réception, (6) planning chantier simple style Gantt, (7) annuaire MOA & entreprises (avec assurances décennales contrôlées), (8) compte-rendu de chantier sur iPad façon Archipad (plans annotés, observations géolocalisées, photos, génération PDF, OPR), (9) honoraires agence (contrats archi + situations cumulatives), (10) **trésorerie agence** (connexion bancaire DSP2 via Bridge/Powens, charges récurrentes, cash flow prévisionnel, facturation électronique Factur-X via PDP partenaire type Pennylane). Les modules 9 et 10 sont regroupés dans le **Cockpit**, espace patron à accès restreint.

**Hypothèses de succès** : une PME archi gagne 8 à 15 h/semaine sur la gestion chantier ET sur la facturation des honoraires, et 2 à 4 h/semaine pour le patron sur le pilotage trésorerie ; elle accepte de payer 79 à 149 € / utilisateur / mois selon plan ; un MVP autonome se construit en 27 à 29 semaines en vibe coding avec Claude Code, en investissant fortement sur le design system dès la semaine 1.

## 2. Vision & proposition de valeur

### Vision à 3 ans

Devenir le **système d'exploitation des agences d'archi** françaises de 1 à 50 personnes : chantier (financier + planning + CR + admin) en MVP/V1, puis honoraires + contrats archi + suivi commercial en V1/V2, puis temps passés + reporting + facturation en V2. Sans jamais devenir une usine à gaz : chaque module reste un produit en lui-même, beau, focalisé, conforme.

### Promesse produit

> « Tout le chantier dans une seule app : marchés, certificats de paiement, plannings, comptes-rendus iPad. Avec une UI dont tu seras fier de montrer à un autre archi. »

### Les 5 piliers de différenciation

1. **Vertical et radicalement focalisé.** On fait UNE chose : la conduite de chantier MOE pour archis. Pas de BIM, pas de DAO, pas de commercial sortant. La concentration tue la complexité.
2. **Design Apple/Revolut-grade.** Verre dépoli, micro-typo, gros chiffres, transitions courtes, courbes douces, mode sombre soigné, iPad first-class. L'antithèse visuelle de BIM Office, et l'évolution naturelle d'Archipad.
3. **Conforme par défaut.** Les règles NF P03-001 sont câblées (retenue 5 %, révisions, délais 30 j). Les assurances décennales sont contrôlées à la signature du marché. Les CP ne peuvent pas dépasser le marché révisé (assertion bloquante).
4. **Hybride PDF + Excel + OCR IA.** Les entreprises envoient majoritairement des PDF — le produit les lit avec OCR/IA, pré-remplit, l'humain valide. Plus de copier-coller.
5. **Self-serve premium.** Inscription, paramétrage et premier chantier en moins de 45 min, sans appel commercial — comme Linear ou Qonto, mais avec la profondeur métier d'un BIM Office.

### Anti-promesses (ce que le produit ne fera PAS)

- Pas de modélisation BIM 3D, pas de viewer IFC.
- Pas de DAO/CAO/dessin technique — on travaille sur les plans déjà produits ailleurs.
- Pas de comptabilité — on exporte vers Pennylane / Sage / EBP via FEC.
- Pas de marché public en MVP (CCAG Travaux à V2).
- Pas de gestion documentaire générale (GED bureau) — focus chantier.
- Pas de gestion RH ni paie.

## 3. Analyse concurrentielle & positionnement

### BIM Office — forces et faiblesses

**Forces.** Couverture fonctionnelle large (contrats, financier, temps passés, GED, suivi commercial), conformité métier, base installée importante, intégrations comptables matures.

**Faiblesses observées chez les utilisateurs PME.**

- *UI obsolète* — interface Windows-like, 1990s. Pas de design system cohérent. Pas de mobile utilisable.
- *Courbe d'apprentissage brutale* — formation payante (1 à 3 jours) quasi obligatoire.
- *Sur-paramétrage* — chaque action demande 10 champs dont 8 vides ou par défaut.
- *Workflow rigide* — pas de raccourcis clavier, pas de command palette, beaucoup de clics pour des actions courantes.
- *Tarif premium sans UX premium* — 100-150 €/u/mois selon modules.
- *Mobilité absente* — consultations terrain (réception, visites) impossibles en pratique.

### Archipad — forces et faiblesses

**Forces.** Référence française pour le CR chantier MOE. Excellente expérience iPad. Plans annotés, observations géolocalisées, génération PDF de qualité, gestion OPR mature. Multi-plateforme (iPad, iPhone, Android, web).

**Faiblesses observées.**

- *Périmètre limité au terrain* — aucune gestion financière, ni marchés, ni CP.
- *Web companion en retrait* — l'expérience desktop est moins soignée que la version iPad.
- *Pas d'annuaire structuré* — entreprises ressaisies par projet, pas de réutilisation.
- *Tarif* — autour de 50-90 €/u/mois selon plan, sans le financier.

### Carte du paysage

| Acteur | Cible | Périmètre | Force | Faiblesse vs Architask |
|---|---|---|---|---|
| **BIM Office** | Archis 5-200 | Tout admin/financier | Couverture | UX, prix, pas de terrain |
| **Archipad** | Archis MOE | CR chantier, OPR | UX iPad excellente | Pas de financier ni admin |
| **Multidoc / Abvent** | Archis | Tout-en-un | Légacy établi | Modernité |
| **Batappli / Onaya** | Entreprises BTP | Devis + chantier | BTP-natif | Pas pour MOE |
| **Pennylane / Qonto** | TPE/PME | Compta/banque | UX moderne | Pas de spé chantier |
| **Excel** | Tous | Universel | Flexibilité | Pas de structure, erreurs |

### Positionnement

> **Architask est à BIM Office + Archipad ce que Notion est à Confluence + Trello** : on fusionne deux mondes qui ne se parlent pas, on les modernise en un produit unifié, on construit une expérience meilleure que la somme des parties.

### Stratégie d'entrée

Attaquer par les deux pains les plus aigus en parallèle : les **CP mensuels** (gain de temps administratif énorme) et les **CR de chantier sur iPad** (front mobile que BIM Office ne couvre pas, équivalence Archipad). Une fois ces deux briques solides, étendre vers contrats archi (V1) puis suivi commercial (V2).

## 4. Personas & cible

### Cible primaire — Petite agence d'architecture (4 à 15 personnes)

Profil : 1 à 3 architectes associés, 2 à 8 collaborateurs (chef de projet, dessinateur, assistante), 0 à 2 fonctions support (administration, compta externalisée). Chiffre d'affaires 300 k€ à 2 M€. 5 à 30 chantiers en cours dont 3 à 10 en phase travaux simultanément. Marchés privés majoritairement.

### Persona 1 — « Camille », architecte associée (35-50 ans)

- **Rôle** : co-gérante, en charge des chantiers et de la relation client.
- **Quotidien** : 60 % terrain/RDV, 40 % bureau. Lit ses e-mails sur le téléphone entre deux RDV. Utilise un iPad Pro en visite de chantier.
- **Pain points** : ne sait jamais où en est financièrement chaque chantier sans rouvrir Excel. Les CP sont préparés par l'assistante mais elle doit les valider à la va-vite. Perd 30 min à retrouver le bon avenant signé. En visite de chantier, prend des photos sur son téléphone qu'elle galère à remettre dans le bon dossier le soir.
- **Ce qu'elle veut** : un dashboard d'agence qui dit « tu as 3 CP à valider, 2 chantiers en alerte budget, 1 DGD à finaliser » ; et sur iPad en visite, annoter le plan, prendre une photo, dicter une réserve, finaliser le CR en quittant le chantier.

### Persona 2 — « Sébastien », chef de projet (28-40 ans)

- **Rôle** : suit 3 à 6 chantiers en simultané, de la conception à la réception.
- **Quotidien** : 50/50 bureau/chantier. Reçoit les situations des entreprises tous les mois (majoritairement en PDF).
- **Pain points** : ressaisir les avancements de situations PDF dans son tableau de suivi (1-2 h par chantier par mois). Refaire les calculs de retenue à la main. Générer le CP en Word, signer, scanner, envoyer. Sur le terrain, alterner entre Archipad (pour le CR) et son tableau Excel (pour la financière).
- **Ce qu'il veut** : importer la situation PDF en un clic, l'OCR la lit, il valide, le CP se génère et part en signature à Camille. Sur le terrain, tout est dans la même app.

### Persona 3 — « Nathalie », assistante d'agence (30-55 ans)

- **Rôle** : préparation administrative des CP, suivi paiements clients, secrétariat juridique chantier.
- **Quotidien** : 100 % bureau. Power-user d'Excel.
- **Pain points** : ressaisir 12 fois par mois les mêmes infos. Erreurs de calcul de retenue qui coûtent des heures. Versions multiples d'avenants. Recherche éternelle de l'attestation décennale à jour de telle entreprise.
- **Ce qu'elle veut** : un annuaire entreprises où la décennale est toujours à jour, des CP fiables au calcul, un export propre pour la compta.

### Hors cible MVP

- Solo archis < 3 personnes (V1 — offre solo allégée).
- Agences > 50 personnes (V2 — collaboration avancée, multi-bureaux).
- Marchés publics CCAG (V2).
- Maîtrise d'ouvrage / promoteurs (jamais — métier différent).

## 5. Périmètre fonctionnel MVP — 10 modules (incluant le Cockpit)

Le MVP couvre **10 modules indissociables** organisés en quatre briques : *Pilotage administratif & financier MOE* (modules 1-5, 7), *Pilotage terrain & planning* (modules 6, 8), et **Cockpit (espace Owner, accès restreint)** qui regroupe le module 9 *Honoraires agence* et le module 10 *Trésorerie agence*. Le fil rouge utilisateur : *créer une opération → structurer marchés et planning → signer contrat d'honoraires MOA → émettre CP entreprises ET notes d'honoraires au fil de l'avancement → conduire les CR de chantier sur iPad → clôturer en réception puis DGD*. Le **Cockpit** est l'espace patron transversal qui agrège la vue financière de l'agence (honoraires + trésorerie + facturation électronique).

### Concept "Cockpit"

Le **Cockpit** est l'espace patron, à accès restreint Owner / Admin (avec autorisations ponctuelles). Il regroupe tout ce qui concerne le pilotage financier de l'agence en tant qu'entreprise (pas en tant que conducteur d'opérations). Il contient en MVP :

- Module 9 — **Honoraires agence** (par opération + vue globale)
- Module 10 — **Trésorerie agence** (bank connect + charges + cash flow + facturation électronique)

Architecture URL : route racine `/cockpit` avec sous-routes `/cockpit/honoraires`, `/cockpit/tresorerie`, `/cockpit/facturation`. Sub-nav horizontale en haut de chaque page Cockpit. Les permissions de `HonoraireAccessGrant` s'étendent à tout le Cockpit (renommer en `CockpitAccessGrant` en implémentation).

### Module 1 — Opérations & marchés travaux

**Objectif.** Modéliser un chantier avec ses lots, ses entreprises (issues de l'annuaire) et ses marchés signés.

**Fonctionnalités MVP.**

- Création d'opération : nom, MOA (depuis annuaire), adresse, dates clés (OS, durée prévue, réception cible), montant prévisionnel global, équipe MOE.
- Définition des **lots** — bibliothèque type CFC ou Uniformat, personnalisable.
- Pour chaque lot : entreprise titulaire (depuis annuaire), montant marché HT, TVA, mode de révision, retenue garantie (5 % par défaut), modalités de paiement (30 j par défaut), **assurance décennale rattachée** (référence annuaire, à jour pour les dates du chantier).
- **Import DPGF — au choix utilisateur** :
  - *Mode Excel* : drag-and-drop d'un .xlsx, auto-détection colonnes, mapping interactif, prévisualisation.
  - *Mode PDF* (cas majoritaire) : drag-and-drop d'un .pdf, **OCR + IA (Claude Vision)** extrait les postes (désignation, unité, qté, PU, montant), confiance affichée par poste, validation interactive ligne par ligne avant import.
- Stockage des pièces : marché signé, CCAP, CCTP, DPGF, attestations décennale et RC pro — versionnés.
- États : *en préparation*, *signé*, *en exécution*, *en réception*, *DGD*, *clos*.

**Contrôle bloquant.** Un lot ne peut passer en *signé* que si l'**attestation décennale** de l'entreprise est présente, valide à la date d'OS, et couvre la nature des travaux.

**User stories clés.**

> *Sébastien, je veux importer la DPGF d'une entreprise même quand je n'ai que le PDF, et que l'OCR me pré-remplisse les lignes pour que je valide en 5 minutes.*
> *Nathalie, je veux que le produit me bloque la signature d'un marché si la décennale de l'entreprise n'est pas à jour, pour ne plus avoir à courir après.*

### Module 2 — Avenants

**Objectif.** Gérer les modifications du marché initial.

**Fonctionnalités MVP.**

- Création d'avenant rattaché à un lot : numéro auto, objet, montant en + ou − HT, impact délai, date de signature.
- Affichage du **montant marché révisé** = marché initial + Σ avenants.
- Génération PDF brandée + signature électronique (Yousign ou DocuSign).
- Historique versionné, traçabilité.

**Règles métier.**

- Un avenant n'est effectif qu'une fois signé.
- Alerte si le cumul des avenants dépasse 15 % du marché initial du lot (seuil paramétrable).
- Impact automatique sur le planning Gantt (prolongation de délai propagée).

### Module 3 — Certificats de paiement (CP)

**Objectif.** Émettre les CP mensuels par lot à partir des situations entreprises (PDF majoritairement), avec retenue et révision automatiques.

**Fonctionnalités MVP.**

- **Saisie d'une situation entreprise** — au choix :
  - *Upload PDF* (cas majoritaire) : OCR/IA lit l'avancement par poste, pré-remplit, l'humain valide poste par poste (confiance affichée).
  - *Upload Excel* : si l'entreprise envoie l'avancement en .xlsx.
  - *Saisie manuelle* : avancement % global ou ventilé.
- Calcul automatique : cumul travaux exécutés HT, − CP précédents, − retenue garantie, + révision (formule), + TVA, = net à payer TTC.
- Workflow : *brouillon* → *à valider* (archi) → *signé* (Yousign/DocuSign selon configuration) → *envoyé entreprise* → *payé MOA* (déclaratif).
- Génération **PDF du CP** au template de l'agence (logo, mentions légales, tableau ventilé).
- Envoi par e-mail à l'entreprise depuis l'app, avec lien d'accusé de réception.
- Numérotation auto par opération et par lot.

**User stories clés.**

> *Sébastien, je glisse le PDF de situation que l'entreprise m'a envoyé, l'OCR pré-remplit, je valide en 1 minute, le CP est prêt.*
> *Camille, je reçois la notif mobile, je vérifie, je signe (Yousign ou DocuSign selon ce qu'on a en abonnement), c'est envoyé.*

### Module 4 — Récap situation générale (par lot / global)

**Objectif.** La vue stratégique. *L'écran qui remplace l'Excel de suivi.*

**Fonctionnalités MVP.**

- **Vue par opération — globale** : marché initial total, marché révisé, montant CP cumulés, % d'avancement, restant dû, projection fin de chantier, indicateurs d'alerte (dérive avenants, retard CP MOA, écart planning prévu vs réel).
- **Vue par opération — par lot** : ligne par lot avec sparkline d'avancement mensuel.
- **Vue agence — multi-opérations** : tous les chantiers en cours, classés par priorité (CP en attente, alertes), totaux d'agence.
- Export PDF du récap pour réunion de chantier ou COPIL.
- **Graphes Revolut-style** : courbes cumul travaux vs prévision, barres d'avancement par lot, donut répartition par lot, courbe en S sur la frise temporelle du planning.

### Module 5 — Réception, DGD, cautions

**Objectif.** Clôturer financièrement le chantier proprement, gérer la retenue de garantie.

**Fonctionnalités MVP.**

- **PV de réception** : génération PV (avec/sans réserves), date, liste des réserves par lot (issues du CR chantier OPR — voir module 8), signature électronique des parties.
- **Levée de réserves** : suivi par réserve, statut, date.
- **DGD** : calcul final par lot = marché révisé + travaux suppl. acceptés − pénalités, vs cumul CP versés. Solde mis en évidence.
- **Retenue de garantie** : suivi montant retenu, échéance libération (1 an après réception), alerte automatique à 11 mois.
- **Cautions bancaires (RBQS)** : enregistrement, date d'expiration, alerte avant expiration.

### Module 6 — Planning chantier (Gantt simple) — NOUVEAU v0.2

**Objectif.** Donner une vision linéaire des dates clés et des phases par lot, sans complexifier la vie de l'utilisateur.

**Fonctionnalités MVP (Gantt simple).**

- Vue Gantt par opération : une ligne par lot, barre de durée (début prévu / fin prévue), barre réelle superposée (début réel / fin réelle ou en cours).
- **Jalons clés** matérialisés : OS (ordre de service), démarrage chaque lot, fin chaque lot, réception, DGD, libération retenue.
- **Pas de dépendances entre tâches** au MVP (chemin critique, prédécesseurs : V1).
- Édition simple par drag des barres ou saisie de dates.
- **Synchronisation automatique** : un avenant qui prolonge le délai d'un lot décale automatiquement la barre prévue de ce lot.
- Export PDF du planning pour réunion.
- Vue calendrier mensuelle compatible mobile.

**Hors scope MVP — V1+.**

- Dépendances tâches, chemin critique, lien Microsoft Project.
- Affectation de ressources / équipes.
- Courbe en S financière sur le planning (V1).
- Sous-tâches par lot (V1).

### Module 7 — Annuaire (MOA & Entreprises) — NOUVEAU v0.2

**Objectif.** Source unique de vérité pour les entreprises et MOA récurrentes, réutilisables entre opérations, avec contrôle des assurances obligatoires.

**Fonctionnalités MVP.**

- **Annuaire MOA** : nom, type juridique, SIRET, contacts (multi), adresses, projets associés.
- **Annuaire Entreprises** :
  - Identification : raison sociale, SIRET, forme juridique, adresse, **logo** (upload manuel ou avatar généré à partir d'initiales + couleur stable hashée sur le SIRET), contacts multiples avec rôles (gérant, conducteur, comptabilité).
  - **Assurances obligatoires versionnées** :
    - *Décennale* : compagnie, n° police, montants garantis, **dates de validité**, **lots/activités couverts** (taxonomie type Qualibat), upload PDF de l'attestation.
    - *RC Professionnelle* : compagnie, n° police, dates de validité, montants.
    - *Garantie Parfait Achèvement* (le cas échéant).
  - **Alertes automatiques** : décennale expire dans < 60 j sur une entreprise en chantier actif (envoi mail au chef de projet).
  - Historique : marchés signés avec cette entreprise (vue 360°).
- **Contrôle métier au moment de signer un marché** : bloque si décennale absente / expirée / activité non couverte. Affiche un warning si expiration prévue avant fin du chantier.
- Partage de l'annuaire au sein de l'agence (toutes opérations).
- Import initial via fichier (Excel / CSV) — assistance setup.

**User stories clés.**

> *Nathalie, je rentre une entreprise une seule fois avec sa décennale, je la retrouve dans toutes les opérations, et le produit me prévient quand ça va expirer.*

### Module 8 — Compte-rendu de chantier (Archipad-like) — NOUVEAU v0.2

**Objectif.** Conduire les visites et réunions de chantier sur iPad (et web), produire des CR PDF pro en sortie de réunion, gérer les réserves OPR jusqu'à levée.

**Fonctionnalités MVP — terrain (iPad / mobile / web).**

- **Plans du chantier** uploadés par lot ou globalement (PDF, image) — multi-plans, zoom fluide, navigation tactile.
- **Observations géolocalisées sur plan** : point ou zone, catégorie (défaut, demande info, validation, sécurité…), description texte, photos rattachées (depuis appareil photo iPad), assignation à un intervenant, échéance.
- **Photos avec annotations** : flèches, ronds, croix, texte sur la photo.
- **Dictée vocale** texte (iOS natif) pour aller vite sur le terrain.
- **Pointage présence** : qui est présent à la réunion (extraction depuis annuaire).
- **Réserves OPR** : à la réception, catalogage de toutes les réserves par lot, statut (à lever / en cours / levée) avec photos avant/après.
- **Génération PDF de CR** en 1 clic à la fin de la visite : page de garde avec présents, plans avec observations annotées, liste des points par catégorie, photos. Template brandé agence.
- **Envoi automatique** du CR aux participants (signature électronique optionnelle).
- **Mode hors-ligne** : possibilité d'annoter sans connexion, synchronisation à la reconnexion (PWA + IndexedDB en MVP, app native iOS en V2).

**Liaison avec les autres modules.**

- Une observation peut être convertie en *avenant* (travaux suppl.) en 1 clic.
- Les réserves OPR alimentent automatiquement le PV de réception (module 5).
- Une observation peut être rattachée à un lot, et donc à une entreprise.

**User stories clés.**

> *Camille, en visite sur le chantier, j'ouvre le plan sur l'iPad, je pointe une fissure, je prends une photo, je dicte la réserve, j'assigne à l'entreprise de gros œuvre, j'enchaîne. À la fin, le CR est prêt à envoyer.*
> *Sébastien, à la réception, je catalogue les réserves par lot, je clique « générer PV », et le PV de réception est prêt à signer.*

### Module 9 — Honoraires agence (par opération) — NOUVEAU v0.2

**Objectif.** Pour chaque opération, gérer le contrat d'honoraires de l'agence avec la MOA et facturer l'avancement par mission au fil du projet. Module **à accès restreint** (Owner / Admin de l'agence par défaut, autorisations ponctuelles possibles).

**Accès restreint.** Par défaut, seuls les utilisateurs avec rôle `owner` ou `admin` de l'agence voient l'onglet Honoraires sur les opérations. Un Owner peut donner accès ponctuellement à un member (Nathalie, l'assistante, par exemple) — soit globalement (sur toutes les opérations), soit opération par opération. Décision : matrice de permissions granulaire reportée en V1, on reste sur ce modèle simple en MVP. Les autres utilisateurs voient l'onglet désactivé avec un bouton "Demander l'accès" qui envoie une notification à l'Owner.

**Sous-section A — Contrat architecte.** Modélise le contrat d'honoraires signé avec la MOA.

- En-tête : MOA (depuis annuaire), date de signature, **mode de facturation** (forfait HT / % d'enveloppe travaux / mixte), montant HT total, % du marché de référence (calcul auto vs marché travaux estimé), TVA, délai de paiement.
- **Liste de missions 100% libre** : l'archi crée ses missions de zéro. Pour chaque mission : libellé (texte libre — ex. « ESQ », « Études préliminaires », « Direction de chantier » ou tout autre intitulé), montant HT ou **% du total honoraires**, ordre.
- *Note pour le brief Claude Code* : prévoir en V1 un **bouton "Insérer modèle loi MOP"** qui injecte la liste standard ESQ/APS/APD/PRO/ACT/VISA/DET/AOR/EXE/OPC avec % par défaut, mais c'est optionnel et désactivable.
- Bouton "Réordonner" (drag-and-drop).
- Total dynamique recalculé en bas. Assertion bloquante : Σ % missions = 100% (ou Σ montants = total).
- Stockage du contrat signé (PDF), versionnement, signature électronique via Yousign/DocuSign.
- Statut : *brouillon* → *à signer* → *signé* → *en exécution* → *clos*.

**Sous-section B — Situations d'honoraires.** Permet de facturer l'avancement de chaque mission. Logique parallèle aux CP entreprises mais simplifiée.

- Pour chaque mission, possibilité d'émettre une **situation d'honoraires** : % d'avancement (slider 0 → 100), calcul du montant ventilé.
- **Cumul par mission** : on peut émettre N situations sur une même mission (ex. ESQ : 50% à la signature → cumul situation 1 = 50%, puis 100% à la livraison phase → cumul situation 2 = 100%, donc 2 factures).
- **Cumul global** : vue agrégée toutes missions confondues, % d'avancement global du contrat.
- À chaque situation : calcul net à facturer = (% nouveau − % précédent) × montant mission, + TVA.
- Génération **note d'honoraires PDF** au template agence : références contrat, mention loi du 31/12/1990, ventilation par mission, TVA, mode de paiement, mentions légales.
- Workflow : *brouillon* → *à valider* (Owner) → *signée* (signature électronique optionnelle) → *envoyée MOA* → *payée* (déclaratif).
- Numérotation auto par opération (ex. `NH-RC-2026-007`).
- Liaison avec la comptabilité : exportable en V1 vers Pennylane/Sage en écritures honoraires.

**Vue restituée.**

- Vue *Contrat* : tableau des missions avec colonnes Libellé / % / Montant HT / % avancement / Cumul facturé / Restant à facturer.
- Vue *Situations* : timeline chronologique des notes d'honoraires émises, statut, montants, lien PDF.
- Hero card : 4 chiffres clés (Total contrat HT / Cumul facturé / Restant / % global).

**User stories clés.**

> *Camille (Owner), je crée le contrat d'honoraires sur le projet Résidence Les Cèdres : 6 missions custom (Esquisse, APS, APD, PRO, ACT, DET) avec 8% / 12% / 18% / 22% / 15% / 25% du total. Je signe avec la MOA via DocuSign.*
> *Camille, à la fin de la phase APS, je glisse le slider à 100% sur la mission APS, le système calcule la situation d'honoraires (12% × total), je génère la note PDF, j'envoie pour signature et facturation.*
> *Camille, j'invite ponctuellement Nathalie à voir le module Honoraires pour qu'elle puisse préparer les notes (mais pas Sébastien qui n'a pas besoin).*

### Module 10 — Trésorerie agence (Cockpit) — NOUVEAU v0.2

**Objectif.** Donner au patron une vision en temps réel de la trésorerie de l'agence, en agrégeant le compte bancaire pro, les charges récurrentes, les encaissements honoraires et les facturations électroniques. *Le but est de remplacer l'Excel "Trésorerie agence" que tient le patron tous les mois.*

**Accès restreint.** Comme le module 9 : Owner / Admin par défaut, autorisations ponctuelles via `CockpitAccessGrant`.

**Sous-section A — Connexion bancaire (DSP2 / Open Banking).**

- Connexion d'un ou plusieurs comptes bancaires pro via **Bridge** ou **Powens** (agrégateurs DSP2 certifiés ACPR).
- Lecture seule : soldes, transactions, libellés, dates. Pas d'opérations de paiement initialement.
- Catégorisation automatique des transactions (libellé + montant + récurrence → catégorie). Confirmation humaine sur les premières occurrences.
- Réconciliation automatique : un paiement entrant qui matche une note d'honoraires (par montant + libellé contenant n° NH) est rapproché. Statut de la note passe à *payée*.
- Multi-banques supporté (compte courant pro, livret pro, compte épargne).
- Refresh quotidien automatique + manuel (bouton « Synchroniser maintenant »).

**Sous-section B — Charges récurrentes.**

Saisie structurée des charges fixes de l'agence pour modéliser le cash flow.

- Catégories par défaut : *Salaires*, *Charges sociales*, *Loyer bureau*, *Véhicules* (leasing, carburant, assurance), *Logiciels & abonnements*, *Téléphonie & internet*, *Comptable / juridique*, *Assurances pro*, *Autres*. Personnalisable.
- Pour chaque charge : libellé, catégorie, montant HT, TVA, **récurrence** (mensuel / trimestriel / annuel / ponctuel), date de prochain prélèvement, fournisseur (lien optionnel vers annuaire), document associé (facture fournisseur PDF).
- Auto-détection des charges récurrentes depuis les transactions bancaires : si un même libellé revient 3 mois consécutifs avec le même montant, propose de le passer en charge récurrente.
- Vue calendrier mensuel : agenda de toutes les sorties prévues.
- Total charges fixes mensuelles affiché en hero card.

**Sous-section C — Cash flow prévisionnel.**

- Projection mensuelle sur 6 mois glissants : entrées prévisionnelles (basées sur l'avancement des chantiers et les notes d'honoraires à venir) − sorties prévisionnelles (charges récurrentes + ponctuelles connues).
- Affichage graphique : barres mensuelles (entrées vs sorties) + ligne de solde projeté.
- **Alertes anti-découvert** : si le solde projeté passe sous un seuil paramétrable (ex. 10 k€), notification.
- Scenarios "what-if" V1 (et si je n'encaisse pas X note ? et si j'embauche dans 3 mois ?).

**Sous-section D — Rapprochement bancaire & TVA déductible.**

*Le pain n°1 du patron PME : tous les mois en réunion compta, on s'aperçoit qu'il manque la facture du resto client, du carburant, de l'achat Amazon… La TVA déductible part en fumée et la compta facture du temps à chercher.* Architask automatise cette boucle.

- **Détection automatique des dépenses pro sans facture jointe.** Pour chaque transaction bancaire sortante > 5 € HT, l'app vérifie via l'API Pennylane si une facture (justificatif) est déjà attachée à la dépense côté Pennylane. Si non → la dépense est listée dans **« À rapprocher »**.
- **4 canaux de capture** pour attacher la facture manquante :
  1. **Inbox "À rapprocher"** — page dédiée listant toutes les dépenses sans facture, avec drop-zone par dépense pour glisser un PDF / image. Tri par date, montant, catégorie.
  2. **Photo mobile (iPad/téléphone)** — bouton appareil photo dans l'app. L'utilisateur prend le reçu en photo (sur un parking, à la sortie d'un resto, sur le terrain). OCR Claude Vision extrait montant TTC, date, fournisseur, taux TVA, montant TVA. Suggestion automatique de la dépense bancaire correspondante (match montant + date ±7j).
  3. **Upload PDF / image** — drag-and-drop classique depuis le bureau.
  4. **Récupération depuis Pennylane** — si la facture a déjà été uploadée dans Pennylane (par le comptable ou via l'app Pennylane Inbox), l'app la récupère automatiquement et l'attache à la dépense Architask. Synchronisation bidirectionnelle.
- **Calcul TVA automatique.** Pour chaque facture attachée :
  - Détection du taux TVA (5,5 % / 10 % / 20 %) via OCR ou import Pennylane.
  - Calcul montant TVA déductible : si la dépense est marquée comme **professionnelle déductible** (catégorie auto), la TVA est ajoutée à la TVA déductible du mois. Sinon (frais de bouche au-delà de seuils, etc.), elle est marquée non déductible.
  - **Récap mensuel** : total TVA déductible cumulée, à comparer avec la TVA collectée pour calculer la TVA due au Trésor.
- **Writeback Pennylane.** Une fois la facture attachée et la TVA calculée dans Architask, **synchronisation vers Pennylane** : la dépense Pennylane se met à jour avec la pièce justificative + les écritures TVA. Plus jamais de double saisie.
- **Notifications.**
  - Badge sur l'item Cockpit dans la sidebar avec compteur de dépenses à rapprocher.
  - **Email digest hebdomadaire** (lundi matin) : « 12 dépenses sans facture cette semaine · 318 € de TVA récupérable potentielle ».
  - Alerte si dépense > 100 € HT sans facture depuis > 30 jours (échéance fiscale critique).
- **Suggestions intelligentes.** Pour chaque dépense, l'app propose :
  - Si une facture Pennylane existe avec montant ± 5 % et date ± 7 j → match probable, validation en 1 clic.
  - Si plusieurs candidates → liste à choisir.
  - Sinon → invite à uploader/photographier/forwarder.

**User stories clés.**

> *Camille (Owner), tous les lundis matins je reçois un mail "12 dépenses à rapprocher cette semaine, 318 € de TVA potentielle". Je clique, j'ouvre l'inbox du Cockpit, et je traite en 5 min.*
> *Camille au resto avec un client le mardi midi : je prends le ticket en photo dans l'app après le paiement. L'OCR détecte 64,80 € TTC, 5,40 € TVA 10 %, "Le Petit Bistrot". L'app rapproche automatiquement avec la dépense CB 64,80 € sur ma banque, attache la photo, et envoie le tout à Pennylane.*
> *Nathalie (avec grant Cockpit), elle voit dans Pennylane qu'une facture du fournisseur "Castorama" est arrivée — elle existe déjà côté Pennylane. Quand je rentre dans Architask et que je vois la dépense CB 240 € de la semaine dernière, l'app me propose : "Une facture Castorama 240 € existe dans Pennylane — l'attacher ?" Je clique oui, rapproché.*

**Sous-section E — Facturation électronique (Factur-X).**

Conforme à l'obligation française e-invoicing 2026-2027.

- **L'agence connecte sa PDP** (Plateforme de Dématérialisation Partenaire) : choix parmi Pennylane, Sage, Generix, Esker, ou d'autres certifiées DGFiP. *Architask reste éditeur de logiciel, pas PDP.*
- Toutes les **notes d'honoraires** (module 9) générées sont automatiquement transmises au format **Factur-X** (XML structuré + PDF visualisable) via la PDP de l'agence.
- Réception via PDP : les factures fournisseurs entrantes (charges agence) sont reçues en Factur-X depuis la PDP et apparaissent automatiquement dans la liste des charges, en attente de validation.
- Statut e-invoicing visible sur chaque note d'honoraires : *envoyée à PDP* → *transmise MOA* → *acceptée* → *payée*.
- Synchronisation des écritures comptables avec Pennylane (si PDP = Pennylane, intégration directe ; sinon, export FEC en V1).

**User stories clés.**

> *Camille (Owner), le lundi matin j'ouvre Cockpit → Trésorerie. Je vois le solde de mes 2 comptes pro (84 k€ et 23 k€), les 3 prélèvements à venir cette semaine (12,4 k€), et la projection : je serai à 67 k€ fin du mois. Bon.*
> *Camille, je vois qu'un virement de 8 640 € est entré → l'app a déjà rapproché avec la note d'honoraires NH-RC-2026-003 et marqué la note comme payée. Je n'ai rien à faire.*
> *Camille, j'embauche un collaborateur à 3 200 € net/mois. Je le saisis dans Charges récurrentes → le cash flow prévisionnel se recalcule, et l'app me prévient que je passerai sous 5 k€ en septembre si je ne signe pas le contrat Bureaux Rive Gauche d'ici juillet.*

**Hors scope MVP — V1+.**

- Paiement initié depuis l'app (PIS — Payment Initiation Service DSP2).
- Bilan / compte de résultat / liasse fiscale.
- Rapprochement bancaire comptable avancé (V1).
- Multi-devises (V2).
- Scenarios "what-if" sophistiqués (V1).

### Synthèse fonctions hors MVP (V1+)

- Export comptable FEC, Pennylane, Sage (V1)
- Gantt avancé : dépendances, chemin critique, ressources (V1)
- Courbe en S financière sur planning (V1)
- Modèles type loi MOP injectables (V1 — bouton "Insérer modèle MOP")
- Matrice de permissions granulaire multi-rôles (V1)
- App mobile native iOS/Android (V2 — MVP en PWA mobile + iPad optimisée)
- Marché public CCAG Travaux (V2)
- Temps passés collaborateurs (V2)
- Suivi commercial / pipeline projets (V2)

## 6. Règles métier & conformité NF P03-001

Le MVP se limite au **marché privé**, norme NF P03-001. Câblage par défaut :

| Règle | Valeur par défaut | Paramétrable |
|---|---|---|
| Taux retenue garantie | 5 % | Oui (au lot) |
| Plafond retenue | 5 % du marché | Oui |
| Libération retenue | 1 an après réception | Oui |
| Caution bancaire substitutive (RBQS) | Possible | Oui |
| Délai paiement légal | 30 j fin de mois | Oui (au lot) |
| Révision de prix | Formule BT01 par défaut | Oui (formule libre) |
| Pénalités retard | 1/1000 marché / jour ouvré | Oui |
| TVA standard | 20 % | Oui (10 % rénovation, etc.) |
| Seuil alerte avenants | 15 % du marché initial | Oui |
| **Assurance décennale obligatoire** | **Bloquante à la signature marché** | Non (toujours bloquante) |
| **Seuil alerte expiration décennale** | **60 j avant** | Oui |

**Mentions légales obligatoires sur CP/DGD** : références marché, identification parties, n° et date, montants HT/TVA/TTC, retenue, net à payer, modalités et délai paiement, recours en cas de litige.

**Cohérence numérique.** Tous les montants à 2 décimales, arrondi au centime supérieur. Σ CP ≤ marché révisé + travaux suppl. acceptés (assertion bloquante côté serveur).

## 7. Modèle de données

### Entités principales (MVP v0.2)

```
Organization (agence d'archi)
  ├── Users (Camille, Sébastien, Nathalie…) — rôles : owner, admin, member, viewer
  ├── Stakeholders (annuaire central)
  │     ├── Companies (entreprises)
  │     │     ├── Insurances[] (décennale, RC pro, GPA — versionnées avec validité)
  │     │     ├── Contacts[] (multi-contacts par entreprise)
  │     │     └── Documents[] (Kbis, RIB, attestations)
  │     └── Owners/MOA (maîtres d'ouvrage)
  │           └── Contacts[]
  └── Operations (chantiers)
        ├── Stakeholders rattachés (MOA, MOE complémentaires, BET)
        ├── HonoraireContract (1:1 avec Operation, accès restreint)
        │     ├── Missions[] (libellé libre, % ou montant)
        │     └── HonoraireSituations[] (par mission, cumul, factures NH)
        ├── HonoraireAccessGrant[] (qui voit Honoraires sur cette opération)
        ├── Lots
        │     ├── Marché (entreprise FK annuaire, montant initial, conditions, décennale_check_at)
        │     ├── Avenants[]
        │     ├── Situations[] (mensuelles, PDF ou Excel, OCR status)
        │     └── CertificatsPaiement[]
        ├── PlanningTasks[] (par lot : début/fin prévu, début/fin réel, jalons)
        ├── Plans[] (PDF/image, pour CR chantier)
        ├── SiteMeetings[] (CR chantier, OPR, livraison)
        │     ├── Observations[] (géolocalisées sur plan, catégorisées)
        │     │     └── Photos[] (avec annotations)
        │     ├── Attendees[]
        │     └── ReportPDF
        ├── Reserves[] (issues OPR, statut, photos avant/après)
        ├── PVReception
        ├── DGD
        ├── Cautions[]
        └── Documents[]
```

### Détail des entités-clés ajoutées en v0.2

**Company**
```
id, organization_id (owner = agence), raison_sociale, siret, forme_juridique,
adresse, logo_url (stocké R2, généré automatiquement depuis initiales + couleur
si non fourni, upload manuel possible),
contacts[], documents[], created_at
```

**Insurance**
```
id, company_id, type (decennale|rc_pro|gpa),
compagnie, num_police, montant_garanti,
date_debut, date_fin, activites_couvertes (tags Qualibat),
attestation_pdf_id, status (valide|expire|expirant_60j)
```

**PlanningTask**
```
id, operation_id, lot_id (nullable si jalon global),
type (lot|jalon), libelle,
date_debut_prevue, date_fin_prevue, date_debut_reelle, date_fin_reelle,
statut, milestone_kind (os|reception|dgd|libere_retenue|null)
```

**SiteMeeting (CR de chantier)**
```
id, operation_id, type (cr_chantier|opr|livraison|visite_libre),
date, lieu, attendees[], present_by_invitation[],
ordre_du_jour, observations[], generated_pdf_id, signed_pdf_id,
created_by, created_at
```

**Observation**
```
id, site_meeting_id, plan_id (nullable), x_pct, y_pct,
categorie (defaut|demande_info|validation|securite|reserve_opr),
description, assigned_to_company_id, assigned_to_user_id,
echeance, statut (ouvert|en_cours|resolu|leve),
photos[], lot_id (nullable), priority
```

**Photo**
```
id, observation_id (nullable), site_meeting_id,
url, thumbnail_url, annotations_json,
exif_taken_at, gps_coordinates
```

**Reserve** (cas particulier d'observation à la réception)
```
id, operation_id, lot_id, observation_id (origine),
description, statut (a_lever|en_cours|levee),
date_releve, date_levee, photo_avant_id, photo_apres_id
```

**HonoraireContract** (1:1 avec Operation, accès restreint)
```
id, operation_id (unique), moa_id (FK annuaire),
date_signature, mode_facturation (forfait|pct_travaux|mixte),
montant_total_ht, taux_tva, delai_paiement_jours,
marche_reference_ht (snapshot pour calcul % vs travaux),
signed_pdf_id, statut (brouillon|a_signer|signe|en_execution|clos),
created_by, created_at
```

**HonoraireMission** (listée librement par l'archi — pas d'enum)
```
id, contract_id, libelle (texte libre — ex. "ESQ", "Études préliminaires",
                          "Direction de chantier"...),
ordre, type_valeur (pct|montant),
pct_du_total (si type pct), montant_ht (si type montant),
montant_calcule (cache), pct_avancement_courant (0-100),
description (optionnel)
```

**HonoraireSituation** (cumul possible par mission)
```
id, contract_id, mission_id, numero (auto par contrat — ex. NH-RC-2026-007),
date_emission, pct_avancement_nouveau, pct_avancement_precedent,
montant_ht (delta à facturer), montant_tva, montant_ttc,
statut (brouillon|a_valider|signee|envoyee|payee),
generated_pdf_id, signed_pdf_id, sent_at, paid_at,
created_by
```

**HonoraireAccessGrant** (qui peut voir le module Honoraires)
```
id, organization_id, user_id, scope (global|operation),
operation_id (nullable si scope=global),
granted_by_user_id, granted_at, revoked_at (nullable)
```

Validation transversale métier (rappel) :
- Sur sauvegarde CP, `Σ CP ≤ marché révisé + travaux suppl. acceptés`.
- Sur signature marché, `insurance.decennale.valide à date(operation.date_os)` ET `activite_lot ∈ insurance.activites_couvertes`.
- Sur signature contrat honoraires, `Σ pct_du_total des missions = 100%` (si type pct) ou `Σ montant_ht missions = montant_total_ht` (si type montant).
- Sur sauvegarde HonoraireSituation, `pct_avancement_nouveau ≥ pct_avancement_precedent` (pas de retour en arrière).
- Accès module Honoraires : autorisé si `user.role ∈ {owner, admin}` OU `exists(HonoraireAccessGrant valide pour user+op)`.

## 8. Parcours utilisateurs clés

### Parcours 1 — Démarrer un nouveau chantier (onboarding chantier, ~15 min)

1. Sébastien crée l'opération « Résidence Les Cèdres », sélectionne la MOA dans l'annuaire (ou la crée si nouvelle), saisit adresse + dates clés (2 min).
2. Il définit les 8 lots depuis bibliothèque type (1 min).
3. Pour chaque lot, il sélectionne l'entreprise titulaire dans l'annuaire — **si une décennale est manquante ou expirée, le marché ne peut pas passer en signé** (1 min).
4. **Import DPGF — choix utilisateur** :
   - 6 lots reçus en PDF → drag-and-drop dans la zone d'import, l'**OCR + IA** extrait postes/PU/montant en 10-30 s par lot. Sébastien parcourt les lignes pré-remplies, corrige 2-3 valeurs où la confiance est < 80 %.
   - 2 lots reçus en Excel → drag-and-drop, auto-mapping colonnes, validation rapide.
5. Il upload les marchés signés en PDF (drag-and-drop multi-fichiers).
6. **Génération automatique du planning Gantt** initial : barres prévues par lot étirées entre les dates contractuelles. Sébastien ajuste 1-2 barres au pifomètre des durées entreprises.
7. ✅ Opération prête.

**Temps total : ~15 min** vs 2-3 h sur process actuel.

### Parcours 2 — Émission d'un CP mensuel (situation PDF reçue)

1. Nathalie reçoit la situation du lot Gros Œuvre par e-mail (PDF de l'entreprise).
2. Elle ouvre le lot dans Architask, glisse le PDF dans la zone « Nouvelle situation ».
3. **L'OCR + IA (Claude Vision) lit le tableau d'avancement en 10-15 s** : pour chaque poste, il extrait quantité exécutée, % avancement, montant cumulé. La confiance par poste est affichée (badge vert ≥ 95 %, orange 70-95 %, rouge < 70 %).
4. Nathalie parcourt rapidement, corrige 1 valeur orange.
5. Elle clique « Générer CP n°7 » → calcul auto retenue + révision + TVA, prévisualisation PDF (3 s).
6. Elle envoie à Camille pour validation (notif mobile).
7. Camille reçoit la notif entre 2 RDV, ouvre, vérifie, signe (Yousign **ou** DocuSign selon ce qui est configuré pour l'agence) en 1 min.
8. Le CP signé est envoyé automatiquement à l'entreprise (e-mail + PDF + lien d'accusé de réception).

**Temps total : 4 minutes** vs 25-40 min actuellement.

### Parcours 3 — Réception de chantier sur iPad

1. Camille ouvre l'opération sur iPad sur site, déclenche « Démarrer OPR ».
2. Elle pointe les présents (depuis annuaire), démarre.
3. Pour chaque défaut constaté :
   - Tap sur le plan PDF pour positionner.
   - Tap photo, annote (flèche, croix).
   - Dicte la description en voix (iOS natif).
   - Assigne au lot et à l'entreprise concernée.
4. À la fin, elle clique « Générer PV de réception ». Le PV est rempli avec les réserves catégorisées par lot, les photos annotées, le plan annoté.
5. Envoi pour signature aux 3 parties (MOA / MOE / entreprises) — Yousign ou DocuSign.
6. Le chantier passe automatiquement en phase « réception ». Une alerte est programmée à J+335 pour la libération de retenue.

### Parcours 4 — Réunion de chantier hebdomadaire sur iPad (style Archipad)

1. Sébastien arrive sur le chantier avec son iPad. Il ouvre Architask, sélectionne l'opération, clique « Démarrer réunion de chantier ».
2. **Préparation auto** : l'app reprend les observations non-résolues du précédent CR comme ordre du jour, et la liste des entreprises invitées via l'annuaire.
3. Il pointe les présents (présents / excusés / absents) via une liste tactile.
4. Au fil de la visite, sur le **plan PDF** zoomable :
   - Tap pour ajouter une observation à un endroit précis.
   - Catégorise (défaut, demande d'info, validation, sécurité).
   - Ajoute photos (annotations possibles directement : flèches, ronds, texte).
   - **Dicte** la description vocalement (iOS natif).
   - Assigne à l'entreprise, fixe une échéance.
5. Une observation jugée « hors marché » peut être **convertie en avenant** en 1 tap — un brouillon d'avenant est créé en arrière-plan pour le lot concerné.
6. À la fin de la visite, Sébastien clique « Générer le CR ». Le PDF brandé agence est généré : page de garde avec présents et excusés, ordre du jour, observations par catégorie avec plan annoté + photos + assignations, suivi des points précédents.
7. **Envoi automatique** aux présents/excusés + tous les contacts entreprises rattachés. Option : envoi en signature.
8. **Mode hors-ligne** : si pas de connexion sur le chantier, toutes les actions sont stockées en local et se synchronisent à la reconnexion.

**Temps gagné** : ~2 h de rédaction de CR le soir → CR prêt en quittant le chantier.

### Parcours 5 — Préparation réunion COPIL MOA

1. Sébastien ouvre l'opération, vue récap général.
2. Clique « Export PDF pilotage ». Document propre : récap financier par lot, courbes d'avancement, planning Gantt actuel, principaux points en cours, dérive avenants.
3. Envoie à la MOA depuis l'app.

### Parcours 6 — Configurer le contrat d'honoraires (réservé Owner)

1. Camille (Owner) ouvre l'opération Résidence Les Cèdres et clique sur l'onglet **Honoraires** (visible pour elle uniquement par défaut).
2. Section **Contrat architecte** : elle sélectionne la MOA dans l'annuaire, saisit le montant total HT (96 000 €), choisit *mode forfait*, délai 30 j.
3. Elle ajoute les missions en **liste 100% libre** : "Esquisse" (8 %), "APS" (12 %), "APD" (18 %), "PRO" (22 %), "ACT" (15 %), "DET chantier" (25 %). Le système vérifie Σ = 100 %, recalcule les montants par mission en live.
4. Elle upload le contrat signé PDF, statut → *signé*.
5. Elle invite ponctuellement Nathalie en lecture sur cet onglet (action : *Donner accès à un utilisateur* depuis le menu de l'onglet).

### Parcours 7 — Émettre une situation d'honoraires

1. À la fin de la phase APS, Camille ouvre l'onglet Honoraires → section **Situations**.
2. Sur la ligne mission "APS" : avancement courant 0 %, elle glisse le slider à 100 %.
3. Le système calcule : (100 − 0) % × 12 % × 96 000 € = **11 520 € HT**, + TVA 20 % = 13 824 € TTC.
4. Elle clique "Générer note d'honoraires PDF" → numérotation auto `NH-RC-2026-001`, template brandé.
5. Elle envoie à la MOA pour signature (Yousign/DocuSign selon agence).
6. Plus tard : sur PRO, elle peut émettre 50 % en cours de phase, puis 50 % à la livraison → **2 situations cumulatives** sur la même mission. Le système empêche tout retour en arrière sur le % cumulé.

### Parcours 8 — Vue Honoraires AGENCE (pilotage global)

Le module 9 a deux entrées distinctes :

- *Par opération* : onglet « Honoraires » à l'intérieur de chaque opération (cf. Parcours 6-7).
- *Globale agence* : route `/honoraires` accessible depuis la **sidebar de navigation** (avec icône cadenas indiquant l'accès restreint). Vue agrégée sur tous les chantiers actifs.

**Contenu de la vue agence.**

1. **4 KPI hero** : Total contrats actifs HT, Cumul facturé YTD (year-to-date) avec variation vs N−1, À facturer ce mois (sommes des avancements attendus selon planning), En attente paiement MOA (cumul des notes signées non payées).
2. **Pipeline de facturation** (3 cards horizontales) :
   - *À émettre cette semaine* — nombre de missions dont l'avancement réel dépasse le % facturé courant.
   - *En attente signature MOA* — notes émises non encore signées.
   - *En attente paiement MOA* — notes signées non encore payées (avec total et MOA en retard).
3. **Tableau Contrats par opération** : ligne par opération avec MOA, total contrat HT, cumul facturé, % avancement, statut, sparkline mensuelle des facturations.
4. **Activité récente** : 10 dernières notes d'honoraires émises toutes opérations confondues, lien direct vers la note.
5. **Action principale** : bouton « + Nouvelle note d'honoraires » qui demande d'abord l'opération puis bascule sur le flow de création.

**Règles d'accès.** Identiques au Parcours 6 : Owner / Admin par défaut, ou utilisateur avec `HonoraireAccessGrant` valide. Pour un grant *scope=global*, la vue agence est entièrement visible. Pour un grant *scope=operation*, la vue agence affiche **uniquement** les opérations concernées (filtrage automatique côté serveur).

**User story.**

> *Camille (Owner), tous les lundis matin je veux voir en 10 secondes : combien me reste-t-il à facturer ce mois sur tous mes chantiers, qui me doit de l'argent depuis trop longtemps, et quelles notes je dois faire signer.*

## 9. Direction UI/UX (Apple/Revolut + références fintech mobile premium)

### Références visuelles (cap UI v0.2)

Arthur a partagé 3 références qui posent la barre du style attendu (fintech / lifestyle mobile premium 2025-2026) :

1. **App mobile "Good morning"** — big bold typography (titre 56-72px), tabs en pill blanche sur fond gris très clair, dégradé doux rouge→violet→bleu sur la courbe, **tooltip noir flottant** sur le pic du graphe ("632" sur le mois Jun), gros chiffre 1,930 à droite avec libellé fin en dessous, bottom-nav iconographique minimaliste.
2. **Cards stats "Insights / Conversion / ROI"** — **chiffres énormes** (75% / 120% / 270%) avec flèche ↗ stylisée à côté, mini-graphes très épurés (ligne rouge, courbe bleue gradient, donut gris), texte explicatif fin en gris en bas, FAB rond avec flèche, pagination par dots.
3. **Dashboard mix "Sales statistics / Current balance / Market forecast"** — **mix de cards de couleurs** : une card NOIRE avec bars colorées vert mint/violet, une card MINT GREEN avec donut épais et big number 15 368$, une card LILAC avec timeline verticale, des courbes en accent (vert mint + violet pastel), border-radius très généreux partout.

### Traduction en règles design Architask

1. **Big bold typography sur tous les chiffres clés.** KPI affichés en **56-72px**, poids 700, letter-spacing négatif (−0.02 à −0.03em). Le libellé est fin et gris, en arrière-plan. *Le chiffre est le héros, pas l'icône*.
2. **Cards très arrondies.** Border-radius **24-32px** pour les cards principales (vs 14px en v0.1), 14-16px pour les éléments imbriqués. C'est un signal premium immédiat.
3. **Mix de cards de couleurs, pas que blanc.** Sur chaque écran principal, alterner :
   - Cards blanches (neutre, contenu textuel)
   - 1-2 cards NOIRES (le hero, l'info clé, accent)
   - 1-2 cards MINT GREEN (`#B8F2D1` → `#DCFCE7`) pour positif / valide / succès
   - 1 card LILAC (`#DDD6FE` → `#EDE9FE`) pour data secondaire / forecasts
4. **Dégradés doux sur les courbes** plutôt que lignes plates. Gradients rouge→violet→bleu, ou vert→bleu, ou mono-couleur avec area-fill en dégradé.
5. **Tooltips noirs flottants** sur les graphes (pill noire avec texte blanc) — pas les tooltips de Recharts par défaut.
6. **Flèches ↗ stylisées** systématiques sur les variations (success/danger color).
7. **Tabs en pill** : container gris clair (`var(--surface-2)`) avec inner-pills blanches portant shadow douce. Style segmented Apple.
8. **FAB / boutons primaires noirs** (`var(--text-primary)`) plutôt que de toujours utiliser la couleur brand bleue. Le noir lit comme premium et neutre.
9. **Whitespace radical.** Padding interne des cards 24-32px, gaps inter-sections 32-40px. *On accepte de scroller davantage en échange de la lisibilité*.
10. **Animations utiles uniquement** (transitions 120-240ms ease-out). Pas d'effets gratuits.

### Principes fondateurs

1. **Élégance d'abord.** L'utilisateur doit avoir envie d'ouvrir l'app le matin. Verre dépoli, micro-typo soignée, gros chiffres, blancs généreux, courbes douces.
2. **Densité maîtrisée.** Beaucoup d'info, respirante. Hiérarchie visuelle forte : Display > H1 > body > label.
3. **Tout est card.** Chaque entité est une carte cliquable, drillable.
4. **Mobile/iPad first-class.** Le CR de chantier (module 8) est conçu d'abord pour iPad ; le dashboard et la consultation marchent sur téléphone.
5. **Clavier-first** sur desktop — command palette `Cmd+K` partout (Linear).
6. **Animations utiles, jamais décoratives** — 150-250ms, courbes ease-out, jamais de bounce.
7. **Mode sombre soigné** dès le MVP, pas un afterthought.

### Design tokens (proposition stable v0.2)

**Couleurs — Light mode**

- `--bg-base : #FAFAFA` (gris neutre Apple-like), `--surface : #FFFFFF`, élévations ombres très douces.
- `--text-primary : #0B0B0F`, `--text-secondary : #5F6675`, `--text-tertiary : #9AA0AB`.
- `--brand : #1F2DEA` (bleu profond), `--brand-soft : #EEF0FF`.
- Sémantique : `--success : #16A34A`, `--warning : #F59E0B`, `--danger : #DC2626`, `--info : #0EA5E9`.
- Bordure : `--border : rgba(11,11,15,0.06)`, `--border-strong : rgba(11,11,15,0.12)`.

**Couleurs — Dark mode**

- `--bg-base : #0A0B0E`, `--surface : #16181D`, élévations par opacité (verre dépoli).
- `--text-primary : #F4F5F7`, `--text-secondary : #A8AEBC`.
- `--brand : #4F5DFF` (plus clair en dark).

**Typographie** — `Inter` (variable) ou `Söhne` si budget licence. Tabular nums obligatoires sur tous montants. Tailles :

- Display L : 40 / 48
- Display S : 32 / 40
- H1 : 24 / 32 (semibold)
- H2 : 20 / 28 (semibold)
- Body : 14 / 22 (regular)
- Label : 12 / 16 (medium, tracking +0.4)

**Espacements** : grille 4 px (4/8/12/16/24/32/48/64). Radius : 6 (small), 10 (medium), 14 (large), 24 (card hero).

**Ombres** : `0 1px 2px rgba(0,0,0,0.04)` (élév 1), `0 8px 24px rgba(0,0,0,0.06)` (élév 2). Pas de noir saturé.

**Mouvement** : durées 120 / 180 / 240 ms. Easing `cubic-bezier(0.2, 0, 0, 1)` (ease-out Apple).

### Composants clés à industrialiser dès MVP

- *KPI Card* : grand chiffre tabular, libellé, variation, sparkline.
- *Tableau financier* : colonnes droites pour montants, tabular nums, totaux pinnés, sticky header.
- *Drawer* (panneau latéral) — préféré aux modales pour les édits longs (création lot, édition CP).
- *Stepper* — création opération en 3 étapes.
- *Status pill* — pastille colorée pour statuts.
- *File drop zone* (différenciée par mode : Excel, PDF, Plan).
- *OCR Validation Card* — chaque poste extrait avec badge de confiance, possibilité de corriger.
- *Command palette* (Cmd+K).
- *Plan viewer* — composant central iPad : zoom fluide, pan, ajout d'observations par tap.
- *Observation pin* — point coloré par catégorie, drawer à l'ouverture.
- *Annotation overlay* sur photo — flèches, croix, texte.
- *Gantt component* — barres prévues vs réelles, jalons en losange, drag pour redimensionner.

### Architecture d'écrans MVP

```
/                              ← Dashboard agence
/operations                    ← Liste opérations
/operations/:id                ← Récap général d'une opération
/operations/:id/lots/:lotId    ← Détail lot
/operations/:id/cps            ← Liste CP
/operations/:id/planning       ← Gantt opération
/operations/:id/cr-chantier    ← Liste CR / OPR
/operations/:id/cr-chantier/:meetingId ← Édition CR (mode iPad)
/operations/:id/honoraires     ← Onglet Honoraires (accès restreint)
/operations/:id/dgd            ← Synthèse DGD
/operations/:id/reception      ← PV récep + réserves
/operations/:id/documents      ← Pièces du marché
/annuaire                      ← Annuaire (Entreprises + MOA)
/annuaire/entreprise/:id       ← Fiche entreprise (avec décennale, RC pro)
/annuaire/moa/:id              ← Fiche MOA
/cockpit                       ← Cockpit (espace Owner, accès restreint)
/cockpit/honoraires            ← Honoraires agence (vue globale)
/cockpit/tresorerie            ← Trésorerie agence (banque, charges, cash flow)
/cockpit/rapprochement         ← Rapprochement bancaire + TVA déductible
/cockpit/facturation           ← Facturation électronique (Factur-X via PDP)
/inbox                         ← Tâches à faire
/agence                        ← Paramètres agence (utilisateurs, templates, branding, lots types, choix signature, PDP, banque)
/profil
```

### 4 écrans phares (à maquetter en priorité)

1. **Dashboard agence** — header sobre, ligne de 4 KPI cards (chantiers actifs, CP en attente, CA en cours, dérive moyenne avenants), liste « À faire aujourd'hui », table des 5 chantiers les plus actifs.
2. **Récap général d'une opération** — banner avec gros chiffres (marché révisé / cumul CP / avancement %), graph donut par lot, tableau lot-par-lot avec sparklines, mini-Gantt.
3. **Création d'un CP** — drawer 3 étapes : import situation (PDF avec OCR ou Excel ou manuel) → vérification poste-par-poste avec badges de confiance → prévisualisation PDF + envoi signature.
4. **CR de chantier sur iPad** — vue plein écran iPad : plan PDF au centre, palette d'outils à gauche (catégories observations), panneau d'observations à droite, en haut barre de statut « réunion en cours », bouton « Terminer & générer CR ».

## 10. Stack technique & intégrations

### Stack recommandée (optimisée pour vibe coding + Claude Code)

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework full-stack | **Next.js 15** (App Router, RSC) | Mainstream, support Claude Code excellent, Vercel zéro friction |
| Langage | **TypeScript** strict | Sécurité métier critique (calculs financiers) |
| UI | **Tailwind v4 + shadcn/ui + Radix** | Composants headless prod-ready, custom design system Apple/Revolut |
| Animations | **Framer Motion** | Micro-interactions, transitions soignées |
| Auth | **Clerk** | Multi-org natif, SSO en V1 |
| DB | **Postgres** (Neon) | Relationnel — essentiel intégrité métier |
| ORM | **Drizzle** | Type-safe, migrations propres |
| Stockage fichiers | **Cloudflare R2** (S3-compatible) | PDF, plans, photos, attestations |
| Génération PDF | **react-pdf** + templates HTML alternatifs (Puppeteer) | Templates brandés, rendu pixel-perfect |
| Import Excel | **SheetJS (xlsx)** | Robuste |
| **OCR/IA extraction** | **Claude Vision API** (anthropic) + fallback Mistral OCR | Lecture DPGF et situations PDF, structure JSON typée |
| **Plan viewer / annotation** | **PDF.js** + Konva.js (canvas) | Annotation tactile iPad, observation pins |
| **Signature électronique** | **Pluggable** : Yousign **et** DocuSign | Choix par agence selon abonnement existant |
| **Bank connect DSP2** | **Bridge** (par défaut) ou Powens | Agrégateur certifié ACPR, comptes pro EU |
| **PDP Factur-X** | Pluggable : **Pennylane** par défaut, Sage, Esker, Generix | L'agence choisit/branche sa PDP existante |
| Envoi e-mail | **Resend** | DX excellente, templates React |
| Paiement SaaS | **Stripe Billing** | Standard, TVA EU |
| Observabilité | **Sentry + Vercel Analytics** | Standard |
| Jobs async | **Trigger.dev** | Imports lourds, OCR batch, alertes planifiées |
| Hosting | Vercel + Neon + R2 | Tout managé EU |

### Architecture de la couche signature électronique

Une **interface unique** `SignatureProvider` avec deux implémentations (`YousignProvider`, `DocusignProvider`). L'agence configure dans `/agence` quel provider utiliser (et y dépose ses clés API personnelles si elle a son propre abonnement). Le code applicatif appelle toujours `signatureProvider.createSignatureRequest(...)`. Webhooks unifiés.

### Hébergement, sécurité, RGPD

- Hébergement données EU (Neon EU region, R2 EU).
- Chiffrement at-rest + TLS 1.3 in-transit.
- Logs d'audit sur toutes actions financières et CR.
- RGPD : DPA tous fournisseurs OK, registre des traitements.
- Sauvegarde PITR Neon 7j + exports quotidiens R2.
- Stockage photos chantier en EU (R2), respect du droit à l'image dans CR (mentions).

### Intégrations MVP / V1

| Intégration | Phase | Détail |
|---|---|---|
| Import Excel DPGF/situations | MVP | SheetJS, auto-detect colonnes |
| **OCR/IA PDF (DPGF, situations)** | **MVP** | **Claude Vision API, JSON structuré, validation poste-par-poste** |
| Génération PDF brandée | MVP | Templates HTML (CP, situation, DGD, PV récep, avenant, CR chantier, planning) |
| **Yousign + DocuSign** | **MVP** | **Pluggable selon agence** |
| Resend (envoi e-mails) | MVP | E-mails transactionnels et CR |
| Export comptable Pennylane | V1 | API |
| Export FEC (Sage/EBP) | V1 | Fichier conforme |
| Calendrier (iCal export) | V1 | Jalons planning exportables |
| API publique | V2 | REST documentée |

## 11. Pricing & go-to-market

### Stratégie : 3 plans verrouillés (B + placement C)

Inspirée de la mécanique Linear / Notion / Figma : 3 plans clairs, sans options à la carte, upgrade naturel à mesure que l'agence grandit ou que ses besoins se complexifient.

**Plan Starter — 79 € / utilisateur / mois (HT)**

- Cible : solo et petites agences (3-6 personnes) qui veulent un outil ultra-clean pour la gestion financière de chantier.
- Inclus : modules 1 à 5 + 7 (annuaire). Pas de Gantt avancé, pas de CR chantier.
- Signature électronique limitée (50 documents/mois, Yousign basique seulement).
- 1 brand kit, jusqu'à 3 utilisateurs en lecture gratuits par licence facturée.

**Plan Pro — 119 € / utilisateur / mois (HT) — recommandé** ⭐

- Cible : petites agences 6-15 qui veulent l'expérience complète.
- Inclus : **les 8 modules MVP** dont CR Chantier iPad et Planning Gantt.
- Signature illimitée, **choix Yousign ou DocuSign** (BYOK : tu apportes ton compte si tu en as un).
- Brand kit personnalisable, templates PDF customisables.
- 5 utilisateurs en lecture gratuits par licence.
- Support prioritaire (réponse < 24h).

**Plan Enterprise — sur devis (à partir de 169 €/u/mois HT)**

- Cible : agences 15+ qui veulent SSO, audit avancé, intégrations, support dédié.
- Inclus : Pro + SSO SAML, multi-bureaux, multi-entités juridiques, API publique, exports comptables avancés, formation onboarding, SLA contractuels, CSM dédié, possibilité d'hébergement EU souveraine.

### Comparaison vs marché

- BIM Office : ~100-150 €/u/mois — Architask Pro est dans la fourchette mais avec terrain inclus et UX supérieure.
- Archipad : ~50-90 €/u/mois — Architask Starter est plus cher mais inclut le financier ; Pro est 1.5x plus cher mais remplace BIM Office + Archipad.
- Argument prix clé : **« remplace 2 outils, vous gagnez 30 à 50 % vs facture cumulée ».**

### Essai et incentives

- Essai gratuit 30 jours sur Plan Pro (toutes fonctions).
- 1 chantier de démonstration pré-rempli pour onboarding immédiat.
- Annualisation : −15 % (paiement annuel).
- Parrainage : 3 mois offerts par filleul converti.

### Go-to-market — early stage

1. **Design partners** — 5 à 10 agences (réseau, CROA, ENSA) co-construisent le MVP en 4-6 mois. Tarif préférentiel à vie (50 % de Pro).
2. **Contenu vertical** — newsletter / LinkedIn / YouTube sur la gestion financière et le CR chantier. Sujet techniquement sous-traité par la concurrence.
3. **CROA + écoles d'archi** — partenariat éducatif (gratuit pour écoles d'archi).
4. **Bouche-à-oreille** — programme parrainage cash + mois offerts.
5. **SEO transactionnel** — pages « certificat de paiement », « calcul retenue garantie », « modèle CR de chantier », « PV de réception archi ».
6. **Comparatifs publics** — pages « Architask vs BIM Office », « Architask vs Archipad » (factuels, honnêtes).

## 12. Roadmap MVP → V1 → V2

### MVP — Mois 0 à 5.5 (~22 semaines, objectif : 5 design partners en usage réel)

**Phase 0 — Semaines 1-2 — Foundations + design system**
- Setup Next.js + Clerk + Postgres + Drizzle + Tailwind v4 + shadcn/ui customisé.
- **Design tokens Apple/Revolut figés**, composants de base (Button, Card, Drawer, KPI, Table, Stepper).
- Mode sombre dès J1.
- Modèle de données entités principales.
- Auth multi-org, invitations équipe.

**Phase 1 — Semaines 3-4 — Annuaire (Module 7)**
- CRUD entreprises, MOA, contacts.
- Assurances décennale / RC pro versionnées avec validité.
- Alertes expiration.
- Import initial CSV.

**Phase 2 — Semaines 5-7 — Opérations & Marchés (Module 1) + Import**
- CRUD opération, lots.
- Import DPGF Excel.
- **Import DPGF PDF avec OCR Claude Vision** (le plus risqué techniquement — à attaquer tôt).
- Composant OCR Validation Card.
- Contrôle bloquant décennale à la signature.

**Phase 3 — Semaines 8-9 — Avenants (Module 2) + Moteur calcul CP**
- CRUD avenants.
- **Moteur de calcul CP (retenue, révision, TVA)** — tests unitaires obligatoires couverture > 90 %.
- Génération PDF avenant.

**Phase 4 — Semaines 10-12 — CP (Module 3) + Signature pluggable**
- Saisie/import situation (PDF OCR + Excel + manuel).
- Génération CP PDF brandée.
- **Couche `SignatureProvider` pluggable (Yousign + DocuSign).**
- Envoi e-mail Resend.

**Phase 5 — Semaines 13-14 — Récap & Dashboard (Module 4)**
- Vue récap opération + dashboard agence.
- KPI cards, graphiques Revolut-style (Recharts).
- Inbox des tâches à faire.

**Phase 6 — Semaines 15-16 — Planning Gantt (Module 6)**
- Composant Gantt simple (barres prévues vs réelles, jalons).
- Sync auto avenants → planning.
- Export PDF planning.

**Phase 7 — Semaines 17-19 — CR Chantier (Module 8) — le gros morceau iPad**
- Plan viewer PDF.js + Konva (zoom, pan, tap).
- Observations géolocalisées, catégorisation, photos.
- Annotations sur photo (flèches, croix, texte).
- Dictée vocale (Web Speech API + iOS natif).
- PWA + IndexedDB pour mode offline.
- Génération CR PDF brandé.

**Phase 8 — Semaines 20-21 — Réception, DGD, PV (Module 5)**
- PV de réception (consomme les réserves OPR).
- DGD auto par lot.
- Suivi cautions et alertes libération retenue.

**Phase 8bis — Semaines 22-23 — Cockpit · Honoraires agence (Module 9)**
- Modèle de données HonoraireContract / Mission / Situation / CockpitAccessGrant.
- Système de permissions par rôle + grants ponctuels (étendu au module 10).
- UI Contrat archi : éditeur de missions libres (drag-and-drop, validation Σ%=100%).
- UI Situations : slider d'avancement, calcul delta cumul, génération note d'honoraires PDF.
- Vue Honoraires AGENCE (pilotage global, route /cockpit/honoraires).
- Branchement signature électronique (réutilise SignatureProvider du Module 3).

**Phase 8ter — Semaines 24-26 — Cockpit · Trésorerie (Module 10)**
- Entités BankAccount, BankTransaction, RecurrentCharge, EInvoice.
- Connexion bancaire DSP2 (intégration **Bridge API** par défaut, abstraction `BankProvider` pour Powens fallback).
- Catégorisation auto transactions + ML simple (règles libellé+montant+récurrence).
- Saisie CRUD charges récurrentes + auto-détection depuis transactions.
- Cash flow prévisionnel : composant graphique 6 mois avec entrées / sorties / solde projeté.
- Alertes anti-découvert configurables.
- **Intégration PDP Pennylane** (API) : émission Factur-X des notes d'honoraires + réception factures fournisseurs.
- Abstraction `EInvoiceProvider` pour intégration future Sage, Esker, etc.
- Réconciliation auto paiements ↔ notes d'honoraires.
- **Rapprochement bancaire + TVA déductible** : détection auto des dépenses sans facture (cross-check Pennylane API), inbox "À rapprocher", capture photo mobile (OCR Claude Vision sur tickets/factures fournisseurs), upload PDF, récupération depuis Pennylane (bidirectionnel), calcul auto TVA déductible (5,5/10/20%), récap mensuel TVA collectée vs déductible, email digest hebdo.

**Phase 9 — Semaines 27-28 — Polish & onboarding design partners**
- Templates PDF brandés par agence.
- Command palette (Cmd+K).
- Doc d'aide intégrée.
- Onboarding manuel 5 premières agences.

### V1 — Mois 6 à 10

- Module **Contrats d'architecture** : modèle, honoraires, notes d'honoraires, suivi paiements MOA.
- **Export comptable** Pennylane + FEC (Sage/EBP).
- **Gantt avancé** : dépendances entre lots, chemin critique, courbe en S financière.
- Templates marché personnalisables.
- Multi-langue FR + EN (Suisse romande, Belgique).
- Améliorations UX issues feedback design partners.
- Ouverture commerciale (sortie programme design partners).

### V2 — Mois 11 à 18

- Module **Suivi commercial / pipeline** (concours, offres en cours).
- Module **Temps passés** collaborateurs.
- **Marché public CCAG Travaux**.
- App **mobile native** iOS / Android (au-delà de PWA).
- API publique + marketplace d'intégrations.
- Multi-bureaux / multi-entités juridiques.

## 13. Risques & questions ouvertes

### Risques produit

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| OCR Claude Vision sur DPGF/situations PDF moins fiable qu'espéré | Moyenne | Élevé | Investir tôt (Phase 2 semaines 5-7), tests sur 50 PDF réels design partners, fallback saisie manuelle toujours dispo |
| Mode offline iPad CR chantier complexe à industrialiser | Moyenne | Moyen | Démarrer en PWA + IndexedDB, accepter qu'app native iOS arrive en V2 |
| Sous-estimation complexité métier (cas particuliers BTP) | Élevée | Élevé | Design partners dès semaine 1, modèle de données extensible, refuser scope creep |
| Concurrence Archipad réactive (sortie module financier) | Faible | Moyen | Avance produit + brand UX, intégrations futures plutôt que confrontation |
| Inertie migration depuis BIM Office et Archipad | Moyenne | Élevé | Outil de migration à V1 (imports historiques), parrainage par l'archi déjà convaincu |
| Adoption iPad faible chez certaines agences | Faible | Moyen | Web companion soigné, MVP fonctionne aussi sur Chrome desktop avec tablette tactile générique |

### Risques business

| Risque | Mitigation |
|---|---|
| Marché archi PME conservateur, vente longue | Design partners convaincants, contenu vertical, viralité |
| Concurrence réactive BIM Office | Avance produit + culture utilisateur PME |
| Dépendance Anthropic API (OCR) | Architecture pluggable avec fallback Mistral OCR ou Azure Document Intelligence |
| Dépendance Yousign/DocuSign | Pluggable, donc neutre |

### Questions ouvertes pour itération v0.3

1. **Pricing exact** — tester Starter 79 / Pro 119 / Enterprise 169 sur design partners.
2. **Nom & marque** — atelier branding + dispo .com / .fr.
3. **Premier design partner cible** — 5 agences à shortlister par Arthur.
4. **Identité visuelle finale** — palette, logo, ton de voix : interne ou studio externe ?
5. **Stratégie freemium** — 1 chantier gratuit ad vitam ou seulement essai 30 j ?
6. **Sous-traitants** — un lot peut être sous-traité partiellement. MVP ou V1 ?
7. **Sous-comptes prorata** — fréquent sur grands chantiers, à clarifier.
8. **Module Contrats archi V1** — périmètre exact (loi MOP / Ordre / Mission de base) ?
9. **Internationalisation** — Suisse, Belgique, Luxembourg : normes proches mais distinctes. À prévoir architecturalement dès MVP ?
10. **OCR — choix de modèle vision** — Claude Vision API par défaut, mais on accepte d'évaluer GPT-4 Vision et Mistral OCR sur batch de test.
11. **CR Chantier — mode collaboratif temps réel** : plusieurs personnes annotent en même temps ? MVP, V1 ou jamais ?
12. **Branding par agence** des CR chantier : niveau de personnalisation (logo seul, palette, polices, footer custom) ?

## 14. Brief pour Claude Code (vibe coding)

### Setup initial

```bash
# Repo
npx create-next-app@latest architask --typescript --tailwind --app --turbopack
cd architask

# Stack
npm install drizzle-orm postgres @neondatabase/serverless
npm install -D drizzle-kit
npm install @clerk/nextjs
npm install zod react-hook-form @hookform/resolvers
npm install date-fns numeral
npm install xlsx                          # import Excel
npm install @react-pdf/renderer puppeteer # PDF
npm install resend                        # email
npm install framer-motion                 # animations
npm install pdfjs-dist konva react-konva  # plan viewer + annotations
npm install @anthropic-ai/sdk             # OCR via Claude Vision
npx shadcn@latest init
```

### Fichier `CLAUDE.md` à mettre à la racine du repo

```markdown
# Architask — Mémoire projet pour Claude Code

## Contexte
SaaS web + iPad de gestion de chantier pour PME archi (4-15 pers).
Concurrent direct de BIM Office (financier) + Archipad (CR chantier).
UX inspirée Apple + Revolut. Mode sombre dès le MVP.
Stack : Next.js 15 (App Router RSC), TypeScript strict, Tailwind v4,
shadcn/ui customisé, Drizzle + Postgres (Neon), Clerk auth, Framer Motion,
PDF.js + Konva pour plan viewer iPad, Yousign + DocuSign pluggable,
Claude Vision API pour OCR PDF, Resend email, Trigger.dev pour jobs async.

## 8 modules MVP
1. Opérations & marchés (import DPGF PDF avec OCR + Excel)
2. Avenants
3. CP (situation PDF avec OCR ou Excel ou saisie, calcul auto retenue)
4. Récap général
5. Réception, DGD, cautions, PV
6. Planning Gantt simple (barres par lot, jalons)
7. Annuaire MOA + Entreprises (avec décennale versionnée)
8. CR Chantier iPad style Archipad (plans annotés, observations
   géolocalisées, photos, génération PDF, OPR)

## Règles métier critiques (NF P03-001 marché privé)
- Tous les montants : 2 décimales, arrondi centime supérieur.
- Retenue garantie 5 % par défaut, plafonnée à 5 % du marché.
- Délai paiement légal : 30 j fin de mois.
- Σ CP émis ≤ marché révisé + travaux suppl. acceptés
  (assertion bloquante côté serveur).
- Décennale obligatoire et valide pour signer un marché
  (assertion bloquante).
- Alerte expiration décennale à -60 j.
- Numérotation CP : auto, format "CP-{op-code}-{lot-num}-{n°}".

## Conventions code
- App Router, server actions pour mutations.
- React Hook Form + Zod pour tous les formulaires (jamais useState seul).
- Tabular nums sur tous montants (className="tabular-nums").
- Pas de any en TS. Pas de eslint-disable.
- Tests unitaires obligatoires (>90 % couverture) sur :
  * moteur de calcul CP/DGD
  * validation décennale
  * parser OCR Claude Vision (avec batch de PDF fixtures)
- Server actions retournent { data, error } typés, jamais throw côté client.

## Design system (tokens dans `app/globals.css`)
- Couleurs et tokens : voir section 9.2 du PRD.
- Composants shadcn customisés avec tokens (jamais hard-codé).
- Drawer plutôt que Modal pour édits longs.
- Toujours afficher les statuts via <StatusPill />.
- Command palette (Cmd+K) sur toutes les pages.
- Mode sombre traité dès le composant, jamais en afterthought.
- Animations Framer Motion : 120/180/240 ms, ease-out, jamais bounce.
- Border radius : sm=6, md=10, lg=14, hero=24.

## UI iPad CR Chantier (module 8)
- Plein écran landscape.
- Plan PDF au centre (PDF.js viewer), zoom pinch + pan tactile.
- Observations en pins colorés par catégorie.
- Konva.js pour annotations sur photo.
- Mode offline : Service Worker + IndexedDB (Dexie.js).
- Dictée : Web Speech API (fallback iOS Safari natif).

## Signature électronique pluggable
- Interface `SignatureProvider` avec méthodes :
  createSignatureRequest, getStatus, downloadSigned, webhookHandler.
- Deux implémentations : `YousignProvider`, `DocusignProvider`.
- Choix par agence dans `/agence`, BYOK (clés API agence).
- Webhooks unifiés via endpoint /api/signature/webhook?provider=...

## OCR PDF (DPGF, situations)
- Service `ocr.extractDPGF(pdfBuffer)` et `ocr.extractSituation(pdfBuffer)`.
- Implémenté avec @anthropic-ai/sdk, model claude-sonnet-4-6 (vision).
- Prompt système typé, retour JSON validé par schéma Zod.
- Score de confiance par poste (0-100).
- UI : OCRValidationCard, badge vert ≥95, orange 70-95, rouge <70.

## Hors scope MVP — ne PAS ajouter sans validation
- BIM/IFC, DAO, GED bureau, planning Gantt avancé (dépendances),
  contrats archi, temps passés, suivi commercial, marché public,
  app mobile native, multi-bureaux, RH.
```

### Prompts d'amorçage suggérés (à enchaîner dans Claude Code)

**Prompt 0 — Design system**
> « Crée `app/globals.css` avec les CSS variables Apple/Revolut définies en section 9.2 du PRD : couleurs light et dark, tokens d'espacement, typographie Inter variable, ombres douces, radius. Génère ensuite les composants shadcn customisés : Button, Card, KPI, StatusPill, Drawer, OCRValidationCard. Mode sombre supporté sur chaque composant. »

**Prompt 1 — Modèle de données complet**
> « En te basant sur la section 7 du PRD, crée tous les schémas Drizzle pour les 8 modules : Organization, User, Company, Insurance, Stakeholder/Owner, Operation, Lot, Avenant, Situation, CertificatPaiement, DGD, Caution, PlanningTask, Plan, SiteMeeting, Observation, Photo, Reserve, PVReception, Document. Toutes relations, contraintes métier (assertion Σ CP, décennale valide). Génère la migration initiale. »

**Prompt 2 — Moteur de calcul CP**
> « Implémente `lib/finance/computeCP.ts` selon NF P03-001 : cumul travaux exécutés, soustraction CP précédents, retenue 5 % plafonnée, révision selon formule BT01, TVA. Retourne `CPResult` typé avec tous sous-totaux. Tests unitaires Vitest couvrant : retenue plafonnée, révision BT01, TVA 10/20 %, assertion Σ CP, premier CP (sans CP précédent), DGD final, montants nuls. Couverture > 90 %. »

**Prompt 3 — OCR PDF avec Claude Vision**
> « Crée `lib/ocr/extractDPGF.ts` qui prend un PDF (Buffer), appelle Claude Sonnet 4.6 vision via @anthropic-ai/sdk avec prompt système pour extraire désignation/unité/qté/PU HT/montant HT en JSON strict (schéma Zod). Retourne `{ postes: [...], confidence_global: number, confidence_par_poste: number[] }`. Fais pareil pour `extractSituation.ts` (extraction d'avancement par poste). Écris des tests avec 3 fixtures PDF réalistes. »

**Prompt 4 — Module Annuaire (Module 7)**
> « Implémente la page `/annuaire` et `/annuaire/entreprise/[id]` : table tabulaire (en mode liste) ou cards (en mode grille), search globale, filtres (avec/sans décennale valide, par activité Qualibat). Détail entreprise avec historique des marchés, assurances en timeline (date validité), alertes inline si expiration < 60 j. CRUD complet. »

**Prompt 5 — Import DPGF (Excel + PDF avec OCR)**
> « Implémente le composant `<DPGFImporter />` : drop zone unique, détection format (.xlsx vs .pdf), branchement sur le bon flow. Mode Excel : SheetJS + auto-mapping colonnes. Mode PDF : appel à `extractDPGF`, affichage `OCRValidationCard` pour chaque poste avec édition inline. Confirmation finale, création des postes en base. »

**Prompt 6 — Écran récap général d'une opération**
> « Implémente `/operations/[id]` selon section 9.4 du PRD. Banner avec marché révisé / cumul CP / avancement % en grand (tabular nums). Donut Recharts répartition par lot. Tableau lot-par-lot avec sparkline d'avancement mensuel. Mini-Gantt en bas. Pure Tailwind + shadcn, dark mode supporté, mobile responsive. Anim Framer Motion sur l'entrée. »

**Prompt 7 — Plan viewer iPad pour CR chantier (Module 8)**
> « Crée `<PlanViewer>` : charge un PDF via pdfjs-dist, rendu sur canvas, zoom pinch + pan tactile fluide. Couche Konva par-dessus pour les observations (pins colorés par catégorie). Tap sur le plan ouvre un drawer pour créer une observation. Tap sur un pin existant ouvre le drawer en édition. Optimisé iPad landscape, fallback desktop avec souris + scroll wheel. »

**Prompt 8 — Couche Signature pluggable**
> « Crée `lib/signature/` avec interface `SignatureProvider` (méthodes createSignatureRequest, getStatus, downloadSigned, handleWebhook). Deux implémentations : `YousignProvider` (Yousign API v3) et `DocusignProvider` (DocuSign eSignature API). Singleton `getSignatureProvider(orgId)` qui lit la config agence. Endpoint webhook unifié `/api/signature/webhook?provider=...`. »

### Critères de qualité du code attendus

- Couverture tests > 90 % sur `lib/finance/`, `lib/ocr/`, `lib/validation/insurance/`.
- Validation Zod sur toutes entrées utilisateur, server actions, payloads API externes.
- Server actions typées avec revalidation correcte.
- A11y : focus visible, labels formulaires, ARIA sur composants custom.
- Performance : LCP < 1.5 s dashboard, plan viewer 60 fps en zoom/pan iPad.
- Mode offline (Module 8) : zéro perte de données après 24 h offline, sync conflits gérés.
- Sécurité : RLS Postgres par `organization_id`, audit log immutable.

### Ordre d'exécution recommandé (correspondance phases roadmap)

1. Prompt 0 (design system) → Phase 0.
2. Prompt 1 (modèle de données) → Phase 0.
3. Prompt 4 (annuaire) → Phase 1.
4. Prompt 3 (OCR Claude Vision) puis Prompt 5 (import DPGF) → Phase 2.
5. Prompt 2 (moteur CP) → Phase 3.
6. Prompt 8 (signature pluggable) → Phase 4.
7. Prompt 6 (récap général) → Phase 5.
8. Prompt 7 (plan viewer iPad) → Phase 7.

---

> **Fin du PRD v0.2.** Prochaines étapes recommandées :
> 1. Validation des arbitrages ouverts v0.3 (pricing, nom, OCR fallback, sous-traitants, internationalisation).
> 2. Maquettes hi-fi des 4 écrans phares (livrées en parallèle de cette v0.2).
> 3. Recrutement des 5 design partners.
> 4. Démarrage du repo selon section 14.
