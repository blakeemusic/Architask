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
import { createCaution } from "@/server/actions/operations/cautions";

const Schema = z.object({
  lotId: z.string().uuid("Lot obligatoire."),
  montant: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  dateEmission: z.string().min(1),
  dateExpiration: z.string().min(1),
  banque: z.string().min(1, "Banque obligatoire."),
  numCaution: z.string().min(1, "N° caution obligatoire."),
  replacesRetentionId: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

type RetentionOption = {
  id: string;
  lotId: string;
  label: string;
  actualLotId: string;
};

export function CautionCreateDrawer({
  open,
  onOpenChange,
  lots,
  retentions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lots: Array<{ id: string; numero: string; libelle: string }>;
  retentions: RetentionOption[];
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      lotId: lots[0]?.id ?? "",
      dateEmission: new Date().toISOString().slice(0, 10),
      dateExpiration: (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
      })(),
    },
  });

  const selectedLotId = form.watch("lotId");
  const retentionsForLot = retentions.filter(
    (r) => r.actualLotId === selectedLotId,
  );

  const onSubmit = form.handleSubmit(async (values) => {
    let attachment: { base64: string; mimeType: string; filename: string } | null =
      null;
    if (file) {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      attachment = {
        base64,
        mimeType: file.type,
        filename: file.name,
      };
    }

    const res = await createCaution({
      lotId: values.lotId,
      montant: values.montant,
      dateEmission: new Date(values.dateEmission),
      dateExpiration: new Date(values.dateExpiration),
      banque: values.banque,
      numCaution: values.numCaution,
      attachment,
      replacesRetentionId: values.replacesRetentionId || null,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Caution enregistrée.");
    form.reset();
    setFile(null);
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={640}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Garanties
            </div>
            <h2 className="title-xl mt-2">Nouvelle caution bancaire (RBQS)</h2>
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
        <form
          onSubmit={onSubmit}
          id="caution-create-form"
          className="space-y-4"
        >
          <Field
            label="Lot *"
            error={form.formState.errors.lotId?.message}
          >
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
          </Field>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <Field
              label="Banque *"
              error={form.formState.errors.banque?.message}
            >
              <input
                {...form.register("banque")}
                type="text"
                placeholder="Crédit Mutuel Pro"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field
              label="N° caution *"
              error={form.formState.errors.numCaution?.message}
            >
              <input
                {...form.register("numCaution")}
                type="text"
                placeholder="RBQS-2026-001"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
          </div>

          <Field
            label="Montant garanti (€) *"
            error={form.formState.errors.montant?.message}
          >
            <input
              {...form.register("montant")}
              type="text"
              inputMode="decimal"
              placeholder="26240"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date émission *">
              <input
                {...form.register("dateEmission")}
                type="date"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field label="Date expiration *">
              <input
                {...form.register("dateExpiration")}
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

          {retentionsForLot.length > 0 && (
            <Field label="Remplace une retenue garantie ? (optionnel)">
              <select
                {...form.register("replacesRetentionId")}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Non, juste une caution complémentaire</option>
                {retentionsForLot.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span
                className="text-[11px] mt-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                Si oui, la retenue passera en &laquo; remplacée par caution &raquo;.
              </span>
            </Field>
          )}

          <Field label="PDF de la caution (optionnel)">
            <div
              onClick={() => fileRef.current?.click()}
              className="px-5 py-6 rounded-2xl cursor-pointer text-center transition-colors hover:bg-[var(--surface-2)]"
              style={{
                background: "var(--surface)",
                border: "1.5px dashed var(--border-strong)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div className="text-[13px] font-semibold">
                  {file.name}
                  <div
                    className="text-[11px] mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(file.size / 1024).toFixed(0)} Ko — cliquer pour remplacer
                  </div>
                </div>
              ) : (
                <div
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Glisser le PDF ou cliquer pour parcourir
                </div>
              )}
            </div>
          </Field>
        </form>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          type="submit"
          form="caution-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Enregistrer la caution"}
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}
