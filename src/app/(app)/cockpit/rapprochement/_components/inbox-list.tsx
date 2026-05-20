"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  attachInvoiceFromPennylane,
} from "@/server/actions/tresorerie/expense-invoices";

import { UploadInvoiceDrawer } from "./upload-invoice-drawer";

type PennylaneCandidate = {
  externalId: string;
  supplierName: string;
  montantTtc: string;
  montantHt: string;
  montantTva: string;
  tauxTva: string;
  dateFacture: Date;
};

type Row = {
  id: string;
  transactionDate: Date;
  amountTtc: string | null;
  libelle: string;
  category: string | null;
  bankAccountLibelle: string;
  daysSinceTx: number;
  pennylaneCandidate: PennylaneCandidate | null;
};

const SCOPE_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "old", label: "+ 30 j" },
  { value: "critical", label: "Critique" },
];

export function InboxList({ rows }: { rows: Row[] }) {
  const [scope, setScope] = React.useState<"all" | "old" | "critical">("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [currentTx, setCurrentTx] = React.useState<Row | null>(null);

  const filtered = rows.filter((r) => {
    if (scope === "old") return r.daysSinceTx >= 30;
    if (scope === "critical") return r.daysSinceTx >= 30; // alias
    return true;
  });
  const shown = filtered.slice(0, 5);
  const rest = filtered.slice(5);
  const restAmount = rest.reduce(
    (acc, r) => acc + Math.abs(Number(r.amountTtc ?? 0)),
    0,
  );
  const restTva = rest.reduce(
    (acc, r) => acc + Math.abs(Number(r.amountTtc ?? 0)) * 0.166, // ~ TVA estimée
    0,
  );

  const openDrawer = (row: Row) => {
    setCurrentTx(row);
    setDrawerOpen(true);
  };

  return (
    <div
      className="col-span-3 rounded-3xl overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      <div className="px-7 py-5 flex items-center justify-between">
        <div>
          <h2
            className="text-[18px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Inbox à rapprocher
          </h2>
          <p
            className="text-[12px] mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Dépenses pro sans facture jointe · Détecté via API Pennylane (mock)
          </p>
        </div>
        <div
          className="inline-flex items-center p-1 gap-1 rounded-2xl"
          style={{ background: "var(--surface-2)" }}
        >
          {SCOPE_OPTIONS.map((o) => {
            const isActive = scope === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  setScope(o.value as "all" | "old" | "critical")
                }
                className="px-3 py-1.5 text-[12px] font-medium rounded-xl transition-colors"
                style={
                  isActive
                    ? {
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        fontWeight: 700,
                      }
                    : { color: "var(--text-secondary)" }
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {shown.length === 0 && (
          <div
            className="py-10 text-center text-[13px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Aucune dépense en attente. Tout est rapproché !
          </div>
        )}
        {shown.map((row) => (
          <InboxRow key={row.id} row={row} onUpload={() => openDrawer(row)} />
        ))}
        {rest.length > 0 && (
          <div
            className="px-4 py-3 text-[12px] text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            + {rest.length} autres dépenses ·{" "}
            {formatEuro(restAmount)} € · TVA ~ {formatEuro(restTva)} €
          </div>
        )}
      </div>

      <UploadInvoiceDrawer
        key={currentTx?.id ?? "none"}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={
          currentTx
            ? {
                id: currentTx.id,
                libelle: currentTx.libelle,
                amountTtc: currentTx.amountTtc,
                transactionDate: currentTx.transactionDate,
              }
            : null
        }
      />
    </div>
  );
}

function InboxRow({
  row,
  onUpload,
}: {
  row: Row;
  onUpload: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const amount = Math.abs(Number(row.amountTtc ?? 0));
  const isCritical = row.daysSinceTx >= 30;
  const hasCandidate = row.pennylaneCandidate !== null;

  const initials = guessInitialsFromLibelle(row.libelle);
  const bg = guessBgFromLibelle(row.libelle);

  const onAttachPennylane = async () => {
    if (!row.pennylaneCandidate) return;
    setBusy(true);
    try {
      const c = row.pennylaneCandidate;
      const res = await attachInvoiceFromPennylane({
        transactionId: row.id,
        pennylaneExternalId: c.externalId,
        supplierName: c.supplierName,
        dateFacture: c.dateFacture,
        montantHt: c.montantHt,
        montantTva: c.montantTva,
        montantTtc: c.montantTtc,
        tauxTva: c.tauxTva,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Facture ${c.supplierName} rattachée depuis Pennylane.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="p-4 rounded-2xl flex items-center gap-4"
      style={
        hasCandidate
          ? {
              background: "rgba(31,45,234,0.04)",
              border: "1.5px solid var(--brand)",
            }
          : isCritical
            ? {
                background: "rgba(220,38,38,0.04)",
                border: "1.5px solid rgba(220,38,38,0.30)",
              }
            : { background: "var(--surface-2)" }
      }
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shrink-0"
        style={{ background: bg }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[14px] font-bold truncate">{row.libelle}</div>
          {hasCandidate ? (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(31,45,234,0.15)",
                color: "var(--brand)",
              }}
            >
              Match Pennylane
            </span>
          ) : isCritical ? (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(220,38,38,0.15)",
                color: "var(--danger)",
              }}
            >
              + {row.daysSinceTx} jours
            </span>
          ) : (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(245,158,11,0.15)",
                color: "var(--warning)",
              }}
            >
              À traiter
            </span>
          )}
        </div>
        <div
          className="text-[11px] mt-1 flex items-center gap-2"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>
            {row.transactionDate.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
            {" · "}
            {row.bankAccountLibelle}
          </span>
          {isCritical && !hasCandidate && (
            <>
              <span>·</span>
              <span style={{ color: "var(--danger)" }}>
                ⚠ Risque perte TVA déductible
              </span>
            </>
          )}
          {!isCritical && row.category && (
            <>
              <span>·</span>
              <span>Cat. {labelForCategory(row.category)} suggérée</span>
            </>
          )}
        </div>
        {hasCandidate && (
          <div
            className="text-[11px] mt-1.5 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
            style={{
              background: "rgba(31,45,234,0.08)",
              color: "var(--brand)",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              <path d="M12 7v5l3 3" />
            </svg>
            Facture trouvée dans Pennylane · «{" "}
            {row.pennylaneCandidate?.supplierName} ·{" "}
            {formatEuro(Number(row.pennylaneCandidate?.montantTtc ?? 0))} € ·{" "}
            {row.pennylaneCandidate?.dateFacture.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
            {" »"}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[16px] font-bold font-tabular">
          {formatEuro(amount)} €
        </div>
        <div
          className="text-[11px] font-tabular"
          style={{
            color: isCritical ? "var(--danger)" : "var(--text-tertiary)",
          }}
        >
          {hasCandidate
            ? `TVA ${row.pennylaneCandidate?.tauxTva.replace(".00", "")}% : ${formatEuro(Number(row.pennylaneCandidate?.montantTva ?? 0))} €`
            : `TVA 20% : ${formatEuro(amount * 0.166)} € ${isCritical ? "à risque" : "estimée"}`}
        </div>
      </div>
      {hasCandidate ? (
        <button
          type="button"
          onClick={onAttachPennylane}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl text-[12px] font-bold text-white shrink-0"
          style={{ background: "var(--text-primary)" }}
        >
          {busy ? "…" : "Attacher ✓"}
        </button>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <ActionIcon title="Photo / Upload" onClick={onUpload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </ActionIcon>
          <ActionIcon
            title="Chercher Pennylane"
            onClick={() => toast.info("Recherche Pennylane (mock) — match auto déjà tenté.")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </ActionIcon>
        </div>
      )}
    </div>
  );
}

function ActionIcon({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--surface)] transition-colors"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

function guessInitialsFromLibelle(libelle: string): string {
  const lib = libelle.toLowerCase();
  if (lib.includes("castorama")) return "C";
  if (lib.includes("total")) return "T";
  if (lib.includes("amazon")) return "A";
  if (lib.includes("bistrot")) return "LB";
  if (lib.includes("uber")) return "U";
  if (lib.includes("esso")) return "E";
  if (lib.includes("fnac")) return "F";
  if (lib.includes("sncf")) return "S";
  return libelle
    .replace(/^(CB |PRLV |SEPA |VIR )/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function guessBgFromLibelle(libelle: string): string {
  const lib = libelle.toLowerCase();
  if (lib.includes("castorama"))
    return "linear-gradient(135deg, #F97316, #FB923C)";
  if (lib.includes("total"))
    return "linear-gradient(135deg, #EF4444, #DC2626)";
  if (lib.includes("amazon"))
    return "linear-gradient(135deg, #4F46E5, #7C3AED)";
  if (lib.includes("bistrot"))
    return "linear-gradient(135deg, #F59E0B, #FBBF24)";
  if (lib.includes("uber")) return "#0B0B0F";
  return "linear-gradient(135deg, #1F2DEA, #4F5DFF)";
}

function labelForCategory(category: string): string {
  const map: Record<string, string> = {
    vehicules: "Véhicules",
    deplacements: "Déplacements",
    fournitures: "Fournitures",
    frais_de_bouche: "Frais de bouche",
    logiciels: "Logiciels",
    telecom: "Télécom",
    autres: "Autres",
  };
  return map[category] ?? category;
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
