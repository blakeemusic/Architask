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
import { createMoa } from "@/server/actions/annuaire/moas";

const TYPES = [
  { value: "particulier", label: "Particulier" },
  { value: "sci", label: "SCI" },
  { value: "sas", label: "SAS" },
  { value: "sarl", label: "SARL" },
  { value: "sa", label: "SA" },
  { value: "association", label: "Association" },
  { value: "collectivite", label: "Collectivité" },
  { value: "autre", label: "Autre" },
] as const;

const Schema = z.object({
  typeJuridique: z.enum([
    "particulier",
    "sci",
    "sas",
    "sarl",
    "sa",
    "association",
    "collectivite",
    "autre",
  ]),
  raisonSociale: z.string().min(1, "Nom obligatoire."),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET = 14 chiffres.")
    .or(z.literal(""))
    .optional(),
  adresseLigne1: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function MoaCreateDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { typeJuridique: "particulier", raisonSociale: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createMoa({
      typeJuridique: values.typeJuridique,
      raisonSociale: values.raisonSociale,
      siret: values.siret || null,
      adresseLigne1: values.adresseLigne1 || null,
      codePostal: values.codePostal || null,
      ville: values.ville || null,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`MOA "${values.raisonSociale}" créé.`);
    form.reset();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Annuaire
            </div>
            <h2 className="title-xl mt-2">Nouveau maître d&apos;ouvrage</h2>
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
        <form onSubmit={onSubmit} id="moa-create-form" className="space-y-4">
          <Field
            label="Type juridique *"
            error={form.formState.errors.typeJuridique?.message}
          >
            <select
              {...form.register("typeJuridique")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Nom / Raison sociale *"
            error={form.formState.errors.raisonSociale?.message}
          >
            <input
              {...form.register("raisonSociale")}
              type="text"
              autoFocus
              placeholder="SCI Cèdres Habitat"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field
            label="SIRET (optionnel)"
            error={form.formState.errors.siret?.message}
          >
            <input
              {...form.register("siret")}
              type="text"
              inputMode="numeric"
              placeholder="82450673100018"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Adresse">
            <input
              {...form.register("adresseLigne1")}
              type="text"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="CP">
              <input
                {...form.register("codePostal")}
                type="text"
                inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field label="Ville">
              <input
                {...form.register("ville")}
                type="text"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
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
          form="moa-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer le MOA"}
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
