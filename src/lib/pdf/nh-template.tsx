import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatMoneyForPdf } from "@/lib/format";

/**
 * Template Note d'honoraires Architask-v1.
 *
 * Police Helvetica + formatMoneyForPdf (ASCII pur, déjà validé en prod).
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
  ventBlock: {
    marginTop: 8,
    backgroundColor: COLORS.surface2,
    padding: 12,
    borderRadius: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    fontSize: 10,
  },
  rowStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: 700,
  },
  ttcCard: {
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ttcLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  ttcValue: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  signedBox: {
    marginTop: 18,
    padding: 10,
    backgroundColor: COLORS.surface2,
    borderRadius: 6,
    fontSize: 9,
  },
  legalBox: {
    marginTop: 18,
    fontSize: 8,
    color: COLORS.tertiary,
    lineHeight: 1.5,
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

export type NhPdfData = {
  numero: string; // "NH-RC-2026-001"
  emissionDate: Date;
  /** Données ventilation. */
  missionLibelle: string;
  pctAvancementPrecedent: string;
  pctAvancementNouveau: string;
  montantMissionHt: string;
  montantHt: string;
  tauxTva: string;
  montantTva: string;
  montantTtc: string;
  delaiPaiementJours: number;
  /** Contexte. */
  operationName: string;
  operationCode: string;
  moaNom: string;
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

function dueDateFromEmission(d: Date, delaiJours: number): Date {
  // Fin du mois d'émission + N jours (NF P03-001 façon "30 j fin de mois").
  const due = new Date(d);
  due.setMonth(due.getMonth() + 1);
  due.setDate(0); // dernier jour du mois d'émission
  due.setDate(due.getDate() + delaiJours);
  return due;
}

export function NhDocument({ data }: { data: NhPdfData }) {
  const dueDate = dueDateFromEmission(
    data.emissionDate,
    data.delaiPaiementJours,
  );

  return (
    <Document title={`Note d'honoraires ${data.numero}`} author={data.agency.name}>
      <Page size="A4" style={styles.page}>
        {/* Header agence */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.agencyLogo}>{data.agency.initials}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: 700 }}>
                {data.agency.name}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}>
                Maître d&apos;œuvre · Architecte
              </Text>
            </View>
          </View>
          <View style={styles.agencyMeta}>
            <Text style={{ fontWeight: 700, color: COLORS.primary, fontSize: 10 }}>
              Émise le {formatDateFr(data.emissionDate)}
            </Text>
            <Text style={{ marginTop: 4 }}>
              Échéance : {formatDateFr(dueDate)}
            </Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.numero}>Note d&apos;honoraires {data.numero}</Text>
          <Text style={styles.subtitle}>
            Opération {data.operationCode} · {data.operationName}
          </Text>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.col}>
            <Text style={styles.label}>Destinataire (MOA)</Text>
            <Text style={styles.value}>{data.moaNom}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Opération</Text>
            <Text style={styles.value}>{data.operationName}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ventilation</Text>
        <View style={styles.ventBlock}>
          <View style={styles.row}>
            <Text style={{ color: COLORS.secondary }}>Mission facturée</Text>
            <Text style={{ fontWeight: 700 }}>{data.missionLibelle}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: COLORS.secondary }}>Avancement précédent</Text>
            <Text>{data.pctAvancementPrecedent} %</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: COLORS.secondary }}>Avancement nouveau</Text>
            <Text style={{ fontWeight: 700 }}>
              {data.pctAvancementNouveau} %
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: COLORS.secondary }}>Montant mission HT</Text>
            <Text>{formatMoneyForPdf(data.montantMissionHt)} €</Text>
          </View>
          <View
            style={{
              ...styles.rowStrong,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              marginTop: 6,
              paddingTop: 8,
            }}
          >
            <Text>Montant à facturer HT</Text>
            <Text>{formatMoneyForPdf(data.montantHt)} €</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ color: COLORS.secondary }}>
              TVA ({data.tauxTva} %)
            </Text>
            <Text>{formatMoneyForPdf(data.montantTva)} €</Text>
          </View>
        </View>

        <View style={styles.ttcCard}>
          <Text style={styles.ttcLabel}>Net à payer TTC</Text>
          <Text style={styles.ttcValue}>
            {formatMoneyForPdf(data.montantTtc)} €
          </Text>
        </View>

        {data.signedAt && (
          <View style={styles.signedBox}>
            <Text style={{ fontWeight: 700 }}>Signature électronique</Text>
            <Text style={{ color: COLORS.secondary, marginTop: 2 }}>
              Signée le {formatDateFr(data.signedAt)}
              {data.signedByName ? ` par ${data.signedByName}` : ""}.
            </Text>
          </View>
        )}

        <View style={styles.legalBox}>
          <Text style={{ fontWeight: 700, color: COLORS.secondary }}>
            Mentions légales
          </Text>
          <Text style={{ marginTop: 3 }}>
            Note d&apos;honoraires émise en application de la loi n° 90-1258
            du 31/12/1990 relative à l&apos;exercice des professions
            d&apos;architecte, et des règles du contrat de maîtrise
            d&apos;œuvre.
          </Text>
          <Text style={{ marginTop: 3 }}>
            Conditions de paiement :{" "}
            {data.delaiPaiementJours} j fin de mois — règlement par virement à
            l&apos;ordre de {data.agency.name}. Aucune escompte pour paiement
            anticipé. Pénalités de retard au taux légal + indemnité forfaitaire
            de recouvrement (40 €).
          </Text>
          <Text style={{ marginTop: 3 }}>
            Cabinet inscrit à l&apos;Ordre des architectes — Assurance RCP &
            décennale en cours de validité.
          </Text>
        </View>

        <Text style={styles.footer}>
          Document généré par Architask · Note d&apos;honoraires
          {" "}{data.numero} · Opération {data.operationCode}
        </Text>
      </Page>
    </Document>
  );
}
