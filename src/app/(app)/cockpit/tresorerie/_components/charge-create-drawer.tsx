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
import { createRecurringCharge } from "@/server/actions/tresorerie/charges";
import { CHARGE_CATEGORIES } from "@/lib/tresorerie-constants";

const Schema = z.object({
  libelle: z.string().min(1, "Libellé obligatoire.").max(200),
  category: z.string().min(1).max(80),
  montantHt: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z.string().regex(/^\d+(\.\d{1,2})?$/, "TVA invalide."),
  recurrence: z.enum(["monthly", "quarterly", "yearly", "punctual"]),
  nextDueDate: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function ChargeCreateDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      category: "autres",
      tauxTva: "20.00",
      recurrence: "monthly",
      nextDueDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        d.setDate(5);
        return d.toISOString().slice(0, 10);
      })(),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createRecurringCharge({
      libelle: values.libelle,
      category: values.category,
      montantHt: values.montantHt,
      tauxTva: values.tauxTva,
      recurrence: values.recurrence,
      nextDueDate: values.nextDueDate ? new Date(values.nextDueDate) : undefined,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Charge ajoutée.");
    form.reset();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={560}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Cockpit · Trésorerie
            </div>
            <h2 className="title-xl mt-2">Nouvelle charge récurrente</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)" }}
          >
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
          </button>
        </div>
      </DrawerHeader>
      <DrawerBody>
        <form
          onSubmit={onSubmit}
          id="charge-create-form"
          className="space-y-4"
        >
          <Field
            label="Libellé *"
            error={form.formState.errors.libelle?.message}
          >
            <input
              {...form.register("libelle")}
              type="text"
              placeholder="Salaires (5 collaborateurs)"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Catégorie *">
            <select
              {...form.register("category")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {CHARGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {labelForCategory(c)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Montant HT (€) *"
              error={form.formState.errors.montantHt?.message}
            >
              <input
                {...form.register("montantHt")}
                type="text"
                inputMode="decimal"
                placeholder="2850"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field
              label="TVA (%) *"
              error={form.formState.errors.tauxTva?.message}
            >
              <input
                {...form.register("tauxTva")}
                type="text"
                inputMode="decimal"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Récurrence *">
              <select
                {...form.register("recurrence")}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
                <option value="yearly">Annuelle</option>
                <option value="punctual">Ponctuelle</option>
              </select>
            </Field>
            <Field label="Prochain prélèvement">
              <input
                {...form.register("nextDueDate")}
                type="date"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="charge-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Enregistrer la charge"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
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
    </label>
  );
}

function labelForCategory(category: string): string {
  const map: Record<string, string> = {
    salaires: "Salaires",
    charges_sociales: "Charges sociales",
    loyer_bureau: "Loyer bureau",
    vehicules: "Véhicules",
    logiciels: "Logiciels & abos",
    telecom: "Télécom",
    comptable: "Comptable / juridique",
    assurances: "Assurances pro",
    autres: "Autres",
  };
  return map[category] ?? category;
}
