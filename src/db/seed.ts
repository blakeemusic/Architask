/**
 * Seed de données de démo pour le développement.
 *
 * Crée :
 *  - 1 organisation "Atelier Habria" (clerk_org_id = NULL → "personal org"
 *    fallback ; le 1er user qui se connecte avec une autre Clerk Org en
 *    créera une nouvelle, ce seed sert pour la maquette de l'UI).
 *  - 1 user owner Camille (clerk_user_id placeholder — sera attaché au vrai
 *    compte au prochain run du lazy-init si tu modifies le seed).
 *  - 8 entreprises calquées sur les maquettes v0.3 avec SIRETs valides (14
 *    chiffres) et adresses Île-de-France.
 *  - 8 décennales aux statuts mixés (5 valides, 2 expirant <60j, 1 expirée).
 *  - 1-2 contacts par entreprise.
 *  - 3 MOAs : SCI Cèdres Habitat, M. & Mme Robineau, Mairie de Boulogne.
 *
 * Idempotent : ON CONFLICT DO NOTHING sur les colonnes uniques. Tu peux
 * lancer `npm run db:seed` plusieurs fois sans dupliquer.
 *
 * Note : ce seed est volontairement détaché du flow Clerk (clerk_user_id et
 * clerk_org_id placeholders). Au 1er login réel, lazy-init créera une autre
 * org / user pour ton compte Clerk. Pour les voir, login avec un compte de
 * test, puis ouvre Drizzle Studio pour bricoler le clerk_user_id si tu veux
 * "adopter" l'org seed.
 */

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./index";
import {
  companies,
  companyContacts,
  insurances,
  moas,
  moaContacts,
} from "./schema/annuaire";
import { organizations, users } from "./schema/auth";
import {
  avenants,
  lots,
  operations,
  planningTasks,
  situations,
  situationLines,
} from "./schema/operations";
import { certificatsPaiement } from "./schema/finance";
import { computeCP } from "../lib/finance/computeCP";
import { computeDGD } from "../lib/finance/computeDGD";
import {
  cautions,
  dgds,
  pvReceptions,
  retentions,
} from "./schema/operations";
import {
  honoraireContracts,
  honoraireMissions,
  honoraireSituations,
} from "./schema/honoraires";
import { cockpitAccessGrants } from "./schema/permissions";
import {
  bankAccounts,
  bankTransactions,
  einvoiceConfigurations,
  einvoiceEvents,
  expenseInvoices,
  recurringCharges,
  vatSummaries,
} from "./schema/tresorerie";
import { MockBankProvider, MOCK_BANK_ACCOUNT_IDS } from "../lib/bank/mock-provider";
import { nextNHNumber } from "../lib/validation/numbering";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const today = new Date();
const SEED_ORG_CLERK_ID = "seed_org_atelier_habria";
const SEED_USER_CLERK_ID = "seed_user_camille";

function daysFromToday(n: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
}

// ---------------------------------------------------------------
// Données
// ---------------------------------------------------------------

const COMPANIES = [
  {
    raisonSociale: "SAS Beton+",
    siret: "82450673100018",
    formeJuridique: "SAS",
    adresseLigne1: "12 rue de la Pompe",
    codePostal: "92100",
    ville: "Boulogne-Billancourt",
    decennale: {
      compagnie: "AXA Construction",
      numPolice: "4928-DC-7811",
      montantGaranti: "1200000",
      // Expire dans 42j → status warning
      dateDebut: daysFromToday(-723), // ~2 ans avant l'expiration
      dateFin: daysFromToday(42),
      activitesCouvertes: ["gros_oeuvre", "macconnerie", "fondations", "voiles_ba"],
    },
    contacts: [
      { name: "Jean Béton", role: "gerant" as const, email: "j.beton@beton-plus.fr", phone: "01 46 12 34 56" },
      { name: "Marc Truelle", role: "conducteur" as const, email: "m.truelle@beton-plus.fr", phone: "06 12 34 56 78" },
    ],
  },
  {
    raisonSociale: "SARL Dupont",
    siret: "47852136900025",
    formeJuridique: "SARL",
    adresseLigne1: "5 avenue de Paris",
    codePostal: "78000",
    ville: "Versailles",
    decennale: {
      compagnie: "Generali Pro",
      numPolice: "GEN-2024-CHARP-118",
      montantGaranti: "800000",
      // Expire dans 56j → status warning
      dateDebut: daysFromToday(-674),
      dateFin: daysFromToday(56),
      activitesCouvertes: ["charpente_bois", "couverture"],
    },
    contacts: [
      { name: "Pierre Dupont", role: "gerant" as const, email: "pierre@sarl-dupont.fr", phone: "01 39 50 12 34" },
    ],
  },
  {
    raisonSociale: "Toits & Co",
    siret: "53914628700031",
    formeJuridique: "SAS",
    adresseLigne1: "8 rue de la Couronne",
    codePostal: "92600",
    ville: "Asnières-sur-Seine",
    decennale: {
      compagnie: "MMA Entreprises",
      numPolice: "MMA-COUV-1245",
      montantGaranti: "900000",
      // Valide (dateFin > today + 60j)
      dateDebut: daysFromToday(-365),
      dateFin: daysFromToday(365),
      activitesCouvertes: ["couverture_zinc", "etancheite", "isolation_toiture"],
    },
    contacts: [
      { name: "Sophie Tuilet", role: "gerant" as const, email: "sophie@toits-co.fr", phone: "01 47 90 12 34" },
    ],
  },
  {
    raisonSociale: "Vitrol Ouest",
    siret: "61058249100012",
    formeJuridique: "SARL",
    adresseLigne1: "23 rue des Menuisiers",
    codePostal: "14000",
    ville: "Caen",
    decennale: {
      compagnie: "Allianz Pro",
      numPolice: "AZ-MENU-9087",
      montantGaranti: "650000",
      dateDebut: daysFromToday(-200),
      dateFin: daysFromToday(530),
      activitesCouvertes: ["menuiseries_exterieures", "fermetures", "vitrerie"],
    },
    contacts: [
      { name: "Yvon Le Goff", role: "gerant" as const, email: "yvon@vitrol-ouest.fr", phone: "02 31 78 45 12" },
      { name: "Anne Cariou", role: "comptabilite" as const, email: "compta@vitrol-ouest.fr", phone: null },
    ],
  },
  {
    raisonSociale: "Thermo Pro",
    siret: "79452186300027",
    formeJuridique: "SAS",
    adresseLigne1: "45 rue du Plomb",
    codePostal: "93200",
    ville: "Saint-Denis",
    decennale: {
      compagnie: "AXA Construction",
      numPolice: "4928-PCVC-2210",
      montantGaranti: "1100000",
      dateDebut: daysFromToday(-450),
      dateFin: daysFromToday(280),
      activitesCouvertes: ["plomberie", "chauffage", "ventilation", "cvc"],
    },
    contacts: [
      { name: "Olivier Tuyau", role: "gerant" as const, email: "o.tuyau@thermopro.fr", phone: "01 48 20 56 78" },
    ],
  },
  {
    raisonSociale: "Volt & Co",
    siret: "82749561300048",
    formeJuridique: "SAS",
    adresseLigne1: "17 boulevard de la Défense",
    codePostal: "92000",
    ville: "Nanterre",
    decennale: {
      compagnie: "Generali Pro",
      numPolice: "GEN-ELEC-3387",
      montantGaranti: "750000",
      dateDebut: daysFromToday(-120),
      dateFin: daysFromToday(610),
      activitesCouvertes: ["electricite_courant_fort", "courant_faible", "domotique"],
    },
    contacts: [
      { name: "Léo Volt", role: "gerant" as const, email: "leo@volt-co.fr", phone: "01 41 30 67 89" },
      { name: "Aïcha Bensaïd", role: "conducteur" as const, email: "a.bensaid@volt-co.fr", phone: "06 78 90 12 34" },
    ],
  },
  {
    raisonSociale: "Plak Group",
    siret: "32014875600019",
    formeJuridique: "SARL",
    adresseLigne1: "9 rue de la Cloison",
    codePostal: "93500",
    ville: "Pantin",
    decennale: {
      compagnie: "MMA Entreprises",
      numPolice: "MMA-PLAK-0844",
      montantGaranti: "500000",
      // Expirée depuis 30j → status danger
      dateDebut: daysFromToday(-760),
      dateFin: daysFromToday(-30),
      activitesCouvertes: ["cloisons", "faux_plafonds", "isolation_interieure"],
    },
    contacts: [
      { name: "Hugo Plaket", role: "gerant" as const, email: "hugo@plak-group.fr", phone: "01 48 91 23 45" },
    ],
  },
  {
    raisonSociale: "Coloria SARL",
    siret: "54817236400013",
    formeJuridique: "SARL",
    adresseLigne1: "31 rue des Couleurs",
    codePostal: "93300",
    ville: "Aubervilliers",
    decennale: {
      compagnie: "Allianz Pro",
      numPolice: "AZ-PEINT-5562",
      montantGaranti: "450000",
      dateDebut: daysFromToday(-90),
      dateFin: daysFromToday(640),
      activitesCouvertes: ["peintures_interieures", "peintures_exterieures", "revêtements_muraux"],
    },
    contacts: [
      { name: "Iris Pinceau", role: "gerant" as const, email: "iris@coloria.fr", phone: "01 48 33 45 67" },
    ],
  },
] as const;

