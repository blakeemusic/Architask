"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  createPlanningTask,
  deletePlanningTask,
  updatePlanningTask,
} from "@/server/actions/operations/planning";

const MILESTONE_KINDS = [
  "os",
  "demarrage_lot",
  "fin_lot",
  "reception",
  "dgd",
  "libere_retenue",
  "autre",
] as const;

const STATUS_VALUES = ["a_venir", "en_cours", "termine", "en_retard"] as const;

const MILESTONE_OPTIONS: { value: (typeof MILESTONE_KINDS)[number]; label: string }[] = [
  { value: "autre", label: "Jalon libre" },
  { value: "os", label: "Ordre de service" },
  { value: "demarrage_lot", label: "Démarrage lot" },
  { value: "fin_lot", label: "Fin lot" },
  { value: "reception", label: "Réception" },
  { value: "dgd", label: "DGD" },
  { value: "libere_retenue", label: "Libération retenue" },
];

const STATUS_OPTIONS: { value: (typeof STATUS_VALUES)[number]; label: string }[] = [
  { value: "a_venir", label: "À venir" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "en_retard", label: "En retard" },
];

const Schema = z
  .object({
    libelle: z.string().min(1, "Libellé obligatoire.").max(160),
    dateDebutPrevue: z.string().optional(),
    dateFinPrevue: z.string().optional(),
    dateDebutReelle: z.string().optional(),
    dateFinReelle: z.string().optional(),
    statut: z.enum(STATUS_VALUES),
    milestoneKind: z.enum(MILESTONE_KINDS).optional(),
  })
  .refine(
    (v) => {
      if (!v.dateDebutPrevue || !v.dateFinPrevue) return true;
      return v.dateFinPrevue >= v.dateDebutPrevue;
    },
    {
      path: ["dateFinPrevue"],
      message: "La fin prévue doit être après le début.",
    },
  );

type FormValues = z.infer<typeof Schema>;

export interface PlanningTaskDrawerTask {
  id: string;
  type: "lot" | "jalon";
  libelle: string;
  dateDebutPrevue: Date | null;
  dateFinPrevue: Date | null;
  dateDebutReelle: Date | null;
  dateFinReelle: Date | null;
  statut: (typeof STATUS_VALUES)[number];
  milestoneKind: string | null;
}

export function PlanningTaskDrawer({
  open,
  onOpenChange,
  mode,
  operationId,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  operationId: string;
  task?: PlanningTaskDrawerTask | null;
}) {
  const router = useRouter();
  const isLot = mode === "edit" && task?.type === "lot";

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: defaultsFromTask(task),
  });

  React.useEffect(() => {
    if (open) {
      form.reset(defaultsFromTask(task));
    }
  }, [open, task, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const milestone =
      values.milestoneKind && MILESTONE_KINDS.includes(values.milestoneKind)
        ? values.milestoneKind
        : null;
    if (mode === "create") {
      const res = await createPlanningTask({
        operationId,
        type: "jalon",
        libelle: values.libelle,
        dateDebutPrevue: parseDate(values.dateDebutPrevue),
        dateFinPrevue: parseDate(values.dateFinPrevue ?? values.dateDebutPrevue),
        milestoneKind: milestone,
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "Création impossible.");
        return;
      }
      toast.success("Jalon ajouté ✓");
    } else if (task) {
      const res = await updatePlanningTask({
        id: task.id,
        libelle: values.libelle,
        dateDebutPrevue: parseDate(values.dateDebutPrevue),
        dateFinPrevue: parseDate(values.dateFinPrevue),
        dateDebutReelle: parseDate(values.dateDebutReelle),
        dateFinReelle: parseDate(values.dateFinReelle),
        statut: values.statut,
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "Mise à jour impossible.");
        return;
      }
      toast.success("Tâche mise à jour ✓");
    }
    onOpenChange(false);
    router.refresh();
  });

  const onDelete = async () => {
    if (!task) return;
    if (!confirm(`Supprimer "${task.libelle}" ? Cette action est irréversible.`)) return;
    const res = await deletePlanningTask({ id: task.id });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Jalon supprimé.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={560}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Planning · {isLot ? "Lot" : "Jalon"}
            </div>
            <h2 className="title-xl mt-2">
              {mode === "create" ? "Nouveau jalon" : task?.libelle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)" }}
          >
            <CloseIcon />
          </button>
        </div>
      </DrawerHeader>

      <DrawerBody>
        <form onSubmit={onSubmit} id="planning-task-form" className="space-y-4">
          <Field
            label="Libellé *"
            error={form.formState.errors.libelle?.message}
            hint={
              isLot
                ? "Libellé verrouillé : édite le lot pour le modifier."
                : undefined
            }
          >
            <input
              {...form.register("libelle")}
              type="text"
              readOnly={isLot}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                opacity: isLot ? 0.6 : 1,
              }}
            />
          </Field>

          {mode === "create" && (
            <Field label="Type de jalon">
              <select
                {...form.register("milestoneKind")}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {MILESTONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Début prévu"
              error={form.formState.errors.dateDebutPrevue?.message}
            >
              <DateInput {...form.register("dateDebutPrevue")} />
            </Field>
            <Field
              label="Fin prévue"
              error={form.formState.errors.dateFinPrevue?.message}
            >
              <DateInput {...form.register("dateFinPrevue")} />
            </Field>
          </div>

          {mode === "edit" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début réel">
                  <DateInput {...form.register("dateDebutReelle")} />
                </Field>
                <Field label="Fin réelle">
                  <DateInput {...form.register("dateFinReelle")} />
                </Field>
              </div>
              <Field label="Statut">
                <select
                  {...form.register("statut")}
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </form>
      </DrawerBody>

      <DrawerFooter>
        <div className="flex-1">
          {mode === "edit" && task?.type === "jalon" && (
            <Button
              variant="ghost"
              onClick={onDelete}
              disabled={form.formState.isSubmitting}
            >
              <span style={{ color: "var(--danger)" }}>Supprimer</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="planning-task-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Enregistrement…"
              : mode === "create"
                ? "Ajouter le jalon"
                : "Enregistrer"}
          </Button>
        </div>
      </DrawerFooter>
    </Drawer>
  );
}

function defaultsFromTask(task: PlanningTaskDrawerTask | null | undefined): FormValues {
  return {
    libelle: task?.libelle ?? "",
    dateDebutPrevue: toInputDate(task?.dateDebutPrevue),
    dateFinPrevue: toInputDate(task?.dateFinPrevue),
    dateDebutReelle: toInputDate(task?.dateDebutReelle),
    dateFinReelle: toInputDate(task?.dateFinReelle),
    statut: task?.statut ?? "a_venir",
    milestoneKind:
      (task?.milestoneKind as (typeof MILESTONE_KINDS)[number] | null) ??
      "autre",
  };
}

function toInputDate(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const DateInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function DateInput(props, ref) {
  return (
    <input
      ref={ref}
      type="date"
      {...props}
      className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    />
  );
});

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="text-[12px] font-semibold mb-1.5 block"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
      {error && (
        <span
          className="text-[11px] mt-1 block"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </span>
      )}
      {hint && !error && (
        <span
          className="text-[11px] mt-1 block"
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
