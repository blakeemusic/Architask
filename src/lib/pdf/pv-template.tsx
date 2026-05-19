import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

/**
 * Template PV de Réception — NF P03-001.
 */

const COLORS = {
  primary: "#0B0B0F",
  secondary: "#5F6675",
  tertiary: "#9AA0AB",
  border: "#E4E6EB",
  surface2: "#EEEFF2",
  warning: "#F59E0B",
  success: "#16A34A",
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
  titleBlock: { marginBottom: 22 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: -0.6 },
  subtitle: { fontSize: 10, color: COLORS.secondary, marginTop: 4 },
  block: {
    backgroundColor: COLORS.surface2,
    padding: 14,
    borderRadius: 8,
    marginTop: 14,
  },
  blockTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  pillSuccess: {
    padding: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 700,
    backgroundColor: "#DCFCE7",
    color: COLORS.success,
    alignSelf: "flex-start",
  },
  pillWarning: {
    padding: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 700,
    backgroundColor: "rgba(245,158,11,0.15)",
    color: COLORS.warning,
    alignSelf: "flex-start",
  },
  table: {
    marginTop: 10,
    borderTop: 0.5,
    borderTopColor: COLORS.border,
  },
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
    color: COLORS.secondary,
    fontWeight: 700,
  },
  cellLot: { flex: 1, paddingHorizontal: 6 },
  cellDesc: { flex: 4, paddingHorizontal: 6 },
  cellStatut: { flex: 1, textAlign: "right", paddingHorizontal: 6 },
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

export type PvPdfData = {
  dateReception: Date;
  avecReserves: boolean;
  operationName: string;
  operationAdresse: string | null;
  moaName: string | null;
  reserves: Array<{
    lotNumero: string;
    lotLibelle: string;
    description: string;
    statut: "a_lever" | "en_cours" | "levee";
    dateLevee: Date | null;
  }>;
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

const STATUT_LABEL: Record<PvPdfData["reserves"][number]["statut"], string> = {
  a_lever: "À lever",
  en_cours: "En cours",
  levee: "Levée",
};

export function PvDocument({ data }: { data: PvPdfData }) {
  return (
    <Document
      title={`PV de Réception — ${data.operationName}`}
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
              <Text
                style={{ fontSize: 9, color: COLORS.secondary, marginTop: 2 }}
              >
                Maître d&apos;œuvre
              </Text>
            </View>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text
              style={{ fontWeight: 700, color: COLORS.primary, fontSize: 10 }}
            >
              Réception du {formatDateFr(data.dateReception)}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 9, color: COLORS.secondary }}>
              NF P03-001 · Marché privé
            </Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Procès-verbal de réception</Text>
          <Text style={styles.subtitle}>
            {data.operationName}
            {data.operationAdresse ? ` · ${data.operationAdresse}` : ""}
            {data.moaName ? ` · MOA ${data.moaName}` : ""}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Modalités de réception</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Text
              style={
                data.avecReserves ? styles.pillWarning : styles.pillSuccess
              }
            >
              {data.avecReserves ? "AVEC RÉSERVES" : "SANS RÉSERVE"}
            </Text>
            <Text style={{ fontSize: 10, color: COLORS.secondary, marginTop: 3 }}>
              Date de réception : {formatDateFr(data.dateReception)}
            </Text>
          </View>
        </View>

        {data.reserves.length > 0 && (
          <>
            <Text
              style={{ fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6 }}
            >
              Réserves relevées
            </Text>
            <View style={styles.table}>
              <View style={{ ...styles.row, ...styles.head }}>
                <Text style={styles.cellLot}>Lot</Text>
                <Text style={styles.cellDesc}>Description</Text>
                <Text style={styles.cellStatut}>Statut</Text>
              </View>
              {data.reserves.map((r, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cellLot}>{r.lotNumero}</Text>
                  <Text style={styles.cellDesc}>{r.description}</Text>
                  <Text style={styles.cellStatut}>{STATUT_LABEL[r.statut]}</Text>
                </View>
              ))}
            </View>
          </>
        )}

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
          Procès-verbal établi en application de la norme NF P03-001
          (marché privé). La réception constitue le point de départ du délai
          de garantie de parfait achèvement (1 an) et de la garantie
          décennale. Les réserves figurant au présent PV doivent être
          levées dans le délai imparti.
        </Text>
      </Page>
    </Document>
  );
}
