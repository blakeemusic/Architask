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
import { CompanyCreateDrawer } from "@/app/(app)/annuaire/_components/company-create-drawer";
import { createLot } from "@/server/actions/operations/lots";
import type { CompanyListItem } from "@/server/actions/annuaire/companies";

import { LotSignDialog } from "./lot-sign-dialog";

const Schema = z.object({
  numero: z
    .string()
    .min(1, "Numéro obligatoire.")
    .regex(/^[A-Za-z0-9-]+$/, "Format invalide (lettres, chiffres, -)."),
  libelle: z.string().min(1, "Libellé obligatoire."),
  companyId: z.string().uuid("Entreprise obligatoire."),
  montantMarcheHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  tauxTva: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/),
  modeRevision: z.string(),
  retenueGarantiePct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/),
  delaiPaiementJours: z.string(),
  activitesCsv: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function LotCreateDrawer({
  open,
  onOpenChange,
  operationId,
  companies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
  companies: CompanyListItem[];
}) {
  const router = useRouter();
  const [companyDrawerOpen, setCompanyDrawerOpen] = React.useState(false);
  const [signDialogState, setSignDialogState] = React.useState<{
    open: boolean;
    lotId: string | null;
    lotNumero: string;
  }>({ open: false, lotId: null, lotNumero: "" });

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      tauxTva: "20.00",
      modeRevision: "BT01",
      retenueGarantiePct: "5.00",
      delaiPaiementJours: "30",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const activites = (values.activitesCsv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await createLot({
      operationId,
      numero: values.numero,
      libelle: values.libelle,
      companyId: values.companyId,
      montantMarcheHt: values.montantMarcheHt,
      tauxTva: values.tauxTva,
      modeRevision: values.modeRevision,
      retenueGarantiePct: values.retenueGarantiePct,
      delaiPaiementJours: Number(values.delaiPaiementJours),
      activitesAttendues: activites,
    });
    if (res.error || !res.data) {
      toast.error(res.error ?? "Création impossible.");
      return;
    }
    toast.success(
      `Lot n°${values.numero} créé en brouillon. Signe-le pour le bloquer.`,
    );
    form.reset({
      tauxTva: "20.00",
      modeRevision: "BT01",
      retenueGarantiePct: "5.00",
      delaiPaiementJours: "30",
    });
    onOpenChange(false);
    router.refresh();
    // Ouvre direct la dialog de signature
    setSignDialogState({
      open: true,
      lotId: res.data.id,
      lotNumero: values.numero,
    });
  });

  const selectedCompany = companies.find(
    (c) => c.id === form.watch("companyId"),
  );

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
                Opération · Marché
              </div>
              <h2 className="title-xl mt-2">Nouveau lot</h2>
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
          <form onSubmit={onSubmit} id="lot-create-form" className="space-y-4">
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Field
                label="N° lot *"
                error={form.formState.errors.numero?.message}
              >
                <input
                  {...form.register("numero")}
                  type="text"
                  placeholder="01"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field
                label="Libellé *"
                error={form.formState.errors.libelle?.message}
              >
                <input
                  {...form.register("libelle")}
                  type="text"
                  placeholder="Gros œuvre"
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
            </div>

            <Field
              label="Entreprise titulaire *"
              error={form.formState.errors.companyId?.message}
            >
              <div className="flex items-center gap-2">
                <select
                  {...form.register("companyId")}
                  className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">— Choisir une entreprise —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.raisonSociale}
                      {c.decennaleStatus === "expire"
                        ? " ⚠ décennale expirée"
                        : c.decennaleStatus === "expirant_60j"
                          ? " ⚠ décennale <60j"
                          : c.decennaleStatus === "absente"
                            ? " ⚠ sans décennale"
                            : ""}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="light"
                  size="sm"
                  onClick={() => setCompanyDrawerOpen(true)}
                >
                  + Nouvelle
                </Button>
              </div>
              {selectedCompany && (
                <div
                  className="mt-3 flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface)" }}
                >
                  <CompanyLogo
                    name={selectedCompany.raisonSociale}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">
                      {selectedCompany.raisonSociale}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {selectedCompany.decennaleStatus === "valide"
                        ? "Décennale à jour"
                        : selectedCompany.decennaleStatus === "expirant_60j"
                          ? `Décennale expire dans ${selectedCompany.decennaleDaysRemaining ?? 0}j`
                          : selectedCompany.decennaleStatus === "expire"
                            ? "Décennale expirée — sign bloqué"
                            : "Sans décennale — sign bloqué"}
                    </div>
                  </div>
                </div>
              )}
            </Field>

            <Field
              label="Montant marché HT (€) *"
              error={form.formState.errors.montantMarcheHt?.message}
            >
              <input
                {...form.register("montantMarcheHt")}
                type="text"
                inputMode="decimal"
                placeholder="524800"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="TVA %">
                <input
                  {...form.register("tauxTva")}
                  type="text"
                  inputMode="decimal"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field label="Retenue %">
                <input
                  {...form.register("retenueGarantiePct")}
                  type="text"
                  inputMode="decimal"
                  className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field label="Délai paiement (jours)">
                <input
                  {...form.register("delaiPaiementJours")}
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

            <Field label="Mode de révision">
              <input
                {...form.register("modeRevision")}
                type="text"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>

            <Field label="Activités attendues (séparées par virgule)">
              <textarea
                {...form.register("activitesCsv")}
                rows={2}
                placeholder="gros_oeuvre, maçonnerie, fondations"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)] resize-y"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontFamily: "inherit",
                }}
              />
              <span
                className="text-[11px] mt-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                Servent à vérifier que la décennale de l&apos;entreprise les couvre
                au moment de signer.
              </span>
            </Field>
          </form>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="lot-create-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Création…" : "Créer en brouillon"}
          </Button>
        </DrawerFooter>
      </Drawer>

      {/* Stack drawer : création entreprise depuis le LotCreate */}
      <CompanyCreateDrawer
        open={companyDrawerOpen}
        onOpenChange={setCompanyDrawerOpen}
      />

      {/* Dialog de signature ouverte après création */}
      {signDialogState.lotId && (
        <LotSignDialog
          open={signDialogState.open}
          onOpenChange={(o) =>
            setSignDialogState((s) => ({ ...s, open: o }))
          }
          lotId={signDialogState.lotId}
          lotNumero={signDialogState.lotNumero}
        />
      )}
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
