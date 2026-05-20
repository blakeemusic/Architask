"use client";

import * as React from "react";
import Link from "next/link";

export function CockpitRestrictedPanel({
  ownerName,
}: {
  ownerName: string | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
        style={{
          background: "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3B1B7A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1
        className="text-[36px] font-bold tracking-tight text-center"
        style={{ letterSpacing: "-0.025em" }}
      >
        Cockpit · Accès restreint
      </h1>
      <p
        className="text-[15px] mt-4 text-center max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        Le <strong>Cockpit</strong> regroupe le pilotage financier de
        l&apos;agence (honoraires, trésorerie, facturation). Il est réservé aux
        Owners et Admins par défaut.
      </p>
      {ownerName && (
        <p
          className="text-[14px] mt-3 text-center max-w-md"
          style={{ color: "var(--text-secondary)" }}
        >
          <strong>{ownerName}</strong> peut t&apos;accorder un accès global ou
          opération par opération.
        </p>
      )}
      <div className="mt-8">
        <Link
          href="/operations"
          className="inline-block px-5 py-2.5 rounded-2xl text-[13px] font-semibold text-white"
          style={{ background: "var(--text-primary)" }}
        >
          Retour aux opérations
        </Link>
      </div>
    </div>
  );
}
