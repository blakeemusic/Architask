import * as React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  OPERATION_STATUS_LABEL,
  formatMoneyCompactString,
} from "@/lib/format";

import { OperationLogo } from "../operation-logo";
import { ProgressBarGradient } from "./progress-bar-gradient";

type OperationStatut =
  | "en_preparation"
  | "signe"
  | "en_execution"
  | "en_reception"
  | "dgd"
  | "clos";

export interface OperationCardProps {
  id: string;
  code: string;
  name: string;
  moaName: string | null;
  ville?: string | null;
  statut: OperationStatut;
  lotsCount: number;
  marcheReviseHt: string;
  pctAvancement: number;
  dateOs?: Date | null;
  dateReceptionCible?: Date | null;
}

/**
 * Card grid d'opération — variante de la liste mais en grid 2-3 cols.
 * Réutilise les tokens du DS (card-l, num-md, label-*).
 */
export function OperationCard({
  id,
  code,
  name,
  moaName,
  ville,
  statut,
  lotsCount,
  marcheReviseHt,
  pctAvancement,
  dateReceptionCible,
}: OperationCardProps) {
  return (
    <Link
      href={`/operations/${id}`}
      style={{ textDecoration: "none" }}
      className="block"
    >
      <Card
        variant="white"
        padding="lg"
        className="cursor-pointer transition-all duration-[180ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-start gap-4 mb-5">
          <OperationLogo code={code} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label-eyebrow">{code}</span>
              <StatusPill variant={statutPillVariant(statut)} size="sm">
                {OPERATION_STATUS_LABEL[statut] ?? statut}
              </StatusPill>
            </div>
            <div className="font-bold text-[16px] mt-1 truncate">{name}</div>
            <div
              className="text-[12px] truncate mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {moaName ?? "MOA non renseigné"}
              {ville ? ` · ${ville}` : ""}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Lots
            </div>
            <div className="num-md font-tabular">{lotsCount}</div>
          </div>
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Marché HT
            </div>
            <div className="text-[20px] font-bold font-tabular -tracking-[0.01em]">
              {formatMoneyCompactString(marcheReviseHt)}
            </div>
          </div>
        </div>

        <ProgressBarGradient
          pct={pctAvancement}
          endDate={dateReceptionCible ?? undefined}
        />
        <div
          className="text-[11px] mt-2 font-tabular"
          style={{ color: "var(--text-tertiary)" }}
        >
          {pctAvancement}% du planning écoulé
        </div>
      </Card>
    </Link>
  );
}

function statutPillVariant(
  s: OperationStatut,
): "success" | "warning" | "info" | "neutral" | "brand" {
  switch (s) {
    case "en_preparation":
      return "neutral";
    case "signe":
    case "en_execution":
      return "info";
    case "en_reception":
      return "warning";
    case "dgd":
      return "success";
    case "clos":
      return "neutral";
  }
}
