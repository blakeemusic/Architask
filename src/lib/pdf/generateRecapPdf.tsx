import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { formatMoneyForPdf } from "@/lib/format";
import { getInitials } from "@/lib/utils";

/**
 * Récap chantier PDF — vue agence pour réunions COPIL MOA.
 */

const COLORS = {
  primary: "#0B0B0F",
  secondary: "#5F6675",
  tertiary: "#9AA0AB",
  border: "#E4E6EB",
  surface2: "#EEEFF2",
  mintLight: "#DCFCE7",
  mintDark: "#064E2C",
  lilacLight: "#EDE9FE",
  lilacDark: "#3B1B7A",
  brand: "#1F2DEA",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    color: COLORS.primary,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  agencyLogo: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 11,
  },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 10, color: COLORS.secondary, marginTop: 4 },
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surface2,
  },
  kpiCardBlack: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
  },
  kpiCardMint: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: COLORS.mintLight,
  },
  kpiCardLilac: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: COLORS.lilacLight,
  },
  kpiLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 700,
    color: COLORS.tertiary,
  },
  kpiLabelDark: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 700,
    color: "rgba(255,255,255,0.6)",
  },
  kpiValue: { fontSize: 18, fontWeight: 700, marginTop: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 8,
  },
  table: { borderTop: 0.5, borderTopColor: COLORS.border },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: 0.3,
    borderBottomColor: COLORS.border,
  },
  head: {
    backgroundColor: COLORS.surface2,
    fontSize: 8,
    textTransform: "uppercase",
    fontWeight: 700,
    color: COLORS.tertiary,
  },
  cellLot: { flex: 3, paddingHorizontal: 6 },
  cellMarche: { flex: 2, textAlign: "right", paddingHorizontal: 6 },
  cellCp: { flex: 2, textAlign: "right", paddingHorizontal: 6 },
  cellPct: { flex: 1, textAlign: "right", paddingHorizontal: 6 },
  pillNeutral: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.surface2,
    color: COLORS.secondary,
    fontSize: 8,
    fontWeight: 700,
    alignSelf: "flex-start",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: COLORS.tertiary,
    textAlign: "center",
  },
});

export type RecapPdfData = {
  operationName: string;
  operationCode: string;
  ville: string | null;
  moaName: string | null;
  dateOs: Date | null;
  dateReceptionCible: Date | null;
  marcheReviseHt: string;
  cumulCpHt: string;
  restantHt: string;
  retenueHt: string;
  lots: Array<{
    numero: string;
    libelle: string;
    company: string;
    marcheLotRevise: string;
    cumulCpLot: string;
    pctAvancement: number;
  }>;
  avenants: Array<{
    lotNumero: string;
    numero: number;
    objet: string;
    montantHt: string;
    impactDelaiJours: number;
    dateSignature: Date | null;
  }>;
  reserves: Array<{
    lotNumero: string;
    description: string;
    statut: "a_lever" | "en_cours" | "levee";
  }>;
  agency: { name: string; initials: string };
  generatedAt: Date;
};

