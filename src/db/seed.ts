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

import { and, eq, sql } from "drizzle-orm";

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
} from "./schema/operations";

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

  console.log("✅ Seed terminé !");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
