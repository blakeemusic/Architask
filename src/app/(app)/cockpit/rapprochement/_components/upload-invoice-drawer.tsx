"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { attachInvoiceFromUpload } from "@/server/actions/tresorerie/expense-invoices";

type Transaction = {
  id: string;
  libelle: string;
  amountTtc: string | null;
  transactionDate: Date;
};

export function UploadInvoiceDrawer({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);
  const [manualFournisseur, setManualFournisseur] = React.useState("");
  const [manualMontantTtc, setManualMontantTtc] = React.useState(() =>
    transaction
      ? Math.abs(Number(transaction.amountTtc ?? 0)).toFixed(2)
      : "",
  );
  const [manualTauxTva, setManualTauxTva] = React.useState("20");

  if (!transaction) return null;

  const onSubmit = async () => {
    if (!file && !manualMode) {
      toast.info("Sélectionne un fichier ou passe en saisie manuelle.");
      return;
    }
    setBusy(true);
    try {
      const buf = file ? await file.arrayBuffer() : new ArrayBuffer(0);
      const base64 = file ? arrayBufferToBase64(buf) : "";
      const mimeType = file?.type ?? "application/pdf";
      const filename = file?.name ?? "facture-manuelle.txt";

      let manualOverride: Parameters<typeof attachInvoiceFromUpload>[0]["manualOverride"];
      if (manualMode) {
        const ttc = Number(manualMontantTtc);
        const taux = Number(manualTauxTva);
        const ht = ttc / (1 + taux / 100);
        const tva = ttc - ht;
        manualOverride = {
          fournisseur: manualFournisseur,
          dateFacture: transaction.transactionDate,
          montantHt: ht.toFixed(2),
          montantTva: tva.toFixed(2),
          montantTtc: ttc.toFixed(2),
          tauxTva: taux.toFixed(2),
        };
      }

      const res = await attachInvoiceFromUpload({
        transactionId: transaction.id,
        base64,
        mimeType,
        filename,
        manualOverride,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data?.usedOcr) {
        toast.success(
          `Facture rattachée (OCR ${res.data.ocrConfidence ?? 0}%).`,
        );
      } else {
        toast.success("Facture rattachée.");
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={560}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Rapprochement
            </div>
            <h2 className="title-xl mt-2">Joindre une facture</h2>
            <p
              className="text-[12px] mt-1 font-tabular"
              style={{ color: "var(--text-secondary)" }}
            >
              {transaction.libelle} ·{" "}
              <strong>
                {Math.abs(Number(transaction.amountTtc ?? 0)).toLocaleString(
                  "fr-FR",
                  { minimumFractionDigits: 2 },
                )}{" "}
                €
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-[var(--surface-2)]"
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
        {!manualMode ? (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="px-5 py-10 rounded-2xl cursor-pointer text-center transition-colors hover:bg-[var(--surface-2)]"
              style={{
                background: "var(--surface)",
                border: "1.5px dashed var(--border-strong)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div>
                  <div className="text-[14px] font-bold">{file.name}</div>
                  <div
                    className="text-[12px] mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(file.size / 1024).toFixed(0)} Ko · OCR Claude Vision lancera l&apos;extraction
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[14px] font-bold">Glisser la facture ici</div>
                  <div
                    className="text-[12px] mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    PDF · JPG · PNG · WebP — OCR automatique
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="mt-3 text-[12px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              Pas de facture ? Saisie manuelle →
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div
              className="p-3 rounded-xl text-[11px]"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              Saisie manuelle (sans OCR). Les montants HT et TVA seront déduits du TTC + taux.
            </div>
            <Field label="Fournisseur *">
              <input
                value={manualFournisseur}
                onChange={(e) => setManualFournisseur(e.target.value)}
                type="text"
                placeholder="Castorama Boulogne"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Montant TTC (€) *">
                <input
                  value={manualMontantTtc}
                  onChange={(e) => setManualMontantTtc(e.target.value)}
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
              <Field label="Taux TVA (%) *">
                <select
                  value={manualTauxTva}
                  onChange={(e) => setManualTauxTva(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="20">20 %</option>
                  <option value="10">10 %</option>
                  <option value="5.5">5,5 %</option>
                  <option value="0">0 %</option>
                </select>
              </Field>
            </div>
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="text-[12px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              ← Revenir à l&apos;upload
            </button>
          </div>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button onClick={onSubmit} disabled={busy}>
          {busy
            ? manualMode
              ? "Enregistrement…"
              : "Analyse OCR…"
            : manualMode
              ? "Rattacher manuellement"
              : "Rattacher avec OCR"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
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