function formatDateFr(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type GenerateRecapPdfInput = RecapPdfData;

export async function generateRecapPdf(
  input: GenerateRecapPdfInput,
): Promise<Buffer> {
  console.info("[PDF] generateRecapPdf", {
    operation: input.operationName,
    nbLots: input.lots.length,
  });
  return await renderToBuffer(<RecapDocument data={input} />);
}

export function buildRecapData(input: {
  operation: {
    code: string;
    name: string;
    ville: string | null;
    dateOs: Date | null;
    dateReceptionCible: Date | null;
    moa: { raisonSociale: string } | null;
  };
  lots: Array<{
    numero: string;
    libelle: string;
    montantMarcheHt: string;
    company: { raisonSociale: string } | null;
    avenants: Array<{
      numero: number;
      objet: string;
      montantHt: string | null;
      impactDelaiJours: number;
      dateSignature: Date | null;
      statut: string;
    }>;
  }>;
  cpsByLot: Map<string, number>; // lotId → cumul brut HT
  cpsByLotMap: Map<string, string>; // lotNumero → lotId map alternative
  cpCumulHt: number;
  retenueHt: number;
  reserves: Array<{
    lot: { numero: string };
    description: string;
    statut: "a_lever" | "en_cours" | "levee";
  }>;
  organizationName: string;
}): RecapPdfData {
  let marcheInitialTotal = 0;
  let avenantsSignesTotal = 0;
  const lotsData = input.lots.map((l) => {
    const marcheInitial = Number(l.montantMarcheHt ?? 0);
    const avenantsSignes = l.avenants
      .filter((a) => a.statut === "signe")
      .reduce((s, a) => s + Number(a.montantHt ?? 0), 0);
    const marcheLotRevise = marcheInitial + avenantsSignes;
    marcheInitialTotal += marcheInitial;
    avenantsSignesTotal += avenantsSignes;
    const cumulCpLot = input.cpsByLot.get(input.cpsByLotMap.get(l.numero) ?? "") ?? 0;
    const pct =
      marcheLotRevise > 0 ? Math.round((cumulCpLot / marcheLotRevise) * 100) : 0;
    return {
      numero: l.numero,
      libelle: l.libelle,
      company: l.company?.raisonSociale ?? "—",
      marcheLotRevise: marcheLotRevise.toFixed(2),
      cumulCpLot: cumulCpLot.toFixed(2),
      pctAvancement: pct,
    };
  });
  const marcheRevise = marcheInitialTotal + avenantsSignesTotal;
  const restant = marcheRevise - input.cpCumulHt;

  const avenantsSignesList = input.lots.flatMap((l) =>
    l.avenants
      .filter((a) => a.statut === "signe")
      .map((a) => ({
        lotNumero: l.numero,
        numero: a.numero,
        objet: a.objet,
        montantHt: (a.montantHt ?? "0"),
        impactDelaiJours: a.impactDelaiJours,
        dateSignature: a.dateSignature,
      })),
  );

  return {
    operationName: input.operation.name,
    operationCode: input.operation.code,
    ville: input.operation.ville,
    moaName: input.operation.moa?.raisonSociale ?? null,
    dateOs: input.operation.dateOs,
    dateReceptionCible: input.operation.dateReceptionCible,
    marcheReviseHt: marcheRevise.toFixed(2),
    cumulCpHt: input.cpCumulHt.toFixed(2),
    restantHt: restant.toFixed(2),
    retenueHt: input.retenueHt.toFixed(2),
    lots: lotsData,
    avenants: avenantsSignesList,
    reserves: input.reserves.map((r) => ({
      lotNumero: r.lot.numero,
      description: r.description,
      statut: r.statut,
    })),
    agency: {
      name: input.organizationName,
      initials: getInitials(input.organizationName),
    },
    generatedAt: new Date(),
  };
}

function RecapDocument({ data }: { data: RecapPdfData }) {
  return (
    <Document title={`Récap chantier — ${data.operationName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.agencyLogo}>{data.agency.initials}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 700 }}>{data.agency.name}</Text>
              <Text style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}>
                Maître d&apos;œuvre
              </Text>
            </View>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontSize: 9, color: COLORS.secondary }}>
              Récap chantier — généré le {formatDateFr(data.generatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{data.operationName}</Text>
        <Text style={styles.subtitle}>
          {data.operationCode}
          {data.ville ? ` · ${data.ville}` : ""}
          {data.moaName ? ` · MOA ${data.moaName}` : ""}
          {data.dateOs ? ` · OS ${formatDateFr(data.dateOs)}` : ""}
          {data.dateReceptionCible
            ? ` · Réception cible ${formatDateFr(data.dateReceptionCible)}`
            : ""}
        </Text>

        {/* 4 KPI hero */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Marché révisé HT</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(data.marcheReviseHt)} €
            </Text>
          </View>
          <View style={styles.kpiCardBlack}>
            <Text style={styles.kpiLabelDark}>Cumul CP émis</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(data.cumulCpHt)} €
            </Text>
          </View>
          <View style={styles.kpiCardMint}>
            <Text style={styles.kpiLabel}>Restant à facturer</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(data.restantHt)} €
            </Text>
          </View>
          <View style={styles.kpiCardLilac}>
            <Text style={styles.kpiLabel}>Retenue</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(data.retenueHt)} €
            </Text>
          </View>
        </View>

        {/* Tableau lots */}
        <Text style={styles.sectionTitle}>Récap par lot</Text>
        <View style={styles.table}>
          <View style={{ ...styles.row, ...styles.head }}>
            <Text style={styles.cellLot}>Lot · Entreprise</Text>
            <Text style={styles.cellMarche}>Marché révisé</Text>
            <Text style={styles.cellCp}>CP cumulés</Text>
            <Text style={styles.cellPct}>%</Text>
          </View>
          {data.lots.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cellLot}>
                {l.numero} · {l.libelle} — {l.company}
              </Text>
              <Text style={styles.cellMarche}>
                {formatMoneyForPdf(l.marcheLotRevise)} €
              </Text>
              <Text style={styles.cellCp}>
                {formatMoneyForPdf(l.cumulCpLot)} €
              </Text>
              <Text style={styles.cellPct}>{l.pctAvancement} %</Text>
            </View>
          ))}
        </View>

        {/* Avenants */}
        {data.avenants.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Avenants signés</Text>
            <View style={styles.table}>
              <View style={{ ...styles.row, ...styles.head }}>
                <Text style={styles.cellLot}>Lot · Objet</Text>
                <Text style={styles.cellMarche}>Montant HT</Text>
                <Text style={styles.cellPct}>Délai (j)</Text>
              </View>
              {data.avenants.map((a, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cellLot}>
                    AV-{a.lotNumero}-{String(a.numero).padStart(3, "0")} · {a.objet}
                  </Text>
                  <Text style={styles.cellMarche}>
                    {Number(a.montantHt) > 0 ? "+ " : ""}
                    {formatMoneyForPdf(a.montantHt)} €
                  </Text>
                  <Text style={styles.cellPct}>
                    {a.impactDelaiJours > 0 ? "+" : ""}
                    {a.impactDelaiJours}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Réserves */}
        {data.reserves.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>État des réserves</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ fontSize: 10 }}>
                {data.reserves.filter((r) => r.statut === "levee").length} levées /{" "}
                {data.reserves.filter((r) => r.statut !== "levee").length} ouvertes
              </Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Document récapitulatif établi par {data.agency.name} en application
          de la norme NF P03-001 (marché privé). Source de vérité financière
          du chantier à la date d&apos;édition.
        </Text>
      </Page>
    </Document>
  );
}
