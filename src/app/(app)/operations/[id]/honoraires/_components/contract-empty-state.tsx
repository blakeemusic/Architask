"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function ContractEmptyState({
  operationName,
  onCreate,
}: {
  operationName: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
        style={{
          background: "linear-gradient(135deg, #B8F2D1 0%, #DCFCE7 100%)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#064E2C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      </div>
      <h1
        className="text-[36px] font-bold tracking-tight text-center"
        style={{ letterSpacing: "-0.025em" }}
      >
        Aucun contrat d&apos;honoraires
      </h1>
      <p
        className="text-[15px] mt-4 text-center max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        Pour démarrer la facturation des honoraires sur{" "}
        <strong>{operationName}</strong>, créez le contrat d&apos;honoraires
        avec la MOA puis ajoutez vos missions (libres) jusqu&apos;à 100 %.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button onClick={onCreate}>+ Créer le contrat d&apos;honoraires</Button>
      </div>
    </div>
  );
}
