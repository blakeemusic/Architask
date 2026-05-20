"use client";

import * as React from "react";
import { toast } from "sonner";

type VatByRate = { taux: string; collectee: string; deductible: string };

export function VatSummaryCard({
  year,
  month,
  tvaCollectee,
  tvaDeductible,
  tvaDue,
  byRate,
}: {
  year: number;
  month: number;
  tvaCollectee: string;
  tvaDeductible: string;
  tvaDue: string;
  byRate: VatByRate[];
}) {
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const collectee = Number(tvaCollectee);
  const deductible = Number(tvaDeductible);
  const total = byRate.reduce(
    (acc, r) => acc + Number(r.collectee) + Number(r.deductible),
    0,
  );

  return (
    <div
      className="p-6 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[12px] uppercase tracking-wider font-semibold"
          style={{ color: "rgba(59,27,122,0.55)" }}
        >
          TVA {monthLabel}
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: "rgba(59,27,122,0.10)",
            color: "#3B1B7A",
          }}
        >
          Prévisionnel
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div
            className="text-[11px] mb-1"
            style={{ color: "rgba(59,27,122,0.65)" }}
          >
            Collectée
          </div>
          <div className="flex items-baseline gap-1">
            <div
              className="font-bold font-tabular"
              style={{ fontSize: 28, letterSpacing: "-0.015em" }}
            >
              {formatEuroFull(collectee)}
            </div>
            <div
              className="text-[14px]"
              style={{ color: "rgba(59,27,122,0.55)" }}
            >
              €
            </div>
          </div>
        </div>
        <div>
          <div
            className="text-[11px] mb-1"
            style={{ color: "rgba(59,27,122,0.65)" }}
          >
            Déductible
          </div>
          <div className="flex items-baseline gap-1">
            <div
              className="font-bold font-tabular"
              style={{ fontSize: 28, letterSpacing: "-0.015em" }}
            >
              {formatEuroFull(deductible)}
            </div>
            <div
              className="text-[14px]"
              style={{ color: "rgba(59,27,122,0.55)" }}
            >
              €
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div
          className="text-[10px] flex items-center justify-between"
          style={{ color: "rgba(59,27,122,0.65)" }}
        >
          <span>Décomposition par taux</span>
          <span>déductible / total</span>
        </div>
        {byRate.map((r) => {
          const totalRate = Number(r.collectee) + Number(r.deductible);
          const pct =
            total > 0 ? (totalRate / total) * 100 : 0;
          return (
            <div key={r.taux}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold">
                  TVA {Number(r.taux).toFixed(0).replace("0.0", "0")} %
                </span>
                <span className="font-tabular font-bold">
                  {formatEuroFull(Number(r.deductible))} /{" "}
                  {formatEuroFull(totalRate)} €
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(59,27,122,0.10)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, pct))}%`,
                    background: "#3B1B7A",
                  }}
                />
              </div>
            </div>
          );
        })}
        {byRate.length === 0 && (
          <div
            className="text-[11px] py-2 text-center"
            style={{ color: "rgba(59,27,122,0.55)" }}
          >
            Pas encore de mouvement TVA ce mois.
          </div>
        )}
      </div>

      <div
        className="mt-5 pt-4 flex items-baseline justify-between"
        style={{ borderTop: "1px solid rgba(59,27,122,0.15)" }}
      >
        <span
          className="text-[12px] font-semibold"
          style={{ color: "#3B1B7A" }}
        >
          À reverser au Trésor
        </span>
        <div className="flex items-baseline gap-1">
          <div
            className="font-bold font-tabular"
            style={{ fontSize: 24, letterSpacing: "-0.015em" }}
          >
            {formatEuroFull(Number(tvaDue))}
          </div>
          <div
            className="text-[14px]"
            style={{ color: "rgba(59,27,122,0.55)" }}
          >
            €
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          toast.info(
            "Export CA3 — fonctionnalité prévue en V1 (intégration Pennylane).",
          )
        }
        className="w-full mt-3 py-2.5 rounded-2xl text-[12px] font-bold"
        style={{ background: "#3B1B7A", color: "white" }}
      >
        Exporter déclaration CA3
      </button>
    </div>
  );
}

function formatEuroFull(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
