import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { lots } from "@/db/schema/operations";
import { dpgfLines as dpgfLinesSchema } from "@/db/schema/operations";
import { env } from "@/lib/env";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth";
import { formatMoneyForPdf } from "@/lib/format";

/**
 * Endpoint DEV uniquement : génère un PDF de situation type pour pouvoir
 * tester l'extraction OCR Claude Vision sans avoir un vrai PDF d'entreprise
 * sous la main. Bloqué en production.
 *
 * Usage : /api/dev/sample-situation-pdf?lotId=xxx → download le PDF.
 * Si le lot a une DPGF importée, on utilise ses lignes ; sinon on génère
 * des postes fictifs cohérents avec le libellé du lot.
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 18 },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#5F6675" },
  table: { marginTop: 12, borderTop: 0.5, borderTopColor: "#E4E6EB" },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: 0.3,
    borderBottomColor: "#E4E6EB",
  },
  head: {
    backgroundColor: "#EEEFF2",
    fontSize: 8,
    textTransform: "uppercase",
    color: "#5F6675",
    fontWeight: 700,
  },
  cellDesignation: { flex: 4, paddingHorizontal: 5 },
  cellUnit: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellQty: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellPct: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellAmount: { flex: 2, textAlign: "right", paddingHorizontal: 5 },
  total: {
    marginTop: 14,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: 700,
    fontSize: 12,
    borderTop: 1,
    borderTopColor: "#0B0B0F",
  },
});

export async function GET(req: Request) {
  if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint réservé au mode dev." },
      { status: 403 },
    );
  }

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(req.url);
  const lotId = url.searchParams.get("lotId");
  if (!lotId) {
    return NextResponse.json(
      { error: "Param lotId requis." },
      { status: 400 },
    );
  }

  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: {
      operation: {
        columns: { id: true, organizationId: true, name: true, code: true },
      },
      company: { columns: { raisonSociale: true, siret: true } },
    },
  });
  if (!lot || lot.operation.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  // Récupère les lignes DPGF si présentes, sinon génère des postes fictifs
  // basés sur le libellé du lot.
  const dpgfRows = await db.query.dpgfLines.findMany({
    where: eq(dpgfLinesSchema.lotId, lotId),
    orderBy: [asc(dpgfLinesSchema.ordre)],
  });

  type SitLine = {
    designation: string;
    unite: string;
    quantite: string;
    pct: number;
    cumulHt: number;
  };

  let situationLines: SitLine[];
  if (dpgfRows.length > 0) {
    situationLines = dpgfRows.slice(0, 8).map((row, i) => {
      const montantTotal = Number(row.montantTotalHt ?? 0);
      const pct = Math.min(100, 30 + i * 8);
      return {
        designation: row.designation,
        unite: row.unite ?? "—",
        quantite: row.quantite ?? "—",
        pct,
        cumulHt: Math.round((pct / 100) * montantTotal),
      };
    });
  } else {
    // Génère 5 postes fictifs à partir du libellé du lot.
    const marche = Number(lot.montantMarcheHt);
    const repart = [0.45, 0.20, 0.15, 0.12, 0.08];
    const baseDesignations = sampleDesignationsFor(lot.libelle);
    situationLines = baseDesignations.map((desig, i) => {
      const montantTotal = marche * repart[i];
      const pct = Math.min(100, 30 + i * 12);
      return {
        designation: desig,
        unite: "u.",
        quantite: "1",
        pct,
        cumulHt: Math.round((pct / 100) * montantTotal),
      };
    });
  }

  const totalCumul = situationLines.reduce((s, l) => s + l.cumulHt, 0);

  const SampleDoc = (
    <Document title={`Situation ${lot.numero} ${lot.libelle}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>
            Situation de travaux n° 1
          </Text>
          <Text style={styles.meta}>
            Entreprise : {lot.company?.raisonSociale ?? "—"}
            {lot.company?.siret ? ` · SIRET ${lot.company.siret}` : ""}
          </Text>
          <Text style={styles.meta}>
            Chantier : {lot.operation.name} · Lot {lot.numero} {lot.libelle}
          </Text>
          <Text style={styles.meta}>
            Période :{" "}
            {new Date().toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={{ ...styles.row, ...styles.head }}>
            <Text style={styles.cellDesignation}>Désignation</Text>
            <Text style={styles.cellUnit}>Unité</Text>
            <Text style={styles.cellQty}>Qté</Text>
            <Text style={styles.cellPct}>% Avt</Text>
            <Text style={styles.cellAmount}>Cumul HT</Text>
          </View>
          {situationLines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cellDesignation}>{line.designation}</Text>
              <Text style={styles.cellUnit}>{line.unite}</Text>
              <Text style={styles.cellQty}>{line.quantite}</Text>
              <Text style={styles.cellPct}>{line.pct} %</Text>
              <Text style={styles.cellAmount}>
                {formatMoneyForPdf(line.cumulHt, { decimals: 0 })} €
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.total}>
          <Text>Cumul travaux exécutés HT</Text>
          <Text>{formatMoneyForPdf(totalCumul, { decimals: 0 })} €</Text>
        </View>

        <Text style={{ marginTop: 22, fontSize: 9, color: "#5F6675" }}>
          PDF de DÉMO généré dynamiquement par Architask (NODE_ENV=dev). À
          drag-and-drop dans le drawer &quot;Nouveau CP&quot; pour tester l&apos;OCR
          Claude Vision.
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(SampleDoc);
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="situation-sample-${lot.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function sampleDesignationsFor(libelleLot: string): string[] {
  const lc = libelleLot.toLowerCase();
  if (lc.includes("gros") || lc.includes("oeuvre")) {
    return [
      "Terrassements généraux",
      "Fondations superficielles",
      "Voiles béton armé R+1",
      "Planchers haut RDC",
      "Voiles béton armé R+2",
    ];
  }
  if (lc.includes("charpente")) {
    return [
      "Charpente bois principale",
      "Fermettes industrielles",
      "Chevronnage et liteaunage",
      "Pose volige",
      "Faîtage et arêtiers",
    ];
  }
  if (lc.includes("couv")) {
    return [
      "Couverture zinc à joint debout",
      "Étanchéité solins",
      "Gouttières et descentes",
      "Souches et raccords",
      "Crochets et fixations",
    ];
  }
  if (lc.includes("menui")) {
    return [
      "Fenêtres alu R+1",
      "Portes-fenêtres alu RDC",
      "Volets battants",
      "Garde-corps acier",
      "Brise-soleil orientables",
    ];
  }
  if (lc.includes("plomb") || lc.includes("cvc")) {
    return [
      "Réseau alimentation eau froide",
      "VMC double flux",
      "Pompe à chaleur air-eau 12 kW",
      "Plancher chauffant RDC",
      "Évacuations EU/EV",
    ];
  }
  if (lc.includes("élec") || lc.includes("elec")) {
    return [
      "Tableau général basse tension",
      "Réseau courants forts RDC",
      "Réseau courants forts R+1",
      "Appareillage prises et inter",
      "Éclairage LED commun",
    ];
  }
  if (lc.includes("cloison") || lc.includes("plak")) {
    return [
      "Cloisons placo 72/48",
      "Faux plafonds Knauf",
      "Doublage isolant laine de verre",
      "Calfeutrement joints",
      "Trappes de visite",
    ];
  }
  if (lc.includes("peint") || lc.includes("color")) {
    return [
      "Préparation des supports",
      "Sous-couche glycéro",
      "Peinture acrylique mate 2 couches",
      "Peinture boiseries laque satinée",
      "Reprise et finitions",
    ];
  }
  // Default
  return [
    "Poste principal n°1",
    "Poste principal n°2",
    "Poste secondaire",
    "Finitions",
    "Travaux divers",
  ];
}

void and; // import gardé pour compatibilité future
