"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestCockpitAccess } from "@/server/actions/honoraires/cockpit-access";

export function RestrictedAccessPanel({
  operationId,
  operationName,
  ownerName,
}: {
  operationId: string;
  operationName: string;
  ownerName: string | null;
}) {
  const [pending, setPending] = React.useState(false);

  const onRequest = async () => {
    setPending(true);
    try {
      const res = await requestCockpitAccess({ operationId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const who = res.data?.ownerName ?? ownerName ?? "l'Owner";
      toast.success(`Demande d'accès envoyée à ${who}.`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
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
        style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
      >
        Accès restreint au Cockpit
      </h1>
      <p
        className="text-[15px] mt-4 text-center max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        L&apos;onglet <strong>Honoraires</strong> fait partie du Cockpit —
        l&apos;espace de pilotage financier réservé aux Owners et Admins de
        l&apos;agence par défaut.
      </p>
      <p
        className="text-[14px] mt-3 text-center max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        {ownerName ? (
          <>
            <strong>{ownerName}</strong> peut t&apos;inviter ponctuellement à
            consulter le contrat et les notes d&apos;honoraires de cette
            opération.
          </>
        ) : (
          "Demande à un Owner de te donner accès si tu en as besoin."
        )}
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button onClick={onRequest} disabled={pending}>
          {pending
            ? "Envoi…"
            : ownerName
              ? `Demander l'accès à ${ownerName} →`
              : "Demander l'accès →"}
        </Button>
      </div>

      <div
        className="mt-12 text-[11px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--text-tertiary)" }}
      >
        Opération · {operationName}
      </div>
    </div>
  );
}
