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

import { sql } from "drizzle-orm";

import { db } from "./index";
import {
  companies,
  companyContacts,
  insurances,
  moas,
  moaContacts,
} from "./schema/annuaire";
import { organizations, users } from "./schema/auth";

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

  console.log("✅ Seed terminé !");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