const MOAS = [
  {
    typeJuridique: "sci" as const,
    raisonSociale: "SCI Cèdres Habitat",
    siret: "81920536700024",
    adresseLigne1: "42 rue des Cèdres",
    codePostal: "92100",
    ville: "Boulogne-Billancourt",
    contacts: [
      { name: "Catherine Lemaire", role: "gérante", email: "c.lemaire@cedres-habitat.fr", phone: "01 46 09 87 65" },
    ],
  },
  {
    typeJuridique: "particulier" as const,
    raisonSociale: "M. & Mme Robineau",
    siret: null,
    adresseLigne1: "8 rue de la Vigne",
    codePostal: "92210",
    ville: "Saint-Cloud",
    contacts: [
      { name: "Vincent Robineau", role: "MOA", email: "v.robineau@gmail.com", phone: "06 23 45 67 89" },
      { name: "Claire Robineau", role: "MOA", email: "c.robineau@gmail.com", phone: "06 34 56 78 90" },
    ],
  },
  {
    typeJuridique: "collectivite" as const,
    raisonSociale: "Mairie de Boulogne-Billancourt",
    siret: "21920012300017",
    adresseLigne1: "26 avenue André Morizet",
    codePostal: "92100",
    ville: "Boulogne-Billancourt",
    contacts: [
      { name: "Direction des Bâtiments", role: "service technique", email: "batiments@mairie-boulogne.fr", phone: "01 55 18 50 00" },
    ],
  },
];

// ---------------------------------------------------------------
// Seed
// ---------------------------------------------------------------

