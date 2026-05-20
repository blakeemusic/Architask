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
import { createContract } from "@/server/actions/honoraires/contracts";

const Schema = z.object({
  modeFacturation: z.enum(["forfait", "pct_travaux", "mixte"]),
  montantTotalHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "TVA invalide."),
  delaiPaiementJours: z.number().int().min(0).max(180),
  dateSignature: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function ContractCreateDrawer({
  open,
  onOpenChange,
  operationId,
  moaName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
  moaName: string | null;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      modeFacturation: "forfait",
      montantTotalHt: "",
      tauxTva: "20.00",
      delaiPaiementJours: 30,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createContract({
      operationId,
      modeFacturation: values.modeFacturation,
      montantTotalHt: values.montantTotalHt,
      tauxTva: values.tauxTva,
      delaiPaiementJours: values.delaiPaiementJours,
      dateSignature: values.dateSignature
        ? new Date(values.dateSignature)
        : null,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Contrat d'honoraires créé.");
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
              Cockpit · Honoraires
            </div>
            <h2 className="title-xl mt-2">Nouveau contrat d&apos;honoraires</h2>
            {moaName && (
              <p
                className="text-[12px] mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                MOA : {moaName}
              </p>
            )}
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
          id="contract-create-form"
          className="space-y-4"
        >
          <Field label="Mode de facturation *">
            <select
              {...form.register("modeFacturation")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="forfait">Forfait HT</option>
              <option value="pct_travaux">% du marché travaux</option>
              <option value="mixte">Mixte</option>
            </select>
          </Field>

          <Field
            label="Montant total HT (€) *"
            error={form.formState.errors.montantTotalHt?.message}
          >
            <input
              {...form.register("montantTotalHt")}
              type="text"
              inputMode="decimal"
              placeholder="96000"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
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
            <Field
              label="Délai paiement (j) *"
              error={form.formState.errors.delaiPaiementJours?.message}
            >
              <input
                {...form.register("delaiPaiementJours")}
                type="number"
                min={0}
                max={180}
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          <Field label="Date de signature (si déjà signé)">
            <input
              {...form.register("dateSignature")}
              type="date"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div
            className="p-4 rounded-2xl text-[12px]"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
            }}
          >
            Une fois le contrat créé, ajoute les <strong>missions</strong> dans
            l&apos;onglet Contrat — la somme des % (ou des montants) doit faire
            100 % du total avant signature.
          </div>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="contract-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer le contrat"}
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
