import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { getInitials } from "@/lib/utils";

/**
 * Planning chantier PDF — vue agence pour réunions COPIL MOA.
 * Pattern emprunté à generateRecapPdf : header agence + tableau lots/jalons
 * + frise visuelle simplifiée par mois.
 */

const COLORS = {
  primary: "#0B0B0F",
  secondary: "#5F6675",
  tertiary: "#9AA0AB",
  border: "#E4E6EB",
  surface2: "#EEEFF2",
  brand: "#4F5DFF",
  violet: "#8B5CF6",
  mint: "#B8F2D1",
  lilac: "#DDD6FE",
  amber: "#FCD34D",
  danger: "#EF4444",
};

const STATUS_COLORS: Record<string, string> = {
  a_venir: COLORS.tertiary,
  en_cours: COLORS.brand,
  termine: "#10B981",
  en_retard: COLORS.danger,
};

const STATUS_LABELS_PDF: Record<string, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  en_retard: "En retard",
};

const MILESTONE_LABELS_PDF: Record<string, string> = {
  os: "Ordre de service",
  demarrage_lot: "Démarrage",
  fin_lot: "Fin lot",
  reception: "Réception",
  dgd: "DGD",
  libere_retenue: "Libération RG",
  autre: "Jalon",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 9,
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
    alignItems: "center",
  },
  head: {
    backgroundColor: COLORS.surface2,
    fontSize: 7,
    textTransform: "uppercase",
    fontWeight: 700,
    color: COLORS.tertiary,
  },
  cellLibelle: { flex: 3.5, paddingHorizontal: 6 },
  cellType: { flex: 1, paddingHorizontal: 4 },
  cellDate: { flex: 1.4, paddingHorizontal: 4, textAlign: "right" },
  cellPct: { flex: 0.8, paddingHorizontal: 4, textAlign: "right" },
  cellStatut: { flex: 1.4, paddingHorizontal: 6 },
  statutPill: {
    fontSize: 7,
    fontWeight: 700,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: "flex-start",
    color: "#FFFFFF",
  },
  // Frise
  frise: { marginTop: 8 },
  friseHeader: {
    flexDirection: "row",
    paddingBottom: 4,
    borderBottom: 0.5,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  friseLabel: { width: 130, fontSize: 8, color: COLORS.tertiary, fontWeight: 700 },
  friseRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 16,
  },
  friseMonth: {
    flex: 1,
    fontSize: 7,
    textAlign: "center",
    color: COLORS.tertiary,
    textTransform: "uppercase",
    fontWeight: 700,
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

export type PlanningPdfTask = {
  id: string;
  type: "lot" | "jalon";
  libelle: string;
  dateDebutPrevue: Date | null;
  dateFinPrevue: Date | null;
  dateDebutReelle: Date | null;
  dateFinReelle: Date | null;
  statut: "a_venir" | "en_cours" | "termine" | "en_retard";
  milestoneKind: string | null;
  pctAvancement?: number;
};

export type PlanningPdfData = {
  operationName: string;
  operationCode: string;
  ville: string | null;
  moaName: string | null;
  dateOs: Date | null;
  dateReceptionCible: Date | null;
  tasks: PlanningPdfTask[];
  agency: { name: string; initials: string };
  generatedAt: Date;
};

export async function generatePlanningPdf(data: PlanningPdfData): Promise<Buffer> {
  console.info("[PDF] generatePlanningPdf", {
    operation: data.operationName,
    nbTasks: data.tasks.length,
  });
  return await renderToBuffer(<PlanningDocument data={data} />);
}

export function buildPlanningPdfData(input: {
  operation: {
    code: string;
    name: string;
    ville: string | null;
    dateOs: Date | null;
    dateReceptionCible: Date | null;
    moa: { raisonSociale: string } | null;
  };
  tasks: PlanningPdfTask[];
  organizationName: string;
}): PlanningPdfData {
  return {
    operationName: input.operation.name,
    operationCode: input.operation.code,
    ville: input.operation.ville,
    moaName: input.operation.moa?.raisonSociale ?? null,
    dateOs: input.operation.dateOs,
    dateReceptionCible: input.operation.dateReceptionCible,
    tasks: input.tasks,
    agency: {
      name: input.organizationName,
      initials: getInitials(input.organizationName),
    },
    generatedAt: new Date(),
  };
}

function formatDateShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatDateFr(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PlanningDocument({ data }: { data: PlanningPdfData }) {
  // Fenêtre temporelle pour la frise
  const allDates: Date[] = [data.generatedAt];
  for (const t of data.tasks) {
    if (t.dateDebutPrevue) allDates.push(t.dateDebutPrevue);
    if (t.dateFinPrevue) allDates.push(t.dateFinPrevue);
  }
  if (data.dateOs) allDates.push(data.dateOs);
  if (data.dateReceptionCible) allDates.push(data.dateReceptionCible);

  let minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  let maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);

  const months: Date[] = [];
  const cur = new Date(minDate);
  while (cur <= maxDate) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  const span = Math.max(1, maxDate.getTime() - minDate.getTime());
  const ratio = (d: Date) =>
    Math.max(0, Math.min(1, (d.getTime() - minDate.getTime()) / span));

  // Tri : lots d'abord, jalons à la fin
  const sorted = [...data.tasks].sort((a, b) => {
    if (a.type !== b.type) return a.type === "lot" ? -1 : 1;
    return (
      (a.dateDebutPrevue?.getTime() ?? 0) - (b.dateDebutPrevue?.getTime() ?? 0)
    );
  });

  return (
    <Document title={`Planning — ${data.operationName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
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
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontSize: 9, color: COLORS.secondary }}>
              Planning — généré le {formatDateFr(data.generatedAt)}
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

        {/* Frise visuelle */}
        <Text style={styles.sectionTitle}>Frise du chantier</Text>
        <View style={styles.frise}>
          {/* Header mois */}
          <View style={styles.friseHeader}>
            <View style={{ width: 130 }} />
            {months.map((m, i) => (
              <Text key={i} style={styles.friseMonth}>
                {m.toLocaleDateString("fr-FR", { month: "short" })}{" "}
                {String(m.getFullYear()).slice(2)}
              </Text>
            ))}
          </View>
          {sorted.slice(0, 18).map((task) => {
            return (
              <View key={task.id} style={styles.friseRow}>
                <Text
                  style={{
                    width: 130,
                    fontSize: 7,
                    fontWeight: 700,
                    paddingRight: 6,
                  }}
                >
                  {task.libelle.length > 28
                    ? task.libelle.slice(0, 28) + "…"
                    : task.libelle}
                </Text>
                <View
                  style={{
                    flex: 1,
                    position: "relative",
                    height: 12,
                  }}
                >
                  {task.type === "lot" &&
                    task.dateDebutPrevue &&
                    task.dateFinPrevue && (
                      <>
                        <View
                          style={{
                            position: "absolute",
                            left: `${ratio(task.dateDebutPrevue) * 100}%`,
                            width: `${(ratio(task.dateFinPrevue) - ratio(task.dateDebutPrevue)) * 100}%`,
                            top: 4,
                            height: 4,
                            backgroundColor: COLORS.surface2,
                            borderRadius: 2,
                          }}
                        />
                        {task.pctAvancement !== undefined &&
                          task.pctAvancement > 0 && (
                            <View
                              style={{
                                position: "absolute",
                                left: `${ratio(task.dateDebutPrevue) * 100}%`,
                                width: `${(ratio(task.dateFinPrevue) - ratio(task.dateDebutPrevue)) * (task.pctAvancement / 100) * 100}%`,
                                top: 4,
                                height: 4,
                                backgroundColor: COLORS.brand,
                                borderRadius: 2,
                              }}
                            />
                          )}
                      </>
                    )}
                  {task.type === "jalon" && task.dateDebutPrevue && (
                    <View
                      style={{
                        position: "absolute",
                        left: `${ratio(task.dateDebutPrevue) * 100}%`,
                        top: 3,
                        width: 6,
                        height: 6,
                        backgroundColor: COLORS.violet,
                        transform: "translate(-50%, 0)",
                      }}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Tableau détail */}
        <Text style={styles.sectionTitle}>Détail des tâches</Text>
        <View style={styles.table}>
          <View style={{ ...styles.row, ...styles.head }}>
            <Text style={styles.cellLibelle}>Libellé</Text>
            <Text style={styles.cellType}>Type</Text>
            <Text style={styles.cellDate}>Début prévu</Text>
            <Text style={styles.cellDate}>Fin prévue</Text>
            <Text style={styles.cellDate}>Début réel</Text>
            <Text style={styles.cellDate}>Fin réelle</Text>
            <Text style={styles.cellPct}>%</Text>
            <Text style={styles.cellStatut}>Statut</Text>
          </View>
          {sorted.map((task) => (
            <View key={task.id} style={styles.row}>
              <Text style={styles.cellLibelle}>{task.libelle}</Text>
              <Text style={{ ...styles.cellType, color: COLORS.secondary }}>
                {task.type === "lot"
                  ? "Lot"
                  : (MILESTONE_LABELS_PDF[task.milestoneKind ?? "autre"] ??
                    "Jalon")}
              </Text>
              <Text style={styles.cellDate}>
                {formatDateShort(task.dateDebutPrevue)}
              </Text>
              <Text style={styles.cellDate}>
                {formatDateShort(task.dateFinPrevue)}
              </Text>
              <Text style={styles.cellDate}>
                {formatDateShort(task.dateDebutReelle)}
              </Text>
              <Text style={styles.cellDate}>
                {formatDateShort(task.dateFinReelle)}
              </Text>
              <Text style={styles.cellPct}>
                {task.type === "lot" && task.pctAvancement !== undefined
                  ? `${task.pctAvancement} %`
                  : "—"}
              </Text>
              <View style={styles.cellStatut}>
                <Text
                  style={{
                    ...styles.statutPill,
                    backgroundColor:
                      STATUS_COLORS[task.statut] ?? COLORS.tertiary,
                  }}
                >
                  {STATUS_LABELS_PDF[task.statut] ?? task.statut}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Planning chantier établi par {data.agency.name}. Document non
          contractuel — les délais réels peuvent être affectés par les avenants
          signés en cours de chantier.
        </Text>
      </Page>
    </Document>
  );
}
