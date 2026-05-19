import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatMoneyForPdf } from "@/lib/format";

/**
 * Template DGD-Architask-v1 — Décompte Général Définitif NF P03-001.
 *
 * Police Helvetica + formatMoneyForPdf (formatage manuel ASCII pur).
 */

const COLORS = {
  primary: "#0B0B0F",
  secondary: "#5F6675",
  tertiary: "#9AA0AB",
  brand: "#1F2DEA",
  border: "#E4E6EB",
  surface2: "#EEEFF2",
  mint: "#DCFCE7",
  mintDark: "#064E2C",
  lilac: "#EDE9FE",
  lilacDark: "#3B1B7A",
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
  agencyMeta: { textAlign: "right", fontSize: 9, color: COLORS.secondary },
  titleBlock: { marginBottom: 22 },
  numero: { fontSize: 22, fontWeight: 700, letterSpacing: -0.6 },
  subtitle: { fontSize: 10, color: COLORS.secondary, marginTop: 4 },
  twoCols: { flexDirection: "row", gap: 24, marginBottom: 22 },
  col: { flex: 1 },
  label: {
    fontSize: 8,
    color: COLORS.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: { fontSize: 11, color: COLORS.primary, fontWeight: 600 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 14,
  },
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
  soldeCard: {
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  soldeLabel: { fontSize: 10, fontWeight: 700 },
  soldeValue: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  twoCardsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  ttcCard: {
    flex: 1,
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    padding: 12,
    borderRadius: 6,
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

export type DgdPdfData = {
  numero: string; // "DGD-RC-01"
  emissionDate: Date;
  marcheReviseHt: string;
  travauxSupplAcceptesHt: string;
  penalitesHt: string;
  cumulCpVersesHt: string;
  soldeHt: string;
  soldeTtc: string;
  isDuMoa: boolean;
  operationName: string;
  lotNumero: string;
  lotLibelle: string;
  entrepriseNom: string;
  entrepriseSiret?: string | null;
  agency: { name: string; initials: string };
  signedAt?: Date;
  signedByName?: string;
};

function formatDateFr(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DgdDocument({ data }: { data: DgdPdfData }) {
  const soldeBg = data.isDuMoa ? COLORS.lilac : COLORS.mint;
  const soldeColor = data.isDuMoa ? COLORS.lilacDark : COLORS.mintDark;
  const soldeTitle = data.isDuMoa
    ? "TROP-VERSÉ — Remboursement entreprise"
    : "SOLDE DÛ À L'ENTREPRISE";

  return (
    <Document
      title={`DGD ${data.numero}`}
      author={data.agency.name}
    >
      <Page size="A4" style={styles.page}>
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
            <Text style={{ marginTop: 4 }}>NF P03-001 · Marché privé</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.numero}>
            Décompte Général Définitif {data.numero}
          </Text>
          <Text style={styles.subtitle}>
            {data.operationName} · Lot {data.lotNumero} {data.lotLibelle}
          </Text>
        </View>

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

        <Text style={styles.sectionTitle}>Calcul du décompte</Text>
        <View style={styles.calcBlock}>
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>Marché révisé HT</Text>
            <Text style={{ fontWeight: 700 }}>
              {formatMoneyForPdf(data.marcheReviseHt)} €
            </Text>
          </View>
          {Number(data.travauxSupplAcceptesHt) > 0 && (
            <View style={styles.calcRow}>
              <Text style={{ color: COLORS.secondary }}>
                + Travaux suppl. acceptés
              </Text>
              <Text style={{ fontWeight: 600 }}>
                + {formatMoneyForPdf(data.travauxSupplAcceptesHt)} €
              </Text>
            </View>
          )}
          {Number(data.penalitesHt) > 0 && (
            <View style={styles.calcRow}>
              <Text style={{ color: COLORS.secondary }}>− Pénalités</Text>
              <Text style={{ fontWeight: 600 }}>
                − {formatMoneyForPdf(data.penalitesHt)} €
              </Text>
            </View>
          )}
          <View style={styles.calcRow}>
            <Text style={{ color: COLORS.secondary }}>
              − Cumul CP versés
            </Text>
            <Text style={{ fontWeight: 600 }}>
              − {formatMoneyForPdf(data.cumulCpVersesHt)} €
            </Text>
          </View>
        </View>

        {/* Solde HT en card colorée selon dû/trop-versé */}
        <View
          style={{
            ...styles.soldeCard,
            backgroundColor: soldeBg,
          }}
        >
          <Text style={{ ...styles.soldeLabel, color: soldeColor }}>
            {soldeTitle} (HT)
          </Text>
          <Text style={{ ...styles.soldeValue, color: soldeColor }}>
            {formatMoneyForPdf(data.soldeHt)} €
          </Text>
        </View>

        {/* TTC en card noire pour vision rapide */}
        <View style={styles.twoCardsRow}>
          <View style={styles.ttcCard}>
            <Text
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              Solde TTC
            </Text>
            <Text style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {formatMoneyForPdf(data.soldeTtc)} €
            </Text>
          </View>
        </View>

        {data.signedAt && (
          <View style={styles.signedBox}>
            <Text style={{ fontWeight: 700 }}>Signature électronique</Text>
            <Text style={{ color: COLORS.secondary, marginTop: 2 }}>
              Signé le {formatDateFr(data.signedAt)}
              {data.signedByName ? ` par ${data.signedByName}` : ""}.
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          Décompte Général Définitif établi en application de la norme
          NF P03-001 (marché privé). Vaut quitus pour l&apos;ensemble des
          obligations financières du marché. La libération de la retenue
          garantie reste due à l&apos;entreprise à l&apos;échéance prévue
          (1 an après la réception) sauf réserve résiduelle non levée.
        </Text>
      </Page>
    </Document>
  );
}
