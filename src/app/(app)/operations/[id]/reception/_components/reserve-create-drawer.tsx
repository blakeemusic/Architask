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
import { addReserve } from "@/server/actions/operations/pv-reception";

const Schema = z.object({
  lotId: z.string().uuid("Lot obligatoire."),
  description: z.string().min(1, "Description obligatoire."),
  dateReleve: z.string().min(1),
});

type FormValues = z.infer<typeof Schema>;

export function ReserveCreateDrawer({
  open,
  onOpenChange,
  operationId,
  lots,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
  lots: Array<{ id: string; numero: string; libelle: string }>;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      lotId: lots[0]?.id ?? "",
      dateReleve: new Date().toISOString().slice(0, 10),
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await addReserve({
      operationId,
      lotId: values.lotId,
      description: values.description,
      dateReleve: new Date(values.dateReleve),
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Réserve ajoutée.");
    form.reset({
      lotId: lots[0]?.id ?? "",
      dateReleve: new Date().toISOString().slice(0, 10),
    });
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
            <h2 className="title-xl mt-2">Nouvelle réserve</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </DrawerHeader>

      <DrawerBody>
        <form onSubmit={onSubmit} id="reserve-create-form" className="space-y-4">
          <label className="block">
            <span className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Lot *
            </span>
            <select
              {...form.register("lotId")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  Lot {l.numero} · {l.libelle}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Description *
            </span>
            <textarea
              {...form.register("description")}
              rows={3}
              placeholder="Ex: Fissure cloison couloir RDC à reprendre"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)] resize-y"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            />
            {form.formState.errors.description && (
              <span className="text-[11px] mt-1 block" style={{ color: "var(--danger)" }}>
                {form.formState.errors.description.message}
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Date de relevé *
            </span>
            <input
              {...form.register("dateReleve")}
              type="date"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </label>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="reserve-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Ajout…" : "Ajouter la réserve"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