async function seed() {
  console.log("🌱 Seeding Architask demo data…");

  // 1. Organization — pas d'ON CONFLICT possible car index partiel
  //    sur clerk_org_id (WHERE clerk_org_id IS NOT NULL). On check d'abord.
  const [orgExisting] = await db
    .select()
    .from(organizations)
    .where(sql`${organizations.clerkOrgId} = ${SEED_ORG_CLERK_ID}`);

  const org =
    orgExisting ??
    (
      await db
        .insert(organizations)
        .values({
          clerkOrgId: SEED_ORG_CLERK_ID,
          name: "Atelier Habria",
          slug: "atelier-habria",
        })
        .returning()
    )[0];
  if (!org) throw new Error("Org seed introuvable après insertion.");
  console.log(`✓ Organization: ${org.name} (${org.id})`);

  // 2. User owner
  await db
    .insert(users)
    .values({
      organizationId: org.id,
      clerkUserId: SEED_USER_CLERK_ID,
      email: "camille@atelier-habria.fr",
      name: "Camille Aubert",
      role: "owner",
    })
    .onConflictDoNothing({
      target: [users.clerkUserId, users.organizationId],
    });
  const ownerUserRow = await db.query.users.findFirst({
    where: and(
      eq(users.clerkUserId, SEED_USER_CLERK_ID),
      eq(users.organizationId, org.id),
    ),
  });
  if (!ownerUserRow) throw new Error("Owner user seed introuvable.");
  const ownerUserId = ownerUserRow.id;
  console.log("✓ User owner: Camille Aubert");

  // 3. Companies + insurances + contacts
  //    Pas d'ON CONFLICT (index partiel sur siret WHERE NOT NULL) → check then insert.
  let companyCount = 0;
  let insuranceCount = 0;
  let contactCount = 0;
  for (const c of COMPANIES) {
    const existing = await db.query.companies.findFirst({
      where: sql`${companies.organizationId} = ${org.id} AND ${companies.siret} = ${c.siret}`,
    });
    const companyRow =
      existing ??
      (
        await db
          .insert(companies)
          .values({
            organizationId: org.id,
            raisonSociale: c.raisonSociale,
            siret: c.siret,
            formeJuridique: c.formeJuridique,
            adresseLigne1: c.adresseLigne1,
            codePostal: c.codePostal,
            ville: c.ville,
            paletteSeed: c.siret,
          })
          .returning()
      )[0];
    if (!companyRow) throw new Error(`Company seed introuvable : ${c.raisonSociale}`);

    if (!existing) companyCount += 1;

    // Décennale
    const status =
      c.decennale.dateFin <= today
        ? "expire"
        : (c.decennale.dateFin.getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24) <=
            60
          ? "expirant_60j"
          : "valide";

    // Check existence (pas de SIRET unique pour insurances, on regarde company + type + numPolice)
    const existingInsurance = await db.query.insurances.findFirst({
      where: sql`${insurances.companyId} = ${companyRow.id} AND ${insurances.numPolice} = ${c.decennale.numPolice}`,
    });
    if (!existingInsurance) {
      await db.insert(insurances).values({
        companyId: companyRow.id,
        type: "decennale",
        compagnie: c.decennale.compagnie,
        numPolice: c.decennale.numPolice,
        montantGaranti: c.decennale.montantGaranti,
        dateDebut: c.decennale.dateDebut,
        dateFin: c.decennale.dateFin,
        activitesCouvertes: [...c.decennale.activitesCouvertes],
        status,
      });
      insuranceCount += 1;
    }

    // Contacts
    for (const ct of c.contacts) {
      const existingContact = await db.query.companyContacts.findFirst({
        where: sql`${companyContacts.companyId} = ${companyRow.id} AND ${companyContacts.name} = ${ct.name}`,
      });
      if (!existingContact) {
        await db.insert(companyContacts).values({
          companyId: companyRow.id,
          name: ct.name,
          role: ct.role,
          email: ct.email,
          phone: ct.phone,
        });
        contactCount += 1;
      }
    }
  }
  console.log(`✓ Companies: ${companyCount} créées (${COMPANIES.length} au total)`);
  console.log(`✓ Décennales: ${insuranceCount} créées (statuts mixés)`);
  console.log(`✓ Contacts entreprises: ${contactCount} créés`);

  // 4. MOAs + contacts
  let moaCount = 0;
  let moaContactCount = 0;
  for (const m of MOAS) {
    // Pas de contrainte unique sur SIRET nullable des MOAs — check par raison_sociale.
    const existing = await db.query.moas.findFirst({
      where: sql`${moas.organizationId} = ${org.id} AND ${moas.raisonSociale} = ${m.raisonSociale}`,
    });
    let moaRow = existing;
    if (!moaRow) {
      [moaRow] = await db
        .insert(moas)
        .values({
          organizationId: org.id,
          typeJuridique: m.typeJuridique,
          raisonSociale: m.raisonSociale,
          siret: m.siret,
          adresseLigne1: m.adresseLigne1,
          codePostal: m.codePostal,
          ville: m.ville,
        })
        .returning();
      moaCount += 1;
    }
    if (!moaRow) throw new Error(`MOA seed introuvable : ${m.raisonSociale}`);

    for (const ct of m.contacts) {
      const existingContact = await db.query.moaContacts.findFirst({
        where: sql`${moaContacts.moaId} = ${moaRow.id} AND ${moaContacts.name} = ${ct.name}`,
      });
      if (!existingContact) {
        await db.insert(moaContacts).values({
          moaId: moaRow.id,
          name: ct.name,
          role: ct.role,
          email: ct.email,
          phone: ct.phone,
        });
        moaContactCount += 1;
      }
    }
  }
  console.log(`✓ MOAs: ${moaCount} créés (${MOAS.length} au total)`);
  console.log(`✓ Contacts MOA: ${moaContactCount} créés`);

  // 5. Operations + lots + planning_tasks + avenants
  //    Trois opérations calquées sur le mockup frame-operation v0.3.
  const allCompanies = await db.query.companies.findMany({
    where: eq(companies.organizationId, org.id),
  });
  const companyByName = new Map(allCompanies.map((c) => [c.raisonSociale, c]));
  const allMoas = await db.query.moas.findMany({
    where: eq(moas.organizationId, org.id),
  });
  const moaByName = new Map(allMoas.map((m) => [m.raisonSociale, m]));

  const OPERATIONS: Array<{
    code: string;
    name: string;
    moaName: string;
    ville: string;
    codePostal: string;
    dateOs: Date;
    dateReceptionCible: Date;
    montantPrevisionnelHt: string;
    statut: "en_execution";
    lots: Array<{
      numero: string;
      libelle: string;
      companyName: string;
      montantMarcheHt: string;
      activitesAttendues: string[];
    }>;
    avenants: Array<{
      lotNumero: string;
      objet: string;
      montantHt: string;
      impactDelaiJours: number;
      dateSignature: Date;
    }>;
  }> = [
    {
      code: "RC",
      name: "Résidence Les Cèdres",
      moaName: "SCI Cèdres Habitat",
      ville: "Boulogne-Billancourt",
      codePostal: "92100",
      dateOs: new Date("2025-09-15"),
      dateReceptionCible: new Date("2026-11-30"),
      montantPrevisionnelHt: "2000000",
      statut: "en_execution",
      lots: [
        { numero: "01", libelle: "Gros œuvre", companyName: "SAS Beton+", montantMarcheHt: "524800", activitesAttendues: ["gros_oeuvre", "macconnerie"] },
        { numero: "02", libelle: "Charpente", companyName: "SARL Dupont", montantMarcheHt: "186400", activitesAttendues: ["charpente_bois"] },
        { numero: "03", libelle: "Couverture", companyName: "Toits & Co", montantMarcheHt: "144280", activitesAttendues: ["couverture_zinc"] },
        { numero: "04", libelle: "Menuis. ext.", companyName: "Vitrol Ouest", montantMarcheHt: "272100", activitesAttendues: ["menuiseries_exterieures"] },
        { numero: "05", libelle: "Plomberie/CVC", companyName: "Thermo Pro", montantMarcheHt: "318940", activitesAttendues: ["plomberie", "cvc"] },
        { numero: "06", libelle: "Électricité", companyName: "Volt & Co", montantMarcheHt: "213460", activitesAttendues: ["electricite_courant_fort"] },
        { numero: "07", libelle: "Cloisons/FP", companyName: "Plak Group", montantMarcheHt: "198320", activitesAttendues: ["cloisons"] },
        { numero: "08", libelle: "Peintures", companyName: "Coloria SARL", montantMarcheHt: "156020", activitesAttendues: ["peintures_interieures"] },
      ],
      avenants: [
        {
          lotNumero: "01",
          objet: "Reprise des fondations zone Z3 (étude de sol défavorable)",
          montantHt: "50000",
          impactDelaiJours: 21,
          dateSignature: new Date("2025-12-08"),
        },
      ],
    },
    {
      code: "VR",
      name: "Villa Robineau — Saint-Cloud",
      moaName: "M. & Mme Robineau",
      ville: "Saint-Cloud",
      codePostal: "92210",
      dateOs: new Date("2025-11-01"),
      dateReceptionCible: new Date("2026-10-31"),
      montantPrevisionnelHt: "680000",
      statut: "en_execution",
      lots: [
        { numero: "01", libelle: "Gros œuvre", companyName: "SAS Beton+", montantMarcheHt: "184000", activitesAttendues: ["gros_oeuvre"] },
        { numero: "02", libelle: "Charpente", companyName: "SARL Dupont", montantMarcheHt: "92000", activitesAttendues: ["charpente_bois"] },
        { numero: "03", libelle: "Couverture", companyName: "Toits & Co", montantMarcheHt: "78400", activitesAttendues: ["couverture_zinc"] },
        { numero: "04", libelle: "Menuis. ext.", companyName: "Vitrol Ouest", montantMarcheHt: "108000", activitesAttendues: ["menuiseries_exterieures"] },
        { numero: "05", libelle: "Électricité", companyName: "Volt & Co", montantMarcheHt: "82000", activitesAttendues: ["electricite_courant_fort"] },
        { numero: "06", libelle: "Peintures", companyName: "Coloria SARL", montantMarcheHt: "68000", activitesAttendues: ["peintures_interieures"] },
      ],
      avenants: [],
    },
    {
      code: "EM",
      name: "École Marchand — Boulogne",
      moaName: "Mairie de Boulogne-Billancourt",
      ville: "Boulogne-Billancourt",
      codePostal: "92100",
      dateOs: new Date("2026-03-01"),
      dateReceptionCible: new Date("2027-08-31"),
      montantPrevisionnelHt: "3500000",
      statut: "en_execution",
      lots: [
        { numero: "01", libelle: "Gros œuvre", companyName: "SAS Beton+", montantMarcheHt: "620000", activitesAttendues: ["gros_oeuvre", "macconnerie"] },
        { numero: "02", libelle: "Charpente métallique", companyName: "SARL Dupont", montantMarcheHt: "245000", activitesAttendues: ["charpente_bois"] },
        { numero: "03", libelle: "Couverture", companyName: "Toits & Co", montantMarcheHt: "180000", activitesAttendues: ["couverture_zinc"] },
        { numero: "04", libelle: "Menuis. ext.", companyName: "Vitrol Ouest", montantMarcheHt: "320000", activitesAttendues: ["menuiseries_exterieures"] },
        { numero: "05", libelle: "Plomberie/CVC", companyName: "Thermo Pro", montantMarcheHt: "410000", activitesAttendues: ["plomberie", "cvc"] },
        { numero: "06", libelle: "Électricité courant fort", companyName: "Volt & Co", montantMarcheHt: "240000", activitesAttendues: ["electricite_courant_fort"] },
        { numero: "07", libelle: "Cloisons / FP", companyName: "Plak Group", montantMarcheHt: "210000", activitesAttendues: ["cloisons"] },
        { numero: "08", libelle: "Peintures", companyName: "Coloria SARL", montantMarcheHt: "175000", activitesAttendues: ["peintures_interieures"] },
        // 6 lots additionnels rattachés à des entreprises existantes.
        { numero: "09", libelle: "Reprise voirie & VRD", companyName: "SAS Beton+", montantMarcheHt: "160000", activitesAttendues: ["gros_oeuvre"] },
        { numero: "10", libelle: "Courant faible", companyName: "Volt & Co", montantMarcheHt: "95000", activitesAttendues: ["courant_faible"] },
        { numero: "11", libelle: "Isolation toiture", companyName: "Toits & Co", montantMarcheHt: "82000", activitesAttendues: ["isolation_toiture"] },
        { numero: "12", libelle: "Carrelage", companyName: "Coloria SARL", montantMarcheHt: "115000", activitesAttendues: ["peintures_interieures"] },
        { numero: "13", libelle: "Ventilation cuisine", companyName: "Thermo Pro", montantMarcheHt: "88000", activitesAttendues: ["ventilation"] },
        { numero: "14", libelle: "Espaces verts cour", companyName: "Coloria SARL", montantMarcheHt: "55000", activitesAttendues: ["peintures_interieures"] },
      ],
      avenants: [
        {
          lotNumero: "01",
          objet: "Reprise fondations + dalle locaux techniques",
          montantHt: "250000",
          impactDelaiJours: 45,
          dateSignature: new Date("2026-04-15"),
        },
        {
          lotNumero: "05",
          objet: "Renforcement CVC après étude énergétique",
          montantHt: "182000",
          impactDelaiJours: 30,
          dateSignature: new Date("2026-04-22"),
        },
      ],
    },
  ];

  let opCount = 0;
  let lotCount = 0;
  let avenantCount = 0;
  let planningTaskCount = 0;
  for (const op of OPERATIONS) {
    const moaRow = moaByName.get(op.moaName);
    if (!moaRow) throw new Error(`MOA "${op.moaName}" introuvable pour seed`);

    let opRow = await db.query.operations.findFirst({
      where: and(
        eq(operations.organizationId, org.id),
        eq(operations.code, op.code),
      ),
    });
    if (!opRow) {
      [opRow] = await db
        .insert(operations)
        .values({
          organizationId: org.id,
          code: op.code,
          name: op.name,
          moaId: moaRow.id,
          ville: op.ville,
          codePostal: op.codePostal,
          dateOs: op.dateOs,
          dateReceptionCible: op.dateReceptionCible,
          dureePrevueJours: Math.round(
            (op.dateReceptionCible.getTime() - op.dateOs.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
          montantPrevisionnelHt: op.montantPrevisionnelHt,
          statut: op.statut,
        })
        .returning();
      opCount += 1;

      // Jalons OS et Réception
      await db.insert(planningTasks).values({
        operationId: opRow.id,
        type: "jalon",
        libelle: "Ordre de service",
        dateDebutPrevue: op.dateOs,
        dateFinPrevue: op.dateOs,
        milestoneKind: "os",
      });
      await db.insert(planningTasks).values({
        operationId: opRow.id,
        type: "jalon",
        libelle: "Réception",
        dateDebutPrevue: op.dateReceptionCible,
        dateFinPrevue: op.dateReceptionCible,
        milestoneKind: "reception",
      });
      planningTaskCount += 2;
    }

    // Lots
    for (const l of op.lots) {
      const existingLot = await db.query.lots.findFirst({
        where: and(eq(lots.operationId, opRow.id), eq(lots.numero, l.numero)),
      });
      if (existingLot) continue;
      const c = companyByName.get(l.companyName);
      if (!c)
        throw new Error(`Entreprise "${l.companyName}" introuvable pour seed`);
      const [lotRow] = await db
        .insert(lots)
        .values({
          operationId: opRow.id,
          numero: l.numero,
          libelle: l.libelle,
          companyId: c.id,
          montantMarcheHt: l.montantMarcheHt,
          tauxTva: "20.00",
          modeRevision: "BT01",
          retenueGarantiePct: "5.00",
          delaiPaiementJours: 30,
          activitesAttendues: l.activitesAttendues,
          statut: "signe",
          decennaleCheckAt: new Date(),
        })
        .returning();
      lotCount += 1;
      // Planning task pour ce lot (dates contractuelles globales — l'user
      // ajustera ensuite dans le sprint Planning).
      await db.insert(planningTasks).values({
        operationId: opRow.id,
        lotId: lotRow.id,
        type: "lot",
        libelle: `Lot ${l.numero} · ${l.libelle}`,
        dateDebutPrevue: op.dateOs,
        dateFinPrevue: op.dateReceptionCible,
        statut: "en_cours",
      });
      planningTaskCount += 1;
    }

    // Avenants
    for (const a of op.avenants) {
      // Lookup the lot by numero on this operation.
      const lot = await db.query.lots.findFirst({
        where: and(
          eq(lots.operationId, opRow.id),
          eq(lots.numero, a.lotNumero),
        ),
      });
      if (!lot) continue;
      // Check si l'avenant existe déjà (par objet pour idempotence).
      const existingAv = await db.query.avenants.findFirst({
        where: and(eq(avenants.lotId, lot.id), eq(avenants.objet, a.objet)),
      });
      if (existingAv) continue;
      // Détermine le prochain numéro.
      const existing = await db.query.avenants.findMany({
        where: eq(avenants.lotId, lot.id),
      });
      const nextNum =
        existing.length === 0
          ? 1
          : Math.max(...existing.map((e) => e.numero)) + 1;
      await db.insert(avenants).values({
        lotId: lot.id,
        numero: nextNum,
        objet: a.objet,
        montantHt: a.montantHt,
        impactDelaiJours: a.impactDelaiJours,
        dateSignature: a.dateSignature,
        statut: "signe",
      });
      avenantCount += 1;
    }
  }
  console.log(`✓ Opérations: ${opCount} créées (${OPERATIONS.length} au total)`);
  console.log(`✓ Lots: ${lotCount} créés`);
  console.log(`✓ Planning tasks: ${planningTaskCount} créés`);
  console.log(`✓ Avenants signés: ${avenantCount} créés`);

  // 6. Situations + CPs historiques sur certaines opérations
  //    Calculés via le moteur computeCP pour avoir des valeurs cohérentes
  //    NF P03-001 (mêmes que celles attendues en prod).
  const SITUATION_SCENARIOS: Array<{
    opCode: string;
    lotNumero: string;
    history: Array<{
      monthsAgo: number;
      pctGlobal: string;
      finalStatut: "paye" | "signe" | "envoye" | "a_valider" | "brouillon";
    }>;
  }> = [
    {
      opCode: "RC",
      lotNumero: "01",
      history: [
        { monthsAgo: 3, pctGlobal: "50.00", finalStatut: "paye" },
        { monthsAgo: 2, pctGlobal: "65.00", finalStatut: "paye" },
        { monthsAgo: 1, pctGlobal: "74.00", finalStatut: "signe" },
      ],
    },
    {
      opCode: "RC",
      lotNumero: "02",
      history: [
        { monthsAgo: 3, pctGlobal: "60.00", finalStatut: "paye" },
        { monthsAgo: 2, pctGlobal: "80.00", finalStatut: "paye" },
        { monthsAgo: 1, pctGlobal: "100.00", finalStatut: "envoye" },
      ],
    },
    {
      opCode: "EM",
      lotNumero: "01",
      history: [
        { monthsAgo: 0, pctGlobal: "30.00", finalStatut: "brouillon" },
      ],
    },
  ];

  let situationCount = 0;
  let cpCount = 0;
  for (const scenario of SITUATION_SCENARIOS) {
    const op = await db.query.operations.findFirst({
      where: and(
        eq(operations.organizationId, org.id),
        eq(operations.code, scenario.opCode),
      ),
    });
    if (!op) continue;
    const lot = await db.query.lots.findFirst({
      where: and(eq(lots.operationId, op.id), eq(lots.numero, scenario.lotNumero)),
      with: { avenants: true },
    });
    if (!lot) continue;

    let sequence = 1;
    const previousCps: Array<{
      brutAPayerHt: string;
      retenueGarantie: string;
      statut: "brouillon" | "a_valider" | "signe" | "envoye" | "paye";
    }> = [];

    for (const step of scenario.history) {
      const periodDate = new Date();
      periodDate.setMonth(periodDate.getMonth() - step.monthsAgo);
      const periodeMois = periodDate.getMonth() + 1;
      const periodeAnnee = periodDate.getFullYear();

      // Check existence (idempotence).
      const existingSit = await db.query.situations.findFirst({
        where: and(
          eq(situations.lotId, lot.id),
          eq(situations.periodeMois, periodeMois),
          eq(situations.periodeAnnee, periodeAnnee),
        ),
      });
      let situationId = existingSit?.id;

      if (!existingSit) {
        const [sitRow] = await db
          .insert(situations)
          .values({
            lotId: lot.id,
            periodeMois,
            periodeAnnee,
            source: "manual",
            ocrStatus: "done",
          })
          .returning();
        situationId = sitRow.id;
        await db.insert(situationLines).values({
          situationId: sitRow.id,
          pctAvancement: step.pctGlobal,
          montantCumuleHt: "0",
        });
        situationCount += 1;
      }

      if (!situationId) continue;

      // Numéro CP attendu
      const numero = `CP-${scenario.opCode}-${scenario.lotNumero}-${String(sequence).padStart(3, "0")}`;

      // Check existence CP (idempotence).
      const existingCp = await db.query.certificatsPaiement.findFirst({
        where: eq(certificatsPaiement.numero, numero),
      });
      sequence += 1;

      const computeResult = computeCP({
        lot: {
          montantMarcheHt: lot.montantMarcheHt,
          retenueGarantiePct: lot.retenueGarantiePct,
          tauxTva: lot.tauxTva,
          avenantsSignes: lot.avenants
            .filter((a) => a.statut === "signe")
            .map((a) => ({ montantHt: a.montantHt ?? "0" })),
        },
        situation: { mode: "global", pctGlobal: step.pctGlobal },
        previousCPs: previousCps,
      });
      if (!computeResult.ok) continue;
      const m = computeResult.data;

      // Toujours alimenter previousCps même si le CP existe déjà — pour les
      // CP suivants du même scénario.
      if (
        step.finalStatut !== "brouillon" &&
        step.finalStatut !== "a_valider"
      ) {
        previousCps.push({
          brutAPayerHt: m.brutAPayerHt,
          retenueGarantie: m.retenueGarantie,
          statut: step.finalStatut,
        });
      }

      if (existingCp) continue;

      const emissionDate = new Date(periodDate);
      emissionDate.setDate(28);
      const dueDate = new Date(emissionDate);
      dueDate.setDate(dueDate.getDate() + lot.delaiPaiementJours);

      await db.insert(certificatsPaiement).values({
        operationId: op.id,
        lotId: lot.id,
        numero,
        situationId,
        periodeMois,
        periodeAnnee,
        cumulTravauxHt: m.cumulTravauxHt,
        cumulCpPrecedentsHt: m.cumulCpPrecedentsHt,
        brutAPayerHt: m.brutAPayerHt,
        retenueGarantie: m.retenueGarantie,
        revisionMontantHt: m.revisionMontantHt,
        tva: m.tva,
        netTtc: m.netTtc,
        statut: step.finalStatut,
        dueDate,
        sentAt:
          step.finalStatut === "envoye" || step.finalStatut === "paye"
            ? new Date(emissionDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            : null,
        // paidAt = date à laquelle l'archi a DÉCLARÉ que la MOA a payé
        // l'entreprise (info reçue par retour MOA ou relance entreprise).
        // L'archi (MOE) ne perçoit pas le paiement directement —
        // NF P03-001 : la MOA paie directement l'entreprise.
        paidAt:
          step.finalStatut === "paye"
            ? new Date(emissionDate.getTime() + 20 * 24 * 60 * 60 * 1000)
            : null,
        signedAt:
          step.finalStatut !== "brouillon" && step.finalStatut !== "a_valider"
            ? new Date(emissionDate.getTime() + 1 * 24 * 60 * 60 * 1000)
            : null,
        createdBy: ownerUserId,
        signedByUserId:
          step.finalStatut !== "brouillon" && step.finalStatut !== "a_valider"
            ? ownerUserId
            : null,
      });
      cpCount += 1;
    }
  }
  console.log(`✓ Situations: ${situationCount} créées`);
  console.log(`✓ CPs: ${cpCount} créés (statuts mixés)`);

  // 7. Retentions + cautions seedées sur Résidence Les Cèdres
  //    Note : en vrai, une retention est créée à la SIGNATURE du PV, pas
  //    dès qu'un lot est à 100%. On triche ici pour le seed (RC n'a pas de
  //    PV signé mais on veut avoir des retentions visibles pour test UI).
  const rcOp = await db.query.operations.findFirst({
    where: and(eq(operations.organizationId, org.id), eq(operations.code, "RC")),
    with: { lots: { with: { company: true } } },
  });
  let retentionCount = 0;
  let cautionCount = 0;
  if (rcOp) {
    const rcLot01 = rcOp.lots.find((l) => l.numero === "01");
    const rcLot02 = rcOp.lots.find((l) => l.numero === "02");
    const rcLot03 = rcOp.lots.find((l) => l.numero === "03");
    // Retentions artificielles pour test UI (PV pas encore signé en vrai).
    for (const lot of [rcLot02, rcLot03]) {
      if (!lot) continue;
      const existing = await db.query.retentions.findFirst({
        where: eq(retentions.lotId, lot.id),
      });
      if (existing) continue;
      const dateRecept = new Date();
      dateRecept.setMonth(dateRecept.getMonth() - 1);
      const echeance = new Date(dateRecept);
      echeance.setFullYear(echeance.getFullYear() + 1);
      const montantRetenu = (Number(lot.montantMarcheHt) * 0.05).toFixed(2);
      await db.insert(retentions).values({
        lotId: lot.id,
        montantRetenu,
        dateReceptionLot: dateRecept,
        echeanceLiberation: echeance,
        statut: "en_cours",
      });
      retentionCount += 1;
    }
    // 2 cautions actives sur RC Lot 03 et Lot 01 (différents lots).
    for (const lot of [rcLot01, rcLot03]) {
      if (!lot) continue;
      const existing = await db.query.cautions.findFirst({
        where: eq(cautions.lotId, lot.id),
      });
      if (existing) continue;
      const dateEm = new Date();
      dateEm.setMonth(dateEm.getMonth() - 6);
      const dateExp = new Date(dateEm);
      dateExp.setFullYear(dateExp.getFullYear() + 1);
      await db.insert(cautions).values({
        lotId: lot.id,
        montant: (Number(lot.montantMarcheHt) * 0.05).toFixed(2),
        dateEmission: dateEm,
        dateExpiration: dateExp,
        banque: lot.numero === "01" ? "Crédit Mutuel Pro" : "BNP Paribas",
        numCaution: `RBQS-2026-${String(rcOp.code).padStart(2, "0")}${lot.numero}`,
        statut: "active",
      });
      cautionCount += 1;
    }
  }
  console.log(`✓ Retentions: ${retentionCount} créées (RC, test UI)`);
  console.log(`✓ Cautions: ${cautionCount} créées (RC)`);

  // 8. Crèche Cousteau — opération clôturée DGD
  //    7 lots avec CPs payés, PV signé, 7 DGDs signés.
  const CRECHE_LOTS: Array<{
    numero: string;
    libelle: string;
    companyName: string;
    montant: string;
    activites: string[];
  }> = [
    { numero: "01", libelle: "Gros œuvre", companyName: "SAS Beton+", montant: "180000", activites: ["gros_oeuvre"] },
    { numero: "02", libelle: "Charpente", companyName: "SARL Dupont", montant: "92000", activites: ["charpente_bois"] },
    { numero: "03", libelle: "Couverture", companyName: "Toits & Co", montant: "85000", activites: ["couverture_zinc"] },
    { numero: "04", libelle: "Menuiseries", companyName: "Vitrol Ouest", montant: "120000", activites: ["menuiseries_exterieures"] },
    { numero: "05", libelle: "Plomberie/CVC", companyName: "Thermo Pro", montant: "160000", activites: ["plomberie"] },
    { numero: "06", libelle: "Électricité", companyName: "Volt & Co", montant: "95000", activites: ["electricite_courant_fort"] },
    { numero: "07", libelle: "Peintures", companyName: "Coloria SARL", montant: "78000", activites: ["peintures_interieures"] },
  ];
  const crecheExisting = await db.query.operations.findFirst({
    where: and(
      eq(operations.organizationId, org.id),
      eq(operations.code, "CC"),
    ),
  });
  let crecheOpRow = crecheExisting;
  if (!crecheOpRow) {
    const moaCommune = moaByName.get("Mairie de Boulogne-Billancourt");
    if (!moaCommune) throw new Error("MOA Mairie introuvable pour Crèche.");
    const dateOs = new Date();
    dateOs.setFullYear(dateOs.getFullYear() - 2);
    const dateRecept = new Date();
    dateRecept.setMonth(dateRecept.getMonth() - 2);
    [crecheOpRow] = await db
      .insert(operations)
      .values({
        organizationId: org.id,
        code: "CC",
        name: "Crèche Cousteau",
        moaId: moaCommune.id,
        ville: "Boulogne-Billancourt",
        codePostal: "92100",
        dateOs,
        dateReceptionCible: dateRecept,
        dureePrevueJours: 700,
        montantPrevisionnelHt: "810000",
        statut: "dgd",
      })
      .returning();
  }
  if (!crecheOpRow) throw new Error("Crèche Cousteau op introuvable");

  // Lots + CPs payés + DGDs signés + PV + retentions
  let crecheLotCount = 0;
  let crecheDgdCount = 0;
  for (const cl of CRECHE_LOTS) {
    const existingLot = await db.query.lots.findFirst({
      where: and(
        eq(lots.operationId, crecheOpRow.id),
        eq(lots.numero, cl.numero),
      ),
    });
    let lotRow = existingLot;
    if (!lotRow) {
      const company = companyByName.get(cl.companyName);
      if (!company) continue;
      [lotRow] = await db
        .insert(lots)
        .values({
          operationId: crecheOpRow.id,
          numero: cl.numero,
          libelle: cl.libelle,
          companyId: company.id,
          montantMarcheHt: cl.montant,
          tauxTva: "20.00",
          modeRevision: "BT01",
          retenueGarantiePct: "5.00",
          delaiPaiementJours: 30,
          activitesAttendues: cl.activites,
          statut: "solde",
          decennaleCheckAt: new Date(),
        })
        .returning();
      crecheLotCount += 1;
    }
    if (!lotRow) continue;

    // CP payé à 100% (1 seul CP par lot pour simplicité Crèche).
    const cpNumero = `CP-CC-${cl.numero}-001`;
    const existingCp = await db.query.certificatsPaiement.findFirst({
      where: eq(certificatsPaiement.numero, cpNumero),
    });
    if (!existingCp) {
      const cpResult = computeCP({
        lot: {
          montantMarcheHt: cl.montant,
          retenueGarantiePct: "5.00",
          tauxTva: "20.00",
          avenantsSignes: [],
        },
        situation: { mode: "global", pctGlobal: "100" },
        previousCPs: [],
      });
      if (cpResult.ok) {
        const m = cpResult.data;
        const dateEmission = new Date();
        dateEmission.setMonth(dateEmission.getMonth() - 4);
        await db.insert(certificatsPaiement).values({
          operationId: crecheOpRow.id,
          lotId: lotRow.id,
          numero: cpNumero,
          periodeMois: dateEmission.getMonth() + 1,
          periodeAnnee: dateEmission.getFullYear(),
          cumulTravauxHt: m.cumulTravauxHt,
          cumulCpPrecedentsHt: m.cumulCpPrecedentsHt,
          brutAPayerHt: m.brutAPayerHt,
          retenueGarantie: m.retenueGarantie,
          revisionMontantHt: m.revisionMontantHt,
          tva: m.tva,
          netTtc: m.netTtc,
          statut: "paye",
          sentAt: new Date(dateEmission.getTime() + 2 * 24 * 60 * 60 * 1000),
          paidAt: new Date(dateEmission.getTime() + 25 * 24 * 60 * 60 * 1000),
          signedAt: new Date(dateEmission.getTime() + 1 * 24 * 60 * 60 * 1000),
          createdBy: ownerUserId,
          signedByUserId: ownerUserId,
        });
      }
    }

    // DGD signé
    const existingDgd = await db.query.dgds.findFirst({
      where: eq(dgds.lotId, lotRow.id),
    });
    if (!existingDgd) {
      const dgdResult = computeDGD({
        lot: {
          montantMarcheHt: cl.montant,
          tauxTva: "20.00",
          avenantsSignes: [],
        },
        cps: [
          { brutAPayerHt: (Number(cl.montant) * 0.95).toFixed(2), statut: "paye" },
        ],
      });
      if (dgdResult.ok) {
        const d = dgdResult.data;
        const signedAt = new Date();
        signedAt.setMonth(signedAt.getMonth() - 1);
        await db.insert(dgds).values({
          lotId: lotRow.id,
          marcheReviseHt: d.marcheReviseHt,
          travauxSupplAcceptesHt: d.travauxSupplAcceptesHt,
          penalitesHt: d.penalitesHt,
          cumulCpVersesHt: d.cumulCpVersesHt,
          soldeHt: d.soldeHt,
          soldeTtc: d.soldeTtc,
          statut: "signe",
          signedAt,
          signedByUserId: ownerUserId,
          computedAt: signedAt,
        });
        crecheDgdCount += 1;
      }
    }
  }

  // PV de réception signé sur Crèche
  const existingPv = await db.query.pvReceptions.findFirst({
    where: eq(pvReceptions.operationId, crecheOpRow.id),
  });
  if (!existingPv) {
    const dateRecept = new Date();
    dateRecept.setMonth(dateRecept.getMonth() - 2);
    await db.insert(pvReceptions).values({
      operationId: crecheOpRow.id,
      dateReception: dateRecept,
      avecReserves: "non",
      signedAt: dateRecept,
      signedByUserId: ownerUserId,
    });
  }

  // Retentions sur Crèche (toutes les lots solde)
  const crecheLots = await db.query.lots.findMany({
    where: eq(lots.operationId, crecheOpRow.id),
  });
  let crecheRetentionCount = 0;
  for (const lot of crecheLots) {
    const existing = await db.query.retentions.findFirst({
      where: eq(retentions.lotId, lot.id),
    });
    if (existing) continue;
    const dateRecept = new Date();
    dateRecept.setMonth(dateRecept.getMonth() - 2);
    const echeance = new Date(dateRecept);
    echeance.setFullYear(echeance.getFullYear() + 1);
    await db.insert(retentions).values({
      lotId: lot.id,
      montantRetenu: (Number(lot.montantMarcheHt) * 0.05).toFixed(2),
      dateReceptionLot: dateRecept,
      echeanceLiberation: echeance,
      statut: "en_cours",
    });
    crecheRetentionCount += 1;
  }

  // 1 caution en remplacement sur Crèche Lot 01 (gros œuvre)
  const crecheLot01 = crecheLots.find((l) => l.numero === "01");
  if (crecheLot01) {
    const existing = await db.query.cautions.findFirst({
      where: eq(cautions.lotId, crecheLot01.id),
    });
    if (!existing) {
      const dateEm = new Date();
      dateEm.setMonth(dateEm.getMonth() - 2);
      const dateExp = new Date(dateEm);
      dateExp.setFullYear(dateExp.getFullYear() + 1);
      const [newCaution] = await db
        .insert(cautions)
        .values({
          lotId: crecheLot01.id,
          montant: (Number(crecheLot01.montantMarcheHt) * 0.05).toFixed(2),
          dateEmission: dateEm,
          dateExpiration: dateExp,
          banque: "Crédit Agricole Île-de-France",
          numCaution: "RBQS-CC-01-001",
          statut: "active",
        })
        .returning();
      // Lie cette caution à la retention de Lot 01.
      const retLot01 = await db.query.retentions.findFirst({
        where: eq(retentions.lotId, crecheLot01.id),
      });
      if (retLot01) {
        await db
          .update(retentions)
          .set({ substitutedByCautionId: newCaution.id })
          .where(eq(retentions.id, retLot01.id));
      }
    }
  }
  console.log(
    `✓ Crèche Cousteau: ${crecheLotCount} lots, ${crecheDgdCount} DGDs signés, ${crecheRetentionCount} retentions`,
  );

  // 9. Logements Verdier — opération clôturée avec retention libérée
  //    Pour qu'on ait l'historique d'une op réception > 1 an, retenue libérée.
  const verdierExisting = await db.query.operations.findFirst({
    where: and(
      eq(operations.organizationId, org.id),
      eq(operations.code, "LV"),
    ),
  });
  let verdierOp = verdierExisting;
  if (!verdierOp) {
    const moaCommune = moaByName.get("Mairie de Boulogne-Billancourt");
    if (!moaCommune) throw new Error("MOA Mairie introuvable pour Verdier.");
    const dateOs = new Date();
    dateOs.setFullYear(dateOs.getFullYear() - 3);
    const dateRecept = new Date();
    dateRecept.setFullYear(dateRecept.getFullYear() - 1);
    dateRecept.setMonth(dateRecept.getMonth() - 2);
    [verdierOp] = await db
      .insert(operations)
      .values({
        organizationId: org.id,
        code: "LV",
        name: "Logements Verdier",
        moaId: moaCommune.id,
        ville: "Suresnes",
        codePostal: "92150",
        dateOs,
        dateReceptionCible: dateRecept,
        dureePrevueJours: 540,
        montantPrevisionnelHt: "640000",
        statut: "clos",
      })
      .returning();
  }
  if (!verdierOp) throw new Error("Logements Verdier op introuvable");

  // 1 lot stub + 1 retention libérée
  const verdierLotExisting = await db.query.lots.findFirst({
    where: and(
      eq(lots.operationId, verdierOp.id),
      eq(lots.numero, "01"),
    ),
  });
  let verdierLot = verdierLotExisting;
  if (!verdierLot) {
    const company = companyByName.get("SAS Beton+");
    if (company) {
      [verdierLot] = await db
        .insert(lots)
        .values({
          operationId: verdierOp.id,
          numero: "01",
          libelle: "Gros œuvre",
          companyId: company.id,
          montantMarcheHt: "640000",
          tauxTva: "20.00",
          modeRevision: "BT01",
          retenueGarantiePct: "5.00",
          delaiPaiementJours: 30,
          activitesAttendues: ["gros_oeuvre"],
          statut: "solde",
          decennaleCheckAt: new Date(),
        })
        .returning();
    }
  }
  if (verdierLot) {
    const existingRet = await db.query.retentions.findFirst({
      where: eq(retentions.lotId, verdierLot.id),
    });
    if (!existingRet) {
      const dateRecept = new Date();
      dateRecept.setFullYear(dateRecept.getFullYear() - 1);
      dateRecept.setMonth(dateRecept.getMonth() - 2);
      const echeance = new Date(dateRecept);
      echeance.setFullYear(echeance.getFullYear() + 1);
      const liberation = new Date(echeance);
      liberation.setDate(liberation.getDate() + 5);
      await db.insert(retentions).values({
        lotId: verdierLot.id,
        montantRetenu: "32000.00",
        dateReceptionLot: dateRecept,
        echeanceLiberation: echeance,
        dateLiberationReelle: liberation,
        statut: "liberee",
      });
    }
  }
  console.log("✓ Logements Verdier: 1 op clôturée + retention libérée");

  // 10. Sprint 7 — Honoraires sur RC (contrat signé + 3 situations) +
  //     EM (contrat brouillon avec missions) + Nathalie L. avec grant global.
  await seedHonoraires(org.id, ownerUserId);

  // 11. Sprint 8 — Trésorerie : 2 comptes bancaires + 3 mois de transactions
  //     + 6 charges récurrentes via MockBankProvider.
  await seedTresorerie(org.id);

  console.log("✅ Seed terminé !");
}

// ============================================================
// Sprint 7 — Cockpit Honoraires
// ============================================================

async function seedHonoraires(orgId: string, ownerUserId: string) {
  // Trouve RC + EM
  const rcOp = await db.query.operations.findFirst({
    where: and(eq(operations.organizationId, orgId), eq(operations.code, "RC")),
    with: { moa: { columns: { id: true } } },
  });
  const emOp = await db.query.operations.findFirst({
    where: and(eq(operations.organizationId, orgId), eq(operations.code, "EM")),
    with: { moa: { columns: { id: true } } },
  });

  // ---- RC : contrat signé + 6 missions + 3 situations ----
  if (rcOp) {
    const existing = await db.query.honoraireContracts.findFirst({
      where: eq(honoraireContracts.operationId, rcOp.id),
    });
    let rcContract = existing;
    if (!rcContract) {
      const dateSig = new Date();
      dateSig.setMonth(dateSig.getMonth() - 8);
      [rcContract] = await db
        .insert(honoraireContracts)
        .values({
          operationId: rcOp.id,
          moaId: rcOp.moaId ?? null,
          modeFacturation: "forfait",
          montantTotalHt: "96000.00",
          tauxTva: "20.00",
          delaiPaiementJours: 30,
          marcheReferenceHt: "612400.00",
          dateSignature: dateSig,
          statut: "en_execution",
          signedAt: dateSig,
          signedByUserId: ownerUserId,
          createdBy: ownerUserId,
        })
        .returning();
    }
    if (!rcContract) throw new Error("RC contract introuvable");

    const RC_MISSIONS: Array<{
      ordre: number;
      libelle: string;
      pct: string;
      avancement: string;
    }> = [
      { ordre: 1, libelle: "Esquisse (ESQ)", pct: "8.00", avancement: "100.00" },
      { ordre: 2, libelle: "APS · Avant-projet sommaire", pct: "12.00", avancement: "100.00" },
      { ordre: 3, libelle: "APD · Avant-projet définitif", pct: "18.00", avancement: "75.00" },
      { ordre: 4, libelle: "PRO · Études de projet", pct: "22.00", avancement: "0.00" },
      { ordre: 5, libelle: "ACT · Assistance contrats trav.", pct: "15.00", avancement: "0.00" },
      { ordre: 6, libelle: "DET · Direction de chantier", pct: "25.00", avancement: "0.00" },
    ];
    let rcMissionCount = 0;
    const rcMissionsByLibelle = new Map<string, string>();
    for (const m of RC_MISSIONS) {
      const exMission = await db.query.honoraireMissions.findFirst({
        where: and(
          eq(honoraireMissions.contractId, rcContract.id),
          eq(honoraireMissions.ordre, m.ordre),
        ),
      });
      if (exMission) {
        rcMissionsByLibelle.set(m.libelle, exMission.id);
        continue;
      }
      const montantCalcule = ((Number(m.pct) / 100) * 96000).toFixed(2);
      const [row] = await db
        .insert(honoraireMissions)
        .values({
          contractId: rcContract.id,
          libelle: m.libelle,
          ordre: m.ordre,
          typeValeur: "pct",
          pctDuTotal: m.pct,
          montantCalcule,
          pctAvancementCourant: m.avancement,
        })
        .returning();
      rcMissionsByLibelle.set(m.libelle, row.id);
      rcMissionCount += 1;
    }

    // 3 situations
    const situationsToCreate: Array<{
      missionLibelle: string;
      pctNouveau: string;
      pctPrec: string;
      statut: "payee" | "signee";
      dateEmission: Date;
      paid?: boolean;
    }> = [
      {
        missionLibelle: "Esquisse (ESQ)",
        pctNouveau: "100.00",
        pctPrec: "0.00",
        statut: "payee",
        dateEmission: new Date(new Date().setMonth(new Date().getMonth() - 7)),
      },
      {
        missionLibelle: "APS · Avant-projet sommaire",
        pctNouveau: "100.00",
        pctPrec: "0.00",
        statut: "payee",
        dateEmission: new Date(new Date().setMonth(new Date().getMonth() - 4)),
      },
      {
        missionLibelle: "APD · Avant-projet définitif",
        pctNouveau: "75.00",
        pctPrec: "0.00",
        statut: "signee",
        dateEmission: new Date(new Date().setDate(new Date().getDate() - 8)),
      },
    ];
    let rcSitCount = 0;
    for (const s of situationsToCreate) {
      const missionId = rcMissionsByLibelle.get(s.missionLibelle);
      if (!missionId) continue;
      const exSit = await db.query.honoraireSituations.findFirst({
        where: and(
          eq(honoraireSituations.contractId, rcContract.id),
          eq(honoraireSituations.missionId, missionId),
        ),
      });
      if (exSit) continue;

      const pctMission = Number(
        RC_MISSIONS.find((m) => m.libelle === s.missionLibelle)?.pct ?? "0",
      );
      const montantMissionHt = (pctMission / 100) * 96000;
      const delta = Number(s.pctNouveau) - Number(s.pctPrec);
      const montantHt = (delta / 100) * montantMissionHt;
      const montantTva = montantHt * 0.2;
      const montantTtc = montantHt + montantTva;

      const numbering = await nextNHNumber({
        organizationId: orgId,
        operationCode: "RC",
        operationId: rcOp.id,
        year: s.dateEmission.getFullYear(),
      });

      const signedAt = new Date(s.dateEmission);
      signedAt.setDate(signedAt.getDate() + 2);
      const sentAt = new Date(signedAt);
      sentAt.setDate(sentAt.getDate() + 1);
      const paidAt = s.statut === "payee" ? new Date(sentAt) : null;
      if (paidAt) paidAt.setDate(paidAt.getDate() + 14);

      await db.insert(honoraireSituations).values({
        contractId: rcContract.id,
        missionId,
        numero: numbering.numero,
        dateEmission: s.dateEmission,
        pctAvancementPrecedent: s.pctPrec,
        pctAvancementNouveau: s.pctNouveau,
        montantHt: montantHt.toFixed(2),
        montantTva: montantTva.toFixed(2),
        montantTtc: montantTtc.toFixed(2),
        statut: s.statut,
        signedAt,
        signedByUserId: ownerUserId,
        sentAt: s.statut !== "signee" ? sentAt : sentAt,
        paidAt: paidAt ?? null,
        createdBy: ownerUserId,
      });
      rcSitCount += 1;
    }
    console.log(
      `✓ Honoraires RC: contrat signé, ${rcMissionCount} missions, ${rcSitCount} situations`,
    );
  }

  // ---- EM : contrat brouillon + 6 missions saisies, pas signé ----
  if (emOp) {
    const existing = await db.query.honoraireContracts.findFirst({
      where: eq(honoraireContracts.operationId, emOp.id),
    });
    let emContract = existing;
    if (!emContract) {
      [emContract] = await db
        .insert(honoraireContracts)
        .values({
          operationId: emOp.id,
          moaId: emOp.moaId ?? null,
          modeFacturation: "forfait",
          montantTotalHt: "278400.00",
          tauxTva: "20.00",
          delaiPaiementJours: 30,
          marcheReferenceHt: "3500000.00",
          statut: "brouillon",
          createdBy: ownerUserId,
        })
        .returning();
    }
    if (!emContract) throw new Error("EM contract introuvable");

    const EM_MISSIONS: Array<{
      ordre: number;
      libelle: string;
      pct: string;
    }> = [
      { ordre: 1, libelle: "ESQ · Esquisse", pct: "7.00" },
      { ordre: 2, libelle: "APS · Avant-projet sommaire", pct: "10.00" },
      { ordre: 3, libelle: "APD · Avant-projet définitif", pct: "20.00" },
      { ordre: 4, libelle: "PRO · Études de projet", pct: "23.00" },
      { ordre: 5, libelle: "ACT · Assistance contrats trav.", pct: "15.00" },
      { ordre: 6, libelle: "DET · Direction de chantier", pct: "25.00" },
    ];
    let emMissionCount = 0;
    for (const m of EM_MISSIONS) {
      const exMission = await db.query.honoraireMissions.findFirst({
        where: and(
          eq(honoraireMissions.contractId, emContract.id),
          eq(honoraireMissions.ordre, m.ordre),
        ),
      });
      if (exMission) continue;
      const montantCalcule = ((Number(m.pct) / 100) * 278400).toFixed(2);
      await db.insert(honoraireMissions).values({
        contractId: emContract.id,
        libelle: m.libelle,
        ordre: m.ordre,
        typeValeur: "pct",
        pctDuTotal: m.pct,
        montantCalcule,
        pctAvancementCourant: "0.00",
      });
      emMissionCount += 1;
    }
    console.log(
      `✓ Honoraires EM: contrat brouillon, ${emMissionCount} missions saisies`,
    );
  }

  // ---- Nathalie L. (member) avec CockpitAccessGrant scope=global ----
  const NATHALIE_CLERK_ID = "seed_user_nathalie_l";
  let nathalie = await db.query.users.findFirst({
    where: eq(users.clerkUserId, NATHALIE_CLERK_ID),
  });
  if (!nathalie) {
    [nathalie] = await db
      .insert(users)
      .values({
        clerkUserId: NATHALIE_CLERK_ID,
        organizationId: orgId,
        email: "nathalie.l@atelier-habria.fr",
        name: "Nathalie Lemoine",
        role: "member",
      })
      .returning();
  }
  if (nathalie) {
    const exGrant = await db.query.cockpitAccessGrants.findFirst({
      where: and(
        eq(cockpitAccessGrants.organizationId, orgId),
        eq(cockpitAccessGrants.userId, nathalie.id),
        eq(cockpitAccessGrants.scope, "global"),
      ),
    });
    if (!exGrant) {
      await db.insert(cockpitAccessGrants).values({
        organizationId: orgId,
        userId: nathalie.id,
        scope: "global",
        operationId: null,
        grantedByUserId: ownerUserId,
      });
    }
  }
  console.log(
    `✓ Nathalie L. (member) avec grant Cockpit scope=global`,
  );
}

// ============================================================
// Sprint 8 — Cockpit Trésorerie
// ============================================================

async function seedTresorerie(orgId: string) {
  // 2 comptes via MockBankProvider (idempotent par externalAccountId)
  const { accounts } = await MockBankProvider.connectAccount({
    organizationId: orgId,
  });
  const accountByExternal = new Map<string, typeof bankAccounts.$inferSelect>();
  let accountsCreated = 0;
  for (const a of accounts) {
    const existing = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.organizationId, orgId),
        eq(bankAccounts.externalAccountId, a.externalAccountId),
      ),
    });
    if (existing) {
      accountByExternal.set(a.externalAccountId, existing);
      continue;
    }
    const [row] = await db
      .insert(bankAccounts)
      .values({
        organizationId: orgId,
        provider: "bridge",
        externalAccountId: a.externalAccountId,
        libelle: a.libelle,
        ibanLast4: a.ibanLast4 ?? null,
        currency: a.currency,
        currentBalance: a.currentBalance,
        lastSyncedAt: new Date(),
      })
      .returning();
    accountByExternal.set(a.externalAccountId, row);
    accountsCreated += 1;
  }

  // Transactions sur 3 mois
  let txCount = 0;
  for (const [externalId, accountRow] of accountByExternal.entries()) {
    const { transactions } = await MockBankProvider.syncTransactions({
      organizationId: orgId,
      externalAccountId: externalId,
    });
    for (const t of transactions) {
      const inserted = await db
        .insert(bankTransactions)
        .values({
          bankAccountId: accountRow.id,
          externalTxId: t.externalTxId,
          transactionDate: t.transactionDate,
          amountTtc: t.amountTtc,
          libelle: t.libelle,
          category: t.category,
          needsReconciliation: Number(t.amountTtc) > 0 ? false : true,
          source: "bank",
        })
        .onConflictDoNothing({
          target: [bankTransactions.bankAccountId, bankTransactions.externalTxId],
          where: sql`${bankTransactions.externalTxId} IS NOT NULL`,
        })
        .returning();
      if (inserted.length > 0) txCount += 1;
    }
  }

  // Réconciliation auto NH ↔ transactions entrantes (regex sur libellé)
  const NH_REGEX = /\b(NH-[A-Z]+-\d{4}-\d{3})\b/;
  const newTxs = await db.query.bankTransactions.findMany({
    where: inArray(
      bankTransactions.bankAccountId,
      [...accountByExternal.values()].map((a) => a.id),
    ),
  });
  let autoReconciled = 0;
  for (const tx of newTxs) {
    if (Number(tx.amountTtc ?? 0) <= 0) continue;
    if (tx.linkedHonoraireSituationId) continue;
    const m = NH_REGEX.exec(tx.libelle);
    if (!m) continue;
    const numero = m[1];
    const sit = await db.query.honoraireSituations.findFirst({
      where: eq(honoraireSituations.numero, numero),
    });
    if (!sit) continue;
    if (sit.statut === "payee") {
      // déjà payée mais on la lie quand même
      await db
        .update(bankTransactions)
        .set({
          linkedHonoraireSituationId: sit.id,
          needsReconciliation: false,
          category: "honoraires",
          updatedAt: new Date(),
        })
        .where(eq(bankTransactions.id, tx.id));
      autoReconciled += 1;
      continue;
    }
    await db
      .update(bankTransactions)
      .set({
        linkedHonoraireSituationId: sit.id,
        needsReconciliation: false,
        category: "honoraires",
        updatedAt: new Date(),
      })
      .where(eq(bankTransactions.id, tx.id));
    await db
      .update(honoraireSituations)
      .set({
        statut: "payee",
        paidAt: tx.transactionDate,
        updatedAt: new Date(),
      })
      .where(eq(honoraireSituations.id, sit.id));
    autoReconciled += 1;
  }

  // 6 charges récurrentes
  const RECURRING: Array<{
    libelle: string;
    category: string;
    montantHt: string;
    tauxTva: string;
    recurrence: "monthly" | "quarterly" | "yearly";
  }> = [
    { libelle: "Salaires (5 collaborateurs)", category: "salaires", montantHt: "14280.00", tauxTva: "0.00", recurrence: "monthly" },
    { libelle: "Loyer bureau · SCI Lemoine", category: "loyer_bureau", montantHt: "2850.00", tauxTva: "20.00", recurrence: "monthly" },
    { libelle: "Leasing véhicules (Arval) + carburant", category: "vehicules", montantHt: "1460.00", tauxTva: "20.00", recurrence: "monthly" },
    { libelle: "Logiciels & abonnements (Revit, Slack, …)", category: "logiciels", montantHt: "1240.00", tauxTva: "20.00", recurrence: "monthly" },
    { libelle: "Téléphonie + Internet (Free Pro)", category: "telecom", montantHt: "179.00", tauxTva: "20.00", recurrence: "monthly" },
    { libelle: "Assurance RCP + décennale (MMA)", category: "assurances", montantHt: "462.00", tauxTva: "0.00", recurrence: "monthly" },
    { libelle: "URSSAF Île-de-France", category: "charges_sociales", montantHt: "5860.00", tauxTva: "0.00", recurrence: "monthly" },
  ];
  let chargeCount = 0;
  for (const c of RECURRING) {
    const existing = await db.query.recurringCharges.findFirst({
      where: and(
        eq(recurringCharges.organizationId, orgId),
        eq(recurringCharges.libelle, c.libelle),
      ),
    });
    if (existing) continue;
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1);
    nextDue.setDate(5);
    await db.insert(recurringCharges).values({
      organizationId: orgId,
      libelle: c.libelle,
      category: c.category,
      montantHt: c.montantHt,
      tauxTva: c.tauxTva,
      recurrence: c.recurrence,
      nextDueDate: nextDue,
      active: true,
    });
    chargeCount += 1;
  }
  void MOCK_BANK_ACCOUNT_IDS;

  // EInvoice configuration mock Pennylane
  const existingConfig = await db.query.einvoiceConfigurations.findFirst({
    where: eq(einvoiceConfigurations.organizationId, orgId),
  });
  if (!existingConfig) {
    await db.insert(einvoiceConfigurations).values({
      organizationId: orgId,
      provider: "pennylane",
      externalOrgId: "mock-pennylane-org",
      active: true,
    });
  }

  console.log(
    `✓ Trésorerie: ${accountsCreated} comptes connectés, ${txCount} transactions, ${autoReconciled} NH rapprochées auto, ${chargeCount} charges récurrentes${existingConfig ? "" : " · PDP Pennylane configurée"}`,
  );

  // --------- Sprint 8 partie 2 — Rapprochement, expenses, einvoice ---------

  // Quelques expense_invoices (certaines rapprochées sur transactions, d'autres
  // qui restent à orphelines pour alimenter l'inbox)
  const txsForInvoices = await db.query.bankTransactions.findMany({
    where: inArray(
      bankTransactions.bankAccountId,
      [...accountByExternal.values()].map((a) => a.id),
    ),
  });
  // 1. Rattacher la transaction Castorama récente (achat fournitures 240€)
  const txCastorama = txsForInvoices.find((t) =>
    /castorama/i.test(t.libelle),
  );
  if (txCastorama) {
    const existing = await db.query.expenseInvoices.findFirst({
      where: and(
        eq(expenseInvoices.organizationId, orgId),
        eq(expenseInvoices.linkedTransactionId, txCastorama.id),
      ),
    });
    if (!existing) {
      await db.insert(expenseInvoices).values({
        organizationId: orgId,
        supplierName: "Castorama Boulogne",
        dateFacture: txCastorama.transactionDate,
        montantHt: "200.00",
        montantTva: "40.00",
        montantTtc: "240.00",
        tauxTva: "20.00",
        deductible: true,
        source: "pennylane",
        pennylaneExternalId: "pen-rcv-castorama-001",
        linkedTransactionId: txCastorama.id,
      });
      // Marque la tx comme ayant une facture attachée
      await db
        .update(bankTransactions)
        .set({ invoiceAttachedAt: new Date(), needsReconciliation: false })
        .where(eq(bankTransactions.id, txCastorama.id));
    }
  }

  // 2. Rattacher l'Esso carburant -72.10 du mois précédent (déjà catégorisé véhicules)
  const txEsso = txsForInvoices.find((t) => /esso/i.test(t.libelle));
  if (txEsso) {
    const existing = await db.query.expenseInvoices.findFirst({
      where: and(
        eq(expenseInvoices.organizationId, orgId),
        eq(expenseInvoices.linkedTransactionId, txEsso.id),
      ),
    });
    if (!existing) {
      const ttc = Math.abs(Number(txEsso.amountTtc ?? "72.10"));
      const ht = ttc / 1.2;
      const tva = ttc - ht;
      await db.insert(expenseInvoices).values({
        organizationId: orgId,
        supplierName: "Esso Boulogne",
        dateFacture: txEsso.transactionDate,
        montantHt: ht.toFixed(2),
        montantTva: tva.toFixed(2),
        montantTtc: ttc.toFixed(2),
        tauxTva: "20.00",
        deductible: true,
        source: "photo",
        ocrConfidence: 94,
        linkedTransactionId: txEsso.id,
      });
      await db
        .update(bankTransactions)
        .set({ invoiceAttachedAt: new Date(), needsReconciliation: false })
        .where(eq(bankTransactions.id, txEsso.id));
    }
  }

  // 3. VAT summary mois courant
  const today2 = new Date();
  const periodeAnnee = today2.getFullYear();
  const periodeMois = today2.getMonth() + 1;
  const existingVat = await db.query.vatSummaries.findFirst({
    where: and(
      eq(vatSummaries.organizationId, orgId),
      eq(vatSummaries.periodeAnnee, periodeAnnee),
      eq(vatSummaries.periodeMois, periodeMois),
    ),
  });
  if (!existingVat) {
    await db.insert(vatSummaries).values({
      organizationId: orgId,
      periodeAnnee,
      periodeMois,
      tvaCollectee: "11000.00",
      tvaDeductible: "4168.00",
      tvaDue: "6832.00",
      statut: "brouillon",
    });
  }

  // 4. einvoice_events pour les 3 NH déjà émises (RC-001/002/003)
  const nhRefs = ["NH-RC-2026-001", "NH-RC-2026-002", "NH-RC-2026-003"];
  for (const numero of nhRefs) {
    const sit = await db.query.honoraireSituations.findFirst({
      where: eq(honoraireSituations.numero, numero),
    });
    if (!sit) continue;
    const existing = await db.query.einvoiceEvents.findFirst({
      where: eq(einvoiceEvents.honoraireSituationId, sit.id),
    });
    if (existing) continue;
    const occurredAt = new Date(sit.dateEmission);
    occurredAt.setDate(occurredAt.getDate() + 1);
    const status = sit.statut === "payee" ? "payee" : "transmise";
    await db.insert(einvoiceEvents).values({
      honoraireSituationId: sit.id,
      direction: "out",
      status,
      occurredAt,
      rawPayload: {
        externalId: `pen-out-${numero}`,
        provider: "pennylane",
        numero,
      },
    });
  }

  console.log("✓ Expenses + VAT + einvoice events");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
