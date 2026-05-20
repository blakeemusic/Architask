import type { planningTasks } from "@/db/schema/operations";

type PlanningTask = typeof planningTasks.$inferSelect;
export type PlanningTaskStatus = PlanningTask["statut"];

/**
 * Statut d'une tâche planning déduit des dates (vue lecture).
 * On ne persiste pas ce statut automatiquement : l'utilisateur peut le figer
 * (ex: marquer "en_retard" manuellement même si la date de fin n'est pas
 * encore atteinte), via updatePlanningTask. Le statut auto est ce qu'on
 * affiche par défaut quand la valeur DB reste à "a_venir".
 */
export function computeAutoStatut(
  task: Pick<
    PlanningTask,
    | "dateDebutPrevue"
    | "dateFinPrevue"
    | "dateDebutReelle"
    | "dateFinReelle"
    | "statut"
  >,
  today: Date = new Date(),
): PlanningTaskStatus {
  // Si l'utilisateur a figé "termine" ou "en_retard", on respecte.
  if (task.statut === "termine" || task.statut === "en_retard") return task.statut;

  if (task.dateFinReelle) return "termine";
  if (task.dateDebutReelle) {
    if (task.dateFinPrevue && task.dateFinPrevue < today) return "en_retard";
    return "en_cours";
  }
  if (task.dateDebutPrevue && task.dateDebutPrevue <= today) {
    if (task.dateFinPrevue && task.dateFinPrevue < today) return "en_retard";
    return "en_cours";
  }
  return "a_venir";
}

export const STATUS_LABELS: Record<PlanningTaskStatus, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  en_retard: "En retard",
};

export const MILESTONE_LABELS: Record<string, string> = {
  os: "OS",
  demarrage_lot: "Démarrage",
  fin_lot: "Fin lot",
  reception: "Réception",
  dgd: "DGD",
  libere_retenue: "Libération RG",
  autre: "Jalon",
};

/** Couleur d'un jalon selon son kind. Utilisé pour les losanges. */
export const MILESTONE_COLORS: Record<string, string> = {
  os: "#4F5DFF",
  demarrage_lot: "#8B5CF6",
  fin_lot: "#8B5CF6",
  reception: "#B8F2D1",
  dgd: "#DDD6FE",
  libere_retenue: "#FCD34D",
  autre: "#9CA3AF",
};
