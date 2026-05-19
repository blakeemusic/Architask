import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { formatMoneyForPdf } from "@/lib/format";

/**
 * Template CP-Architask-v1 — @react-pdf/renderer
 *
 * Mentions légales NF P03-001 obligatoires dans le footer. Le bloc signature
 * est rendu uniquement si signedAt est fourni (statut "signé" en MVP).
 *
 * Police : Inter enregistrée via Font.register, en remplacement d'Helvetica
 * par défaut. Inter rend correctement tous les caractères Unicode FR (en
 * particulier U+202F narrow no-break space) — garantie supplémentaire en
 * complément du strip déjà fait dans formatMoneyForPdf.
 */

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://rsms.me/inter/font-files/Inter-Regular.woff?v=3.19",
      fontWeight: 400,
    },
    {
      src: "https://rsms.me/inter/font-files/Inter-SemiBold.woff?v=3.19",
      fontWeight: 600,
    },
    {
      src: "https://rsms.me/inter/font-files/Inter-Bold.woff?v=3.19",
      fontWeight: 700,
    },
  ],
});

const COLORS = {
  primary: "#0B0B0F",
  secondary: "#5F6675",
  tertiary: "#9AA0AB",
  brand: "#1F2DEA",
  border: "#E4E6EB",
  surface2: "#EEEFF2",
  mint: "#DCFCE7",
  mintDark: "#064E2C",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    color: COLORS.primary,
    fontFamily: "Inter",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
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
  agencyMeta: {
    textAlign: "right",
    fontSize: 9,
    color: COLORS.secondary,
  },
  titleBlock: {
    marginBottom: 22,
  },
  numero: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 4,
  },
  twoCols: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 22,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: COLORS.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 14,
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  tableHead: {
    backgroundColor: COLORS.surface2,
    fontSize: 8,
    textTransform: "uppercase",
    color: COLORS.tertiary,
    letterSpacing: 0.4,
    fontWeight: 700,
  },
  cellDesignation: { flex: 4, paddingHorizontal: 6 },
  cellUnit: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellQty: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellPct: { flex: 1, textAlign: "right", paddingHorizontal: 4 },
  cellAmount: { flex: 2, textAlign: "right", paddingHorizontal: 6 },
  calcBlock: {
    marginTop: 16,
    backgroundColor: COLORS.surface2,
    padding: 12,
    borderRadius: 6,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 10,
  },
  calcRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    fontSize: 13,
    fontWeight: 700,
  },
  netTtc: {
    backgroundColor: COLORS.mint,
    color: COLORS.mintDark,
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netTtcLabel: { fontSize: 10, fontWeight: 700 },
  netTtcValue: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  paymentBlock: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    fontSize: 9,
  },
  signedBox: {
    marginTop: 18,
    padding: 10,
    backgroundColor: COLORS.surface2,
    borderRadius: 6,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: COLORS.tertiary,
    textAlign: "center",
    lineHeight: 1.4,
  },
});

export type CpPdfData = {
  numero: string;
  periodeMois: number;
  periodeAnnee: number;
  emissionDate: Date;
  dueDate: Date | null;
  cumulTravauxHt: string;
  cumulCpPrecedentsHt: string;
  brutAPayerHt: string;
  retenueGarantie: string;
  revisionMontantHt: string | null;
  montantHt: string;
  tva: string;
  netTtc: string;
  tauxTva: string;
  delaiPaiementJours: number;
  /** Lignes du tableau ventilation (si pas de DPGF, table absente). */
  ventilation: Array<{
    designation: string;
    unite?: string | null;
    quantite?: string | null;
    pctAvancement: string;
    montantCumuleHt: string;
  }>;
  operationName: string;
  lotNumero: string;
  lotLibelle: string;
  entrepriseNom: string;
  entrepriseSiret?: string | null;
  agency: {
    name: string;
    initials: string;
  };
  signedAt?: Date;
  signedByName?: string;
};

/**
 * Wrapper local qui appelle formatMoneyForPdf depuis @/lib/format.
 * On le garde pour minimiser le diff avec le code existant (utilisé dans
 * tout le template). Tout le travail de stripping U+00A0/U+202F est fait
 * dans le helper centralisé.
 */
function formatEur(raw: string): string {
  return formatMoneyForPdf(raw, { decimals: 2 });
}

