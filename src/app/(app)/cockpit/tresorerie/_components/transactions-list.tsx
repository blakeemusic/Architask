"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { categorizeTransaction } from "@/server/actions/tresorerie/bank";
import { suggestCategoryFromLibelle } from "@/lib/tresorerie/category-suggestions";

type Transaction = {
  id: string;
  transactionDate: Date;
  amountTtc: string | null;
  libelle: string;
  category: string | null;
  needsReconciliation: boolean;
  invoiceAttachedAt: Date | null;
  linkedHonoraireSituationId: string | null;
  bankAccount: { libelle: string; ibanLast4: string | null };
  linkedHonoraireSituation: { numero: string } | null;
};

export function TransactionsList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      <div className="px-7 py-5 flex items-center justify-between">
        <div>
          <h3
            className="text-[18px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            Transactions récentes
          </h3>
          <p
            className="text-[12px] mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Catégorisées automatiquement · {transactions.length} affichées
          </p>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {transactions.length === 0 && (
          <div
            className="py-10 text-center text-[13px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Aucune transaction. Synchronise un compte pour les voir apparaître.
          </div>
        )}
        {transactions.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} />
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const router = useRouter();
  const amount = Number(tx.amountTtc ?? 0);
  const isIncoming = amount >= 0;
  const isReconciled = tx.linkedHonoraireSituationId !== null;
  const isRecurring = !tx.needsReconciliation && tx.category !== null && !isReconciled;
  const needsCat = tx.needsReconciliation && !tx.category;
  const suggested = needsCat ? suggestCategoryFromLibelle(tx.libelle) : null;
  const [busy, setBusy] = React.useState(false);

  const onCategorize = async () => {
    if (!suggested) {
      toast.info("Pas de catégorie suggérée — édition manuelle bientôt.");
      return;
    }
    setBusy(true);
    try {
      const res = await categorizeTransaction({
        id: tx.id,
        category: suggested,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Catégorisé.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = new Date(tx.transactionDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className="px-4 py-3 rounded-2xl flex items-center gap-4 hover:bg-[var(--surface-2)] transition-colors"
      style={
        needsCat
          ? {
              border: "1.5px dashed var(--warning)",
              background: "rgba(245,158,11,0.04)",
            }
          : undefined
      }
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={
          isIncoming
            ? { background: "rgba(22,163,74,0.10)", color: "var(--success)" }
            : needsCat
              ? { background: "rgba(245,158,11,0.12)", color: "var(--warning)" }
              : { background: "rgba(11,11,15,0.06)", color: "var(--text-secondary)" }
        }
      >
        {isIncoming ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="7 13 12 18 17 13" />
            <line x1="12" y1="6" x2="12" y2="18" />
          </svg>
        ) : needsCat ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <CategoryIcon category={tx.category} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold truncate">{tx.libelle}</div>
        <div
          className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap"
          style={{ color: needsCat ? "var(--warning)" : "var(--text-secondary)" }}
        >
          {needsCat ? (
            <>
              À catégoriser
              {suggested && (
                <>
                  {" · "}Suggéré :{" "}
                  <span className="font-bold">{labelForCategory(suggested)}</span>
                </>
              )}
            </>
          ) : (
            <>
              {tx.category && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: isReconciled
                      ? "rgba(22,163,74,0.15)"
                      : "var(--surface-2)",
                    color: isReconciled
                      ? "var(--success)"
                      : "var(--text-secondary)",
                  }}
                >
                  {isReconciled ? "Note d'honoraires" : labelForCategory(tx.category)}
                </span>
              )}
              <span>{dateLabel}</span>
              {isReconciled && tx.linkedHonoraireSituation && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: "rgba(31,45,234,0.15)",
                    color: "var(--brand)",
                  }}
                >
                  Rapproché auto · {tx.linkedHonoraireSituation.numero}
                </span>
              )}
              {isRecurring && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Récurrente
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className="text-[15px] font-bold font-tabular"
          style={{ color: isIncoming ? "var(--success)" : "var(--text-primary)" }}
        >
          {isIncoming ? "+" : ""}
          {formatEuroFull(amount)} €
        </div>
        <div
          className="text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {tx.bankAccount.libelle}
        </div>
        {needsCat && suggested && (
          <button
            type="button"
            onClick={onCategorize}
            disabled={busy}
            className="text-[10px] font-semibold mt-0.5"
            style={{ color: "var(--warning)" }}
          >
            {busy ? "…" : "Catégoriser →"}
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string | null }) {
  if (!category) return <DefaultIcon />;
  if (category === "salaires")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6" />
        <path d="M23 11h-6" />
      </svg>
    );
  if (category === "loyer_bureau")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
    );
  if (category === "vehicules" || category === "deplacements")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
        <path d="M3 12l3-6h9l3 6h3v4h-3" />
      </svg>
    );
  if (category === "logiciels" || category === "telecom")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  return <DefaultIcon />;
}

function DefaultIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function labelForCategory(category: string): string {
  const map: Record<string, string> = {
    salaires: "Salaires",
    charges_sociales: "Charges sociales",
    loyer_bureau: "Loyer bureau",
    vehicules: "Véhicules",
    logiciels: "Logiciels",
    telecom: "Télécom",
    comptable: "Comptable",
    assurances: "Assurances",
    autres: "Autres",
    honoraires: "Honoraires",
    fournitures: "Fournitures",
    deplacements: "Déplacements",
    frais_de_bouche: "Frais de bouche",
  };
  return map[category] ?? category;
}

function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
