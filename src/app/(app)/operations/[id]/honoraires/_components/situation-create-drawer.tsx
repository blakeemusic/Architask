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
import { createSituation } from "@/server/actions/honoraires/situations";

const Schema = z.object({
  missionId: z.string().uuid("Mission obligatoire."),
  pctAvancementNouveau: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Avancement invalide."),
  dateEmission: z.string().min(1),
});

type FormValues = z.infer<typeof Schema>;

type Mission = {
  id: string;
  libelle: string;
  ordre: number;
  typeValeur: "pct" | "montant";
  pctDuTotal: string | null;
  montantHt: string | null;
  pctAvancementCourant: string;
};

export function SituationCreateDrawer({
  open,
  onOpenChange,
  missions,
  presetMissionId,
  contractMontantHt,
  tauxTva,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missions: Mission[];
  presetMissionId: string | null;
  contractMontantHt: string;
  tauxTva: string;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      missionId: presetMissionId ?? missions[0]?.id ?? "",
      pctAvancementNouveau: "100",
      dateEmission: new Date().toISOString().slice(0, 10),
    },
  });

  const missionId = form.watch("missionId");
  const pctNew = form.watch("pctAvancementNouveau");
  const selectedMission = missions.find((m) => m.id === missionId) ?? null;

  const pctPrec = selectedMission?.pctAvancementCourant ?? "0";
  const delta = Math.max(0, Number(pctNew || "0") - Number(pctPrec));
  const montantMission = selectedMission
    ? selectedMission.typeValeur === "pct"
      ? (Number(selectedMission.pctDuTotal ?? 0) / 100) *
        Number(contractMontantHt)
      : Number(selectedMission.montantHt ?? 0)
    : 0;
  const montantHt = (delta / 100) * montantMission;
  const montantTva = (montantHt * Number(tauxTva)) / 100;
  const montantTtc = montantHt + montantTva;

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createSituation({
      missionId: values.missionId,
      pctAvancementNouveau: values.pctAvancementNouveau,
      dateEmission: new Date(values.dateEmission),
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Note ${res.data?.numero} créée en brouillon.`);
    form.reset();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={600}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Cockpit · Honoraires
            </div>
            <h2 className="title-xl mt-2">
              Nouvelle note d&apos;honoraires
            </h2>
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
          id="situation-create-form"
          className="space-y-4"
        >
          <Field label="Mission à facturer *">
            <select
              {...form.register("missionId")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ordre}. {m.libelle} · av. courant {Number(m.pctAvancementCourant).toFixed(0)} %
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field
              label={`Avancement nouveau (%) * — précédent ${Number(pctPrec).toFixed(0)}%`}
              error={form.formState.errors.pctAvancementNouveau?.message}
            >
              <input
                {...form.register("pctAvancementNouveau")}
                type="number"
                min={Number(pctPrec)}
                max={100}
                step="0.5"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field label="Date émission">
              <input
                {...form.register("dateEmission")}
                type="date"
                className="w-44 px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          {/* Calcul preview */}
          <div
            className="p-5 rounded-2xl"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="text-[11px] uppercase tracking-wider font-semibold mb-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              Calcul automatique
            </div>
            <Row label="Avancement précédent" value={`${Number(pctPrec).toFixed(0)} %`} />
            <Row
              label="Avancement nouveau"
              value={`${Number(pctNew || "0").toFixed(0)} %`}
              bold
            />
            <Row
              label={`Delta × ${formatEuro(montantMission)} € HT`}
              value={`${delta.toFixed(0)} %`}
            />
            <div
              className="border-t my-2"
              style={{ borderColor: "var(--border)" }}
            />
            <Row
              label="Montant HT à facturer"
              value={`${formatEuro(montantHt)} €`}
              bold
            />
            <Row label={`TVA (${tauxTva} %)`} value={`${formatEuro(montantTva)} €`} />
            <div
              className="border-t my-2"
              style={{ borderColor: "var(--border)" }}
            />
            <Row
              label="Net TTC"
              value={`${formatEuro(montantTtc)} €`}
              big
            />
          </div>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="situation-create-form"
          disabled={form.formState.isSubmitting || delta === 0}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer la note"}
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

function Row({
  label,
  value,
  bold,
  big,
}: {
  label: string;
  value: string;
  bold?: boolean;
  big?: boolean;
}) {
  return (
    <div
      className="flex justify-between py-1.5"
      style={{ fontSize: big ? 16 : 12 }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        className="font-tabular"
        style={{
          fontWeight: bold || big ? 700 : 500,
          color: "var(--text-primary)",
          letterSpacing: big ? "-0.015em" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
