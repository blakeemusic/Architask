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
import { CompanyLogo } from "@/components/ui/company-logo";
import { createCompany } from "@/server/actions/annuaire/companies";

const Schema = z.object({
  raisonSociale: z.string().min(1, "Raison sociale obligatoire."),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET = 14 chiffres exactement.")
    .or(z.literal(""))
    .optional(),
  formeJuridique: z.string().optional(),
  adresseLigne1: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function CompanyCreateDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { raisonSociale: "" },
  });
  const raisonSociale = form.watch("raisonSociale");

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createCompany({
      raisonSociale: values.raisonSociale,
      siret: values.siret || null,
      formeJuridique: values.formeJuridique || null,
      adresseLigne1: values.adresseLigne1 || null,
      codePostal: values.codePostal || null,
      ville: values.ville || null,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Entreprise "${values.raisonSociale}" créée.`);
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
            <h2 className="title-xl mt-2">Nouvelle entreprise</h2>
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
        {/* Preview logo en haut */}
        <div
          className="flex items-center gap-4 p-5 rounded-2xl"
          style={{ background: "var(--surface)" }}
        >
          <CompanyLogo name={raisonSociale || "Entreprise"} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate">
              {raisonSociale || "Aperçu logo & couleurs"}
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Initiales + gradient stable, basés sur le nom.
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} id="company-create-form" className="space-y-4">
          <Field
            label="Raison sociale *"
            error={form.formState.errors.raisonSociale?.message}
          >
            <input
              {...form.register("raisonSociale")}
              type="text"
              autoFocus
              placeholder="SAS Beton+"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="SIRET (14 chiffres)"
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
            <Field label="Forme juridique">
              <input
                {...form.register("formeJuridique")}
                type="text"
                placeholder="SAS"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          <Field label="Adresse">
            <input
              {...form.register("adresseLigne1")}
              type="text"
              placeholder="12 rue de la Pompe"
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
                placeholder="92100"
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
                placeholder="Boulogne-Billancourt"
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
          form="company-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer l'entreprise"}
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
