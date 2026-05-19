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
import { OperationLogo } from "@/components/operation-logo";
import { MoaCreateDrawer } from "@/app/(app)/annuaire/_components/moa-create-drawer";
import {
  createOperation,
  getProposedOperationCode,
} from "@/server/actions/operations/operations";
import type { MoaRow } from "@/server/actions/annuaire/moas";

const Schema = z.object({
  name: z.string().min(1, "Nom obligatoire."),
  code: z
    .string()
    .regex(/^[A-Z0-9-]{2,8}$/, "Code = 2 à 8 caractères [A-Z0-9-]."),
  moaId: z.string().uuid().optional().or(z.literal("")),
  adresseLigne1: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  dateOs: z.string().optional(),
  dateReceptionCible: z.string().optional(),
  dureePrevueJours: z.string().optional(),
  montantPrevisionnelHt: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function OperationCreateDrawer({
  open,
  onOpenChange,
  moas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moas: MoaRow[];
}) {
  const router = useRouter();
  const [codeManuallyEdited, setCodeManuallyEdited] = React.useState(false);
  const [moaDrawerOpen, setMoaDrawerOpen] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", code: "" },
  });

  const name = form.watch("name");
  const dateOs = form.watch("dateOs");
  const dateReception = form.watch("dateReceptionCible");

  // Auto-fill code depuis le nom tant que pas édité manuellement.
  React.useEffect(() => {
    if (codeManuallyEdited) return;
    if (!name) {
      form.setValue("code", "");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await getProposedOperationCode({ name });
      if (cancelled) return;
      if (res.data) form.setValue("code", res.data.code);
    })();
    return () => {
      cancelled = true;
    };
  }, [name, codeManuallyEdited, form]);

  // Auto-calculer durée prévue (jours).
  React.useEffect(() => {
    if (!dateOs || !dateReception) return;
    const d1 = new Date(dateOs);
    const d2 = new Date(dateReception);
    if (d2 <= d1) return;
    const diff = Math.round(
      (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24),
    );
    form.setValue("dureePrevueJours", String(diff));
  }, [dateOs, dateReception, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createOperation({
      code: values.code.toUpperCase(),
      name: values.name,
      moaId: values.moaId || null,
      adresseLigne1: values.adresseLigne1 || null,
      codePostal: values.codePostal || null,
      ville: values.ville || null,
      dateOs: values.dateOs ? new Date(values.dateOs) : null,
      dateReceptionCible: values.dateReceptionCible
        ? new Date(values.dateReceptionCible)
        : null,
      dureePrevueJours: values.dureePrevueJours
        ? Number(values.dureePrevueJours)
        : null,
      montantPrevisionnelHt: values.montantPrevisionnelHt || null,
    });
    if (res.error || !res.data) {
      toast.error(res.error ?? "Échec de la création.");
      return;
    }
    toast.success(`Opération "${values.name}" créée.`);
    form.reset();
    setCodeManuallyEdited(false);
    onOpenChange(false);
    router.push(`/operations/${res.data.id}`);
  });

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} width={680}>
        <DrawerHeader>
          <div className="flex items-start justify-between">
            <div>
              <div
                className="text-[12px] uppercase tracking-[0.6px] font-semibold"
                style={{ color: "var(--text-tertiary)" }}
              >
                Opérations
              </div>
              <h2 className="title-xl mt-2">Nouvelle opération</h2>
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
          {/* Preview logo */}
          <div
            className="flex items-center gap-4 p-5 rounded-2xl"
            style={{ background: "var(--surface)" }}
          >
            <OperationLogo code={form.watch("code") || "OP"} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold truncate">
                {name || "Aperçu du logo"}
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Le code sert au préfixe des CP et notes d&apos;honoraires (ex.
                CP-{form.watch("code") || "RC"}-01-007).
              </div>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            id="operation-create-form"
            className="space-y-4"
          >
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <Field
                label="Nom de l'opération *"
                error={form.formState.errors.name?.message}
              >
                <input
                  {...form.register("name")}
                  type="text"
                  autoFocus
                  placeholder="Résidence Les Cèdres"
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field
                label="Code *"
                error={form.formState.errors.code?.message}
              >
                <input
                  {...form.register("code")}
                  onChange={(e) => {
                    setCodeManuallyEdited(true);
                    form.setValue(
                      "code",
                      e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8),
                    );
                  }}
                  type="text"
                  placeholder="RC"
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
            </div>

            <Field
              label="Maître d'ouvrage"
              error={form.formState.errors.moaId?.message}
            >
              <div className="flex items-center gap-2">
                <select
                  {...form.register("moaId")}
                  className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">— Aucun pour l&apos;instant —</option>
                  {moas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.raisonSociale}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="light"
                  size="sm"
                  onClick={() => setMoaDrawerOpen(true)}
                >
                  + Nouveau
                </Button>
              </div>
            </Field>

            <Field label="Adresse du chantier">
              <input
                {...form.register("adresseLigne1")}
                type="text"
                placeholder="42 rue des Cèdres"
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date d'OS">
                <input
                  {...form.register("dateOs")}
                  type="date"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field label="Réception cible">
                <input
                  {...form.register("dateReceptionCible")}
                  type="date"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Durée prévue (jours)">
                <input
                  {...form.register("dureePrevueJours")}
                  type="number"
                  min={0}
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field label="Montant prévisionnel HT (€)">
                <input
                  {...form.register("montantPrevisionnelHt")}
                  type="text"
                  inputMode="decimal"
                  placeholder="2000000"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
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
            form="operation-create-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Création…"
              : "Créer l'opération"}
          </Button>
        </DrawerFooter>
      </Drawer>

      {/* Drawer 2 stacké pour création MOA en cascade */}
      <MoaCreateDrawer
        open={moaDrawerOpen}
        onOpenChange={setMoaDrawerOpen}
      />
    </>
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
