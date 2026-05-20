"use client";

import * as React from "react";

export function CaptureMobileCard() {
  return (
    <div
      className="p-6 rounded-3xl relative overflow-hidden"
      style={{
        background: "var(--text-primary)",
        color: "var(--surface)",
      }}
    >
      <div className="flex items-start gap-3 mb-4 relative z-10">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.10)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">Capture photo mobile</div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            OCR Claude Vision · Rapprochement auto
          </div>
        </div>
      </div>

      {/* iPhone mockup */}
      <div
        className="relative mx-auto mt-3"
        style={{
          width: 200,
          height: 320,
          background: "#1a1a1a",
          borderRadius: 28,
          padding: 8,
        }}
      >
        <div
          className="w-full h-full overflow-hidden relative"
          style={{ background: "var(--surface)", borderRadius: 22 }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "linear-gradient(180deg, #f3f4f6 0%, #d1d5db 100%)",
            }}
          >
            <div
              className="w-32 bg-white rounded-lg shadow-2xl p-3 text-[8px]"
              style={{ transform: "rotate(-3deg)" }}
            >
              <div className="text-center font-bold text-[10px] mb-1">
                LE PETIT BISTROT
              </div>
              <div
                className="text-center text-[7px] mb-2"
                style={{ color: "#666" }}
              >
                15 rue de la Paix · Paris 2e
              </div>
              <div className="space-y-0.5 font-mono text-[7px]">
                <div className="flex justify-between">
                  <span>Plat du jour</span>
                  <span>18,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Plat du jour</span>
                  <span>22,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Carafe d&apos;eau</span>
                  <span>0,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Café</span>
                  <span>3,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Café</span>
                  <span>3,00</span>
                </div>
                <div className="border-t my-1" />
                <div className="flex justify-between">
                  <span>HT</span>
                  <span>58,91</span>
                </div>
                <div className="flex justify-between">
                  <span>TVA 10%</span>
                  <span>5,89</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>TOTAL TTC</span>
                  <span>64,80</span>
                </div>
              </div>
            </div>
          </div>
          {/* OCR overlay */}
          <div
            className="absolute inset-x-0 bottom-0 p-3"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 50%)",
              color: "white",
            }}
          >
            <div
              className="text-[9px] font-semibold mb-1.5"
              style={{ color: "#86EFAC" }}
            >
              ✓ Reçu détecté · OCR 96%
            </div>
            <div className="space-y-1 text-[8px]">
              <Row label="Fournisseur" value="Le Petit Bistrot" />
              <Row label="Date" value="02/05/26" />
              <Row label="Total TTC" value="64,80 €" />
              <Row label="TVA 10%" value="5,89 €" valueColor="#86EFAC" />
            </div>
            <div
              className="mt-2 px-2 py-1.5 rounded-md text-[8px] font-bold text-center"
              style={{ background: "var(--brand)" }}
            >
              ✓ Rapproché avec CB 64,80 € · 2 mai
            </div>
          </div>
        </div>
      </div>

      <div
        className="text-center mt-4 text-[11px]"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        Disponible sur iPad et navigateur mobile
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "rgba(255,255,255,0.65)" }}>{label}</span>
      <span
        className="font-bold font-tabular"
        style={{ color: valueColor ?? "white" }}
      >
        {value}
      </span>
    </div>
  );
}
