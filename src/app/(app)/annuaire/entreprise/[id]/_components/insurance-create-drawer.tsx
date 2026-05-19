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
import { createInsurance } from "@/server/actions/annuaire/insurances";

const Schema = z.object({
  type: z.enum(["decennale", "rc_pro", "gpa"]),
  compagnie: z.string().min(1, "Compagnie obligatoire."),
  numPolice: z.string().min(1, "N° de police obligatoire."),
  montantGaranti: z.string().optional(),
  dateDebut: z.string().min(1, "Date début obligatoire."),
  dateFin: z.string().min(1, "Date fin obligatoire."),
  activitesCsv: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export function InsuranceCreateDrawer({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      type: "decennale",
      compagnie: "",
      numPolice: "",
      dateDebut: "",
      dateFin: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    let attestation: { base64: string; mimeType: string; filename: string } | null =
      null;
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      attestation = {
        base64,
        mimeType: file.type || "application/pdf",
        filename: file.name,
      };
    }

    const activites = (values.activitesCsv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await createInsurance({
      companyId,
      type: values.type,
      compagnie: values.compagnie,
      numPolice: values.numPolice,
      montantGaranti: values.montantGaranti?.trim() || null,
      dateDebut: new Date(values.dateDebut),
      dateFin: new Date(values.dateFin),
      activitesCouvertes: activites,
      attestation,
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Assurance créée.");
    form.reset();
    setFile(null);
    onOpenChange(false);
    router.refresh();
  });

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) {
      toast.error("Format non supporté (PDF, PNG ou JPG uniquement).");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo).");
      return;
    }
    setFile(f);
  };

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
            <h2 className="title-xl mt-2">Nouvelle assurance</h2>
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
        <form
          onSubmit={onSubmit}
          id="insurance-create-form"
          className="space-y-4"
        >
          <Field label="Type *" error={form.formState.errors.type?.message}>
            <select
              {...form.register("type")}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="decennale">Décennale</option>
              <option value="rc_pro">RC Professionnelle</option>
              <option value="gpa">Garantie Parfait Achèvement</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Compagnie *"
              error={form.formState.errors.compagnie?.message}
            >
              <input
                {...form.register("compagnie")}
                type="text"
                placeholder="AXA Construction"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field
              label="N° police *"
              error={form.formState.errors.numPolice?.message}
            >
              <input
                {...form.register("numPolice")}
                type="text"
                placeholder="4928-DC-7811"
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
            <Field
              label="Date début *"
              error={form.formState.errors.dateDebut?.message}
            >
              <input
                {...form.register("dateDebut")}
                type="date"
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <Field
              label="Date fin *"
              error={form.formState.errors.dateFin?.message}
            >
              <input
                {...form.register("dateFin")}
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

          <Field label="Montant garanti (€)">
            <input
              {...form.register("montantGaranti")}
              type="text"
              inputMode="decimal"
              placeholder="1200000"
              className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Activités couvertes (séparées par virgule)">
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
              {/* TODO V1 : autocomplétion taxonomie Qualibat */}
              Saisie libre en MVP — autocomplétion Qualibat en V1.
            </span>
          </Field>

          <Field label="Attestation PDF (optionnel)">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0] ?? null);
              }}
              className="px-5 py-6 rounded-2xl cursor-pointer text-center transition-colors"
              style={{
                background: dragging
                  ? "var(--brand-soft)"
                  : "var(--surface)",
                border: `1.5px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileIcon />
                  <div className="text-left">
                    <div className="text-[13px] font-semibold">{file.name}</div>
                    <div
                      className="text-[11px] font-tabular"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {(file.size / 1024).toFixed(0)} Ko · cliquer pour
                      remplacer
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="text-[13px] font-semibold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Glisser le PDF ou cliquer pour parcourir
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    PDF / PNG / JPG · max 10 Mo · stockage privé
                  </div>
                </>
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
          form="insurance-create-form"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Création…" : "Ajouter l'assurance"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

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

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--danger)" }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
