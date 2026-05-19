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
import { createPvReception } from "@/server/actions/operations/pv-reception";

const Schema = z.object({
  dateReception: z.string().min(1, "Date obligatoire."),
  avecReserves: z.boolean(),
});

type FormValues = z.infer<typeof Schema>;

export function PvCreateDrawer({
  open,
  onOpenChange,
  operationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      dateReception: new Date().toISOString().slice(0, 10),
      avecReserves: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createPvReception({
      operationId,
      dateReception: new Date(values.dateReception),
      avecReserves: values.avecReserves,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("PV de réception créé en brouillon.");
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
              Réception
            </div>
            <h2 className="title-xl mt-2">Démarrer la réception</h2>
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
        <form onSubmit={onSubmit} id="pv-create-form" className="space-y-5">
          <Field
            label="Date de réception *"
            error={form.formState.errors.dateReception?.message}
          >
            <input
              {...form.register("dateReception")}
              type="date"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <label
            className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <input
              {...form.register("avecReserves")}
              type="checkbox"
              className="w-4 h-4"
            />
            <div>
              <div className="text-[13px] font-semibold">
                Réception avec réserves
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Tu pourras ajouter les réserves par lot ensuite.
              </div>
            </div>
          </label>

          <div
            className="p-4 rounded-xl text-[12px]"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
            }}
          >
            💡 Une fois signé, le PV déclenchera la création automatique des
            retenues garantie pour chaque lot signé, avec échéance de libération
            à 1 an (NF P03-001).
          </div>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="pv-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Créer le PV"}
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
