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
  createAvenant,
  signAvenant,
} from "@/server/actions/operations/avenants";

const Schema = z.object({
  objet: z.string().min(1, "Objet obligatoire."),
  montantHt: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Montant invalide (peut être négatif)."),
  impactDelaiJours: z.string(),
  dateSignature: z.string().optional(),
  signImmediately: z.boolean(),
});

type FormValues = z.infer<typeof Schema>;

export function AvenantCreateDrawer({
  open,
  onOpenChange,
  lotId,
  lotNumero,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumero: string;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { impactDelaiJours: "0", signImmediately: false },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const createRes = await createAvenant({
      lotId,
      objet: values.objet,
      montantHt: values.montantHt,
      impactDelaiJours: Number(values.impactDelaiJours),
      dateSignature: values.dateSignature
        ? new Date(values.dateSignature)
        : null,
    });
    if (createRes.error || !createRes.data) {
      toast.error(createRes.error ?? "Création impossible.");
      return;
    }
    toast.success("Avenant créé en brouillon.");

    if (values.signImmediately) {
      const signRes = await signAvenant({ id: createRes.data.avenant.id });
      if (signRes.error || !signRes.data) {
        toast.error(signRes.error ?? "Signature impossible.");
      } else {
        toast.success(`Avenant n°${createRes.data.avenant.numero} signé ✓`);
        for (const w of signRes.data.warnings) toast.warning(w);
      }
    }

    form.reset({ impactDelaiJours: "0", signImmediately: false });
    onOpenChange(false);
    router.refresh();
    void lotNumero; // utilisé via close
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
              Lot {lotNumero} · Avenant
            </div>
            <h2 className="title-xl mt-2">Nouvel avenant</h2>
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
        <form onSubmit={onSubmit} id="avenant-create-form" className="space-y-4">
          <Field
            label="Objet *"
            error={form.formState.errors.objet?.message}
          >
            <textarea
              {...form.register("objet")}
              rows={2}
              placeholder="Reprise des fondations zone Z3 suite étude de sol"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)] resize-y"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            />
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
                placeholder="50000 ou -10000"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <span
                className="text-[11px] mt-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                Négatif possible (avenant en moins).
              </span>
            </Field>
            <Field label="Impact délai (jours)">
              <input
                {...form.register("impactDelaiJours")}
                type="number"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          <Field label="Date de signature (facultative)">
            <input
              {...form.register("dateSignature")}
              type="date"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <label
            className="flex items-center gap-3 p-4 rounded-xl cursor-pointer"
            style={{ background: "var(--surface)" }}
          >
            <input
              {...form.register("signImmediately")}
              type="checkbox"
              className="w-4 h-4"
            />
            <div>
              <div className="text-[13px] font-semibold">
                Signer immédiatement
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Recalcule le planning du lot et le marché révisé en cascade.
              </div>
            </div>
          </label>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="avenant-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer l'avenant"}
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

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
