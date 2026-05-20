"use client";

import * as React from "react";
import Link from "next/link";

type EmittedSituation = {
  id: string;
  numero: string;
  montantTtc: string | null;
  statut: "brouillon" | "a_valider" | "signee" | "envoyee" | "payee";
};

export function EInvoiceCard({
  pdpProvider,
  emittedThisMonth,
  receivedThisMonth,
  lastEmitted,
}: {
  pdpProvider: string | null;
  emittedThisMonth: number;
  receivedThisMonth: number;
  lastEmitted: EmittedSituation[];
}) {
  return (
    <div
      className="p-6 rounded-3xl"
      style={{
        background: "var(--text-primary)",
        color: "var(--surface)",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.10)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">Facturation électronique</div>
          <div
            className="text-[11px] mt-0.5 flex items-center gap-1.5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#86EFAC" }}
            />
            {pdpProvider
              ? `PDP ${labelProvider(pdpProvider)} · Connecté`
              : "PDP non configurée"}
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(22,163,74,0.18)", color: "#86EFAC" }}
        >
          Factur-X
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className="p-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Émises ce mois
          </div>
          <div className="text-[20px] font-bold font-tabular mt-1">
            {emittedThisMonth}
          </div>
        </div>
        <div
          className="p-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Reçues ce mois
          </div>
          <div className="text-[20px] font-bold font-tabular mt-1">
            {receivedThisMonth}
          </div>
        </div>
      </div>

      <div
        className="mt-4 pt-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="text-[11px] mb-3"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Dernières émissions Factur-X
        </div>
        <div className="space-y-2">
          {lastEmitted.length === 0 && (
            <div
              className="text-[12px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Aucune note émise pour le moment.
            </div>
          )}
          {lastEmitted.slice(0, 3).map((s) => {
            const isPaid = s.statut === "payee";
            return (
              <div key={s.id} className="flex items-center gap-2 text-[11px]">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{
                    background: isPaid
                      ? "rgba(22,163,74,0.18)"
                      : "rgba(245,158,11,0.18)",
                    color: isPaid ? "#86EFAC" : "#FBBF24",
                  }}
                >
                  {isPaid ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )}
                </div>
                <span
                  className="flex-1 truncate"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {s.numero}
                </span>
                <span className="font-tabular font-bold">
                  {formatEuroFull(Number(s.montantTtc ?? 0))} €
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/cockpit/facturation"
        className="block w-full mt-4 py-2 rounded-2xl text-[12px] font-semibold flex items-center justify-center gap-2"
        style={{ background: "rgba(255,255,255,0.10)" }}
      >
        Voir toutes les factures électroniques
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}

function labelProvider(p: string): string {
  if (p === "pennylane") return "Pennylane";
  if (p === "sage") return "Sage";
  if (p === "esker") return "Esker";
  if (p === "generix") return "Generix";
  return p;
}

function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