function formatDateFr(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CpDocument({ data }: { data: CpPdfData }) {
  return (
    <Document
      title={`Certificat de Paiement ${data.numero}`}
      author={data.agency.name}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.agencyLogo}>{data.agency.initials}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 700 }}>
                {data.agency.name}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}>
                Maître d&apos;œuvre
              </Text>
            </View>
          </View>
          <View style={styles.agencyMeta}>
            <Text style={{ fontWeight: 700, color: COLORS.primary, fontSize: 10 }}>
              Émis le {formatDateFr(data.emissionDate)}
            </Text>
            <Text>Échéance {formatDateFr(data.dueDate)}</Text>
            <Text style={{ marginTop: 4 }}>NF P03-001 · Marché privé</Text>
          </View>
        </View>

        {/* Titre */}
        <View style={styles.titleBlock}>
          <Text style={styles.numero}>
            Certificat de Paiement n° {data.numero}
          </Text>
          <Text style={styles.subtitle}>
            Période {String(data.periodeMois).padStart(2, "0")}/{data.periodeAnnee} ·{" "}
            {data.operationName} · Lot {data.lotNumero} {data.lotLibelle}
          </Text>
        </View>

        {/* Bénéficiaire / Lot */}
        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>Entreprise</Text>
            <Text style={styles.value}>{data.entrepriseNom}</Text>
            {data.entrepriseSiret && (
              <Text style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}>
                SIRET {data.entrepriseSiret}
              </Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Lot</Text>
            <Text style={styles.value}>
              {data.lotNumero} · {data.lotLibelle}
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}>
              {data.operationName}
            </Text>
          </View>
        </View>

        {/* Ventilation */}
        {data.ventilation.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Avancement des travaux</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={styles.cellDesignation}>Désignation</Text>
                <Text style={styles.cellUnit}>Unité</Text>
                <Text style={styles.cellQty}>Qté exéc.</Text>
                <Text style={styles.cellPct}>%</Text>
                <Text style={styles.cellAmount}>Cumul HT</Text>
              </View>
              {data.ventilation.map((line, i) => {
                const isLast = i === data.ventilation.length - 1;
                return (
                  <View
                    key={i}
                    style={isLast ? styles.tableRowLast : styles.tableRow}
                  >
                    <Text style={styles.cellDesignation}>{line.designation}</Text>
                    <Text style={styles.cellUnit}>{line.unite ?? "—"}</Text>
                    <Text style={styles.cellQty}>{line.quantite ?? "—"}</Text>
                    <Text style={styles.cellPct}>{line.pctAvancement} %</Text>
                    <Text style={styles.cellAmount}>
                      {formatEur(line.montantCumuleHt)} €
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Bloc calcul */}
        <Text style={styles.sectionTitle}>Calcul du certificat</Text>
        <View style={styles.calcBlock}>
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>Cumul travaux exécutés HT</Text>
            <Text style={{ fontWeight: 700 }}>{formatEur(data.cumulTravauxHt)} €</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>− Cumul CP précédents</Text>
            <Text style={{ fontWeight: 600 }}>
              {formatEur(data.cumulCpPrecedentsHt)} €
            </Text>
          </View>
          <View
            style={{
              ...styles.calcRow,
              borderTopWidth: 0.5,
              borderTopColor: COLORS.border,
              paddingTop: 5,
              marginTop: 3,
              fontWeight: 700,
            }}
          >
            <Text>Brut à payer HT</Text>
            <Text>{formatEur(data.brutAPayerHt)} €</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>− Retenue garantie</Text>
            <Text style={{ fontWeight: 600 }}>
              − {formatEur(data.retenueGarantie)} €
            </Text>
          </View>
          {data.revisionMontantHt &&
            Number(data.revisionMontantHt) !== 0 && (
              <View style={styles.calcRow}>
                <Text style={{ color: COLORS.secondary }}>+ Révision (BT01)</Text>
                <Text style={{ fontWeight: 600 }}>
                  {Number(data.revisionMontantHt) > 0 ? "+ " : ""}
                  {formatEur(data.revisionMontantHt)} €
                </Text>
              </View>
            )}
          <View
            style={{
              ...styles.calcRow,
              borderTopWidth: 0.5,
              borderTopColor: COLORS.border,
              paddingTop: 5,
              marginTop: 3,
              fontWeight: 700,
            }}
          >
            <Text>Montant HT</Text>
            <Text>{formatEur(data.montantHt)} €</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>+ TVA {data.tauxTva} %</Text>
            <Text style={{ fontWeight: 600 }}>+ {formatEur(data.tva)} €</Text>
          </View>
        </View>

        {/* Net TTC en mint */}
        <View style={styles.netTtc}>
          <Text style={styles.netTtcLabel}>NET À PAYER TTC</Text>
          <Text style={styles.netTtcValue}>{formatEur(data.netTtc)} €</Text>
        </View>

        {/* Paiement */}
        <View style={styles.paymentBlock}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>
            Modalités de paiement
          </Text>
          <Text style={{ color: COLORS.secondary }}>
            Délai de paiement : {data.delaiPaiementJours} jours fin de mois (NF P03-001).
          </Text>
          <Text style={{ color: COLORS.secondary, marginTop: 2 }}>
            Échéance : {formatDateFr(data.dueDate)}
          </Text>
          <Text style={{ color: COLORS.tertiary, marginTop: 6, fontSize: 8 }}>
            IBAN bénéficiaire : à compléter par l&apos;entreprise.
          </Text>
        </View>

        {/* Signature */}
        {data.signedAt && (
          <View style={styles.signedBox}>
            <Text style={{ fontWeight: 700 }}>Signature électronique</Text>
            <Text style={{ color: COLORS.secondary, marginTop: 2 }}>
              Signé le {formatDateFr(data.signedAt)}
              {data.signedByName ? ` par ${data.signedByName}` : ""}.
            </Text>
          </View>
        )}

        {/* Footer mentions */}
        <Text style={styles.footer}>
          Document établi en application de la norme NF P03-001 (marché privé).
          Sont reportées les références du marché, l&apos;identification des
          parties, le n° et la date du certificat, les montants HT/TVA/TTC, la
          retenue de garantie, le net à payer, le délai de paiement et les
          recours en cas de litige. Tout litige relève des tribunaux compétents.
        </Text>
      </Page>
    </Document>
  );
}
