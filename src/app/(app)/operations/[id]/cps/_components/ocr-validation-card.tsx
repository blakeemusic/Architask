"use client";

import * as React from "react";

import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export type OcrPoste = {
  designation: string;
  unite?: string;
  pctAvancement: number;
  montantCumuleHt?: number;
  confidence: number;
  matchedDpgfLineId?: string;
};

export function OcrValidationCard({
  poste,
  onChange,
  index,
}: {
  poste: OcrPoste;
  onChange: (next: OcrPoste) => void;
  index: number;
}) {
  const conf = poste.confidence;
  const tone: "success" | "warning" | "danger" =
    conf >= 95 ? "success" : conf >= 70 ? "warning" : "danger";
  const borderColor =
    tone === "success"
      ? "var(--border)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--danger)";
  const bgColor =
    tone === "warning"
      ? "rgba(245,158,11,0.06)"
      : tone === "danger"
        ? "rgba(220,38,38,0.06)"
        : "var(--surface)";

  return (
    <div
      className={cn(
        "p-4 flex items-center gap-4 transition-colors",
      )}
      style={{
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 18,
      }}
    >
      <div
        className="w-1 self-stretch rounded-full"
        style={{
          background:
            tone === "success"
              ? "var(--success)"
              : tone === "warning"
                ? "var(--warning)"
                : "var(--danger)",
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold font-tabular" style={{ color: "var(--text-tertiary)" }}>
            #{String(index + 1).padStart(2, "0")}
          </span>
          <div
            className="text-[13px] font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {poste.designation}
          </div>
        </div>
        <div
          className="text-[11px] font-tabular mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          {poste.unite ? `${poste.unite} · ` : ""}
          {poste.montantCumuleHt !== undefined
            ? `Cumul ${new Intl.NumberFormat("fr-FR").format(Math.round(poste.montantCumuleHt))} €`
            : "Montant non extrait"}
        </div>
        {tone !== "success" && (
          <div
            className="text-[11px] mt-1 font-medium"
            style={{
              color: tone === "warning" ? "var(--warning)" : "var(--danger)",
            }}
          >
            {tone === "warning"
              ? "⚠ Vérifie la valeur avant validation"
              : "⚠ Confiance basse, à corriger"}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={poste.pctAvancement}
            onChange={(e) =>
              onChange({
                ...poste,
                pctAvancement: Math.max(0, Math.min(100, Number(e.target.value))),
              })
            }
            className="w-16 px-2 py-1 text-right rounded-lg text-[13px] font-tabular font-semibold outline-none"
            style={{
              background: "var(--surface)",
              border: `1.5px solid ${borderColor}`,
            }}
          />
          <span
            className="text-[12px]"
            style={{ color: "var(--text-secondary)" }}
          >
            %
          </span>
        </div>
        <StatusPill variant={tone} size="sm">
          {conf} %
        </StatusPill>
      </div>
    </div>
  );
}
