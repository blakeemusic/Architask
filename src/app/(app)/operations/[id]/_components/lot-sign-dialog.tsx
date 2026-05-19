"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { signLot } from "@/server/actions/operations/lots";

export interface LotSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotNumero: string;
}

type CheckState =
  | { kind: "loading" }
  | { kind: "ready"; errors: string[]; warnings: string[]; canSign: boolean }
  | { kind: "error"; message: string };

/**
 * Dialog de confirmation pour signer un lot. Au mount, exécute signLot avec
 * dryRun=true pour collecter les erreurs/warnings sans muter la DB. L'utilisateur
 * peut alors confirmer (signature réelle) ou annuler.
 */
export function LotSignDialog({
  open,
  onOpenChange,
  lotId,
  lotNumero,
}: LotSignDialogProps) {
  const router = useRouter();
  const [state, setState] = React.useState<CheckState>({ kind: "loading" });
  const [submitting, setSubmitting] = React.useState(false);

  // Run dry-run on open. setState synchrone dans l'effet = volontaire ici :
  // on doit reset l'état à "loading" à chaque réouverture du drawer, le temps
  // que la requête de validation décennale revienne. Les patterns alternatifs
  // (key sur composant, useReducer) compliquent plus que ça n'apporte.
  React.useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    let cancelled = false;
    (async () => {
      const res = await signLot({ id: lotId, dryRun: true });
      if (cancelled) return;
      if (res.error || !res.data) {
        setState({
          kind: "error",
          message: res.error ?? "Validation impossible.",
        });
        return;
      }
      setState({
        kind: "ready",
        errors: res.data.errors,
        warnings: res.data.warnings,
        canSign: res.data.canSign,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lotId]);

  const handleSign = async () => {
    setSubmitting(true);
    const res = await signLot({ id: lotId, dryRun: false });
    setSubmitting(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Signature impossible.");
      return;
    }
    if (!res.data.canSign) {
      toast.error(res.data.errors[0] ?? "Signature bloquée.");
      return;
    }
    toast.success(`Lot n°${lotNumero} signé ✓`);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={520}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Signature du marché
            </div>
            <h2 className="title-xl mt-2">Signer le lot n°{lotNumero}</h2>
            <div
              className="text-[12px] mt-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Architask vérifie que la décennale de l&apos;entreprise est valide
              à la date d&apos;OS et couvre les activités du lot.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)" }}
          >
            <CloseIcon />
          </button>
        </div>
      </DrawerHeader>

      <DrawerBody>
        {state.kind === "loading" && (
          <div
            className="text-center py-12 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Vérification de la décennale…
          </div>
        )}

        {state.kind === "error" && (
          <div
            className="p-5 rounded-2xl"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1.5px solid var(--danger)",
            }}
          >
            <div
              className="flex items-center gap-2 mb-2"
              style={{ color: "var(--danger)" }}
            >
              <AlertIcon />
              <span className="text-[13px] font-bold">Erreur</span>
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
              {state.message}
            </div>
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-4">
            {state.canSign ? (
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "rgba(22,163,74,0.08)",
                  border: "1.5px solid var(--success)",
                }}
              >
                <div
                  className="flex items-center gap-2 mb-2"
                  style={{ color: "var(--success)" }}
                >
                  <CheckIcon />
                  <span className="text-[13px] font-bold">Décennale valide</span>
                </div>
                <div
                  className="text-[13px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Tous les contrôles NF P03-001 passent. Tu peux signer le lot.
                </div>
              </div>
            ) : (
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "rgba(220,38,38,0.06)",
                  border: "1.5px solid var(--danger)",
                }}
              >
                <div
                  className="flex items-center gap-2 mb-2"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertIcon />
                  <span className="text-[13px] font-bold">
                    Signature bloquée
                  </span>
                </div>
                <ul className="space-y-2 mt-2">
                  {state.errors.map((e, i) => (
                    <li
                      key={i}
                      className="text-[13px] leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.warnings.length > 0 && (
              <div
                className="p-5 rounded-2xl"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1.5px solid var(--warning)",
                }}
              >
                <div
                  className="flex items-center gap-2 mb-2"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertIcon />
                  <span className="text-[13px] font-bold">
                    Avertissement
                    {state.warnings.length > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="space-y-2 mt-2">
                  {state.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="text-[13px] leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className="p-4 rounded-xl text-[12px] leading-relaxed"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-secondary)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusPill variant="brand" size="sm">
                  NF P03-001
                </StatusPill>
                <span className="font-semibold">Règle bloquante</span>
              </div>
              La décennale doit être présente, valide à la date d&apos;OS, et
              couvrir l&apos;ensemble des activités du lot. Sans cela, le marché
              ne peut pas passer en signé.
            </div>
          </div>
        )}
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          onClick={handleSign}
          disabled={
            state.kind !== "ready" || !state.canSign || submitting
          }
        >
          {submitting ? "Signature…" : "Signer le lot"}
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
