"use client";

import * as React from "react";

type Event = {
  id: string;
  direction: "out" | "in";
  status: "envoyee" | "transmise" | "acceptee" | "refusee" | "payee";
  occurredAt: Date;
  honoraireSituation: {
    id: string;
    numero: string;
    montantTtc: string | null;
    operationName: string;
  } | null;
  expenseInvoice: {
    id: string;
    supplierName: string;
    montantTtc: string | null;
  } | null;
};

export function FacturationClient({
  config,
  events,
}: {
  config: {
    provider: string;
    externalOrgId: string | null;
    active: boolean;
  } | null;
  events: Event[];
}) {
  const [filter, setFilter] = React.useState<"all" | "out" | "in">("all");
  const filtered = events.filter((e) =>
    filter === "all" ? true : e.direction === filter,
  );

  const out = events.filter((e) => e.direction === "out");
  const inEvts = events.filter((e) => e.direction === "in");

  return (
    <>
      <div className="flex items-end justify-between mb-10">
        <div>
          <div
            className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            Cockpit · Facturation électronique
          </div>
          <h1
            className="text-[56px] font-bold tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            Facturation
          </h1>
          <p
            className="text-[15px] mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Émissions et réceptions Factur-X via votre PDP
          </p>
        </div>
      </div>

      {/* Config PDP */}
      <div
        className="p-6 rounded-3xl mb-8"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.10)" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold">
              {config
                ? `PDP ${labelProvider(config.provider)} · Connectée`
                : "Aucune PDP configurée"}
            </div>
            <div
              className="text-[12px] mt-1"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {config
                ? `Compte externe : ${config.externalOrgId ?? "—"} · Toutes les notes d'honoraires sont transmises automatiquement au format Factur-X`
                : "Configure une plateforme partenaire (Pennylane, Sage, Esker, …) pour envoyer tes notes d'honoraires en e-invoicing."}
            </div>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: config?.active
                ? "rgba(22,163,74,0.18)"
                : "rgba(255,255,255,0.10)",
              color: config?.active ? "#86EFAC" : "rgba(255,255,255,0.55)",
            }}
          >
            {config?.active ? "Actif" : "Inactif"}
          </span>
        </div>
      </div>

      {/* 3 KPI mini */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <KpiMini
          label="Notes émises"
          value={out.length.toString()}
          sub={`${out.filter((e) => e.status === "payee").length} payées`}
          tone="light"
        />
        <KpiMini
          label="Factures reçues"
          value={inEvts.length.toString()}
          sub="Factur-X entrantes"
          tone="mint"
        />
        <KpiMini
          label="En attente"
          value={out
            .filter(
              (e) =>
                e.status === "envoyee" ||
                e.status === "transmise" ||
                e.status === "acceptee",
            )
            .length.toString()}
          sub="Notes non payées"
          tone="lilac"
        />
      </div>

      {/* Timeline events */}
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
              Activité Factur-X
            </h3>
            <p
              className="text-[12px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {events.length} événements logués
            </p>
          </div>
          <div
            className="inline-flex items-center p-1 gap-1 rounded-2xl"
            style={{ background: "var(--surface-2)" }}
          >
            {[
              { v: "all", label: "Tout" },
              { v: "out", label: "Émises" },
              { v: "in", label: "Reçues" },
            ].map((o) => {
              const isActive = filter === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setFilter(o.v as "all" | "out" | "in")}
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
          {filtered.length === 0 && (
            <div
              className="py-10 text-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Aucun événement Factur-X pour ce filtre.
            </div>
          )}
          {filtered.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      </div>
    </>
  );
}

function EventRow({ event }: { event: Event }) {
  const isOut = event.direction === "out";
  const target = isOut
    ? event.honoraireSituation
    : event.expenseInvoice;
  const label = isOut
    ? `${event.honoraireSituation?.numero ?? "—"} · ${event.honoraireSituation?.operationName ?? "—"}`
    : `${event.expenseInvoice?.supplierName ?? "—"}`;
  const montant = Number(
    (isOut ? event.honoraireSituation?.montantTtc : event.expenseInvoice?.montantTtc) ??
      0,
  );

  return (
    <div className="px-4 py-3 rounded-2xl flex items-center gap-4 hover:bg-[var(--surface-2)] transition-colors">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: bgForStatus(event.status),
          color: fgForStatus(event.status),
        }}
      >
        {isOut ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22 6 12 13 2 6" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold truncate">{label}</div>
        <div
          className="text-[11px] mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          {isOut ? "Émise" : "Reçue"} le{" "}
          {event.occurredAt.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div className="text-right shrink-0">
        {target && (
          <div className="text-[13px] font-bold font-tabular">
            {formatEuro(montant)} €
          </div>
        )}
        <span
          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
          style={{
            background: bgForStatus(event.status),
            color: fgForStatus(event.status),
          }}
        >
          {labelForStatus(event.status)}
        </span>
      </div>
    </div>
  );
}

function KpiMini({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "light" | "mint" | "lilac";
}) {
  const style = (() => {
    switch (tone) {
      case "mint":
        return {
          background: "linear-gradient(135deg, #B8F2D1 0%, #DCFCE7 100%)",
          color: "#064E2C",
        };
      case "lilac":
        return {
          background: "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
          color: "#3B1B7A",
        };
      default:
        return { background: "var(--surface)", color: "var(--text-primary)" };
    }
  })();
  const subColor =
    tone === "mint"
      ? "rgba(6,78,44,0.65)"
      : tone === "lilac"
        ? "rgba(59,27,122,0.65)"
        : "var(--text-secondary)";
  const labelColor =
    tone === "mint"
      ? "rgba(6,78,44,0.55)"
      : tone === "lilac"
        ? "rgba(59,27,122,0.55)"
        : "var(--text-tertiary)";

  return (
    <div className="p-7 rounded-3xl" style={style}>
      <span
        className="text-[12px] uppercase tracking-wider font-semibold"
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <div className="mt-4 flex items-baseline gap-1">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 40, letterSpacing: "-0.025em" }}
        >
          {value}
        </div>
      </div>
      <div className="mt-3 text-[12px]" style={{ color: subColor }}>
        {sub}
      </div>
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
function labelForStatus(s: string): string {
  if (s === "envoyee") return "Envoyée";
  if (s === "transmise") return "Transmise PDP";
  if (s === "acceptee") return "Acceptée";
  if (s === "refusee") return "Refusée";
  if (s === "payee") return "Payée";
  return s;
}
function bgForStatus(s: string): string {
  if (s === "payee") return "rgba(22,163,74,0.15)";
  if (s === "acceptee" || s === "transmise") return "rgba(31,45,234,0.15)";
  if (s === "refusee") return "rgba(220,38,38,0.15)";
  return "rgba(245,158,11,0.15)";
}
function fgForStatus(s: string): string {
  if (s === "payee") return "var(--success)";
  if (s === "acceptee" || s === "transmise") return "var(--brand)";
  if (s === "refusee") return "var(--danger)";
  return "var(--warning)";
}
function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
