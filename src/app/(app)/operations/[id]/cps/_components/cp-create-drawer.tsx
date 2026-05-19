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
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatMoneyCompact,
  formatMoneyFull,
} from "@/lib/format";
import {
  createSituationFromManual,
  createSituationFromOCR,
  updateSituation,
} from "@/server/actions/operations/situations";
import {
  createCPFromSituation,
  signCP,
  validateCP,
} from "@/server/actions/operations/cps";
import type { CompanyListItem } from "@/server/actions/annuaire/companies";

import { OcrValidationCard, type OcrPoste } from "./ocr-validation-card";

type Step = 1 | 2 | 3;

type LotChoice = {
  id: string;
  numero: string;
  libelle: string;
  company: { id: string; raisonSociale: string } | null;
};

type ManualMode = "global" | "lines";

type DraftCp = {
  id: string;
  numero: string;
  cumulTravauxHt: string;
  cumulCpPrecedentsHt: string;
  brutAPayerHt: string;
  retenueGarantie: string;
  revisionMontantHt: string | null;
  tva: string;
  netTtc: string;
  statut: string;
};

export interface CpCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string;
  lots: LotChoice[];
  companies: CompanyListItem[];
}

export function CpCreateDrawer({
  open,
  onOpenChange,
  operationId,
  lots,
  companies,
}: CpCreateDrawerProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);

  // Étape 1 — Choix
  const [lotId, setLotId] = React.useState<string>(lots[0]?.id ?? "");
  const [source, setSource] = React.useState<"pdf" | "manuel">("pdf");
  const [manualMode, setManualMode] = React.useState<ManualMode>("global");
  const [pctGlobal, setPctGlobal] = React.useState<string>("50");
  const [period] = React.useState<{ mois: number; annee: number }>(() => {
    const d = new Date();
    return { mois: d.getMonth() + 1, annee: d.getFullYear() };
  });

  // OCR state — postes inclut situationLineId pour pouvoir update après édition.
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = React.useState(false);
  const [ocrError, setOcrError] = React.useState<string | null>(null);
  const [ocrPostes, setOcrPostes] = React.useState<
    Array<OcrPoste & { situationLineId?: string; montantCumuleHt?: number }>
  >([]);
  const [ocrConfidenceGlobale, setOcrConfidenceGlobale] = React.useState<number | null>(null);
  const [situationId, setSituationId] = React.useState<string | null>(null);

  // Étape 2 — CP draft
  const [draftCp, setDraftCp] = React.useState<DraftCp | null>(null);
  const [creating, setCreating] = React.useState(false);

  // Étape 3 — submit
  const [signing, setSigning] = React.useState(false);

  // Suppress unused
  void companies;

  // Reset on close — setStates synchrones dans l'effet volontaires ici :
  // ne s'exécutent qu'à la transition open=true→false.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) return;
    setStep(1);
    setSource("pdf");
    setOcrPostes([]);
    setOcrError(null);
    setOcrConfidenceGlobale(null);
    setSituationId(null);
    setDraftCp(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // OCR upload
  const handlePdfFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.includes("pdf")) {
      toast.error("PDF uniquement.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF trop volumineux (max 20 Mo).");
      return;
    }
    if (!lotId) {
      toast.error("Choisis d'abord un lot.");
      return;
    }
    setOcrLoading(true);
    setOcrError(null);
    setOcrPostes([]);
    setOcrConfidenceGlobale(null);

    const buf = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    const res = await createSituationFromOCR({
      lotId,
      periodeMois: period.mois,
      periodeAnnee: period.annee,
      base64Pdf: base64,
      mimeType: file.type,
      filename: file.name,
    });
    setOcrLoading(false);

    if (res.error || !res.data) {
      // Cas spécial : situation déjà existante pour ce lot+période →
      // on affiche un toast actionnable avec un bouton "Voir / mettre à
      // jour" plutôt qu'une erreur brute.
      if (res.code === "situation_exists") {
        toast.warning(res.error ?? "Situation déjà présente pour cette période.", {
          action: {
            label: "Changer de période",
            onClick: () => setOcrError("Choisis une autre période pour éviter le doublon."),
          },
          duration: 10000,
        });
        return;
      }
      setOcrError(res.error ?? "Échec OCR.");
      return;
    }
    setSituationId(res.data.situation.id);
    setOcrConfidenceGlobale(res.data.ocrSummary.confidenceGlobale);
    toast.success(
      `OCR terminé : ${res.data.ocrSummary.nbPostes} postes (confiance globale ${Math.round(res.data.ocrSummary.confidenceGlobale)}%)`,
    );

    // Affiche les vrais postes retournés par Claude (avec situationLineId
    // pour pouvoir persister les éditions de l'utilisateur).
    setOcrPostes(
      res.data.postes.map((p) => ({
        situationLineId: p.id,
        designation: p.designation,
        unite: p.unite ?? undefined,
        pctAvancement: p.pctAvancement,
        montantCumuleHt: p.montantCumuleHt,
        confidence: p.confidence,
        matchedDpgfLineId: p.matchedDpgfLineId ?? undefined,
      })),
    );
  };

  // Étape 1 → Étape 2 : créer la situation (manual ou via OCR déjà créée) +
  // créer le draft CP.
  const handleContinueToStep2 = async () => {
    setCreating(true);
    let sitId = situationId;

    if (source === "manuel") {
      const res = await createSituationFromManual({
        lotId,
        periodeMois: period.mois,
        periodeAnnee: period.annee,
        ...(manualMode === "global"
          ? { pctGlobal }
          : { lines: [] }), // sprint suivant
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "Création situation impossible.");
        setCreating(false);
        return;
      }
      sitId = res.data.id;
    }

    if (!sitId) {
      toast.error("Aucune situation prête.");
      setCreating(false);
      return;
    }

    // Si source=pdf et l'utilisateur a édité des % dans les OcrValidationCard,
    // on persiste les modifications avant de calculer le CP.
    if (source === "pdf" && ocrPostes.length > 0) {
      const editedLines = ocrPostes
        .filter((p) => p.situationLineId)
        .map((p) => ({
          id: p.situationLineId as string,
          pctAvancement: p.pctAvancement.toFixed(2),
          montantCumuleHt:
            p.montantCumuleHt !== undefined
              ? p.montantCumuleHt.toFixed(2)
              : null,
        }));
      if (editedLines.length > 0) {
        await updateSituation({ id: sitId, lines: editedLines });
      }
    }

    const cpRes = await createCPFromSituation({ situationId: sitId });
    setCreating(false);
    if (cpRes.error || !cpRes.data) {
      toast.error(cpRes.error ?? "Création CP impossible.");
      return;
    }
    setDraftCp(cpRes.data.cp);
    for (const w of cpRes.data.warnings) toast.warning(w);
    setStep(2);
  };

  const handleSign = async () => {
    if (!draftCp) return;
    setSigning(true);
    // valide + sign en une fois en MVP (si Owner)
    if (draftCp.statut === "brouillon") {
      await validateCP({ id: draftCp.id });
    }
    const res = await signCP({ id: draftCp.id });
    setSigning(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Signature impossible.");
      return;
    }
    toast.success(`CP ${draftCp.numero} signé ✓`);
    onOpenChange(false);
    router.refresh();
    router.push(`/operations/${operationId}/cps/${draftCp.id}`);
  };

  const handleSaveDraft = () => {
    if (!draftCp) return;
    toast.success(`Brouillon ${draftCp.numero} enregistré.`);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} width={720}>
      <DrawerHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div
              className="text-[12px] uppercase tracking-[0.6px] font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Certificat de paiement
            </div>
            <h2 className="title-xl mt-2">Nouveau CP</h2>
            <Stepper step={step} />
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
        {step === 1 && (
          <Step1
            lots={lots}
            lotId={lotId}
            setLotId={setLotId}
            source={source}
            setSource={setSource}
            manualMode={manualMode}
            setManualMode={setManualMode}
            pctGlobal={pctGlobal}
            setPctGlobal={setPctGlobal}
            ocrLoading={ocrLoading}
            ocrError={ocrError}
            ocrPostes={ocrPostes}
            ocrConfidenceGlobale={ocrConfidenceGlobale}
            setOcrPostes={setOcrPostes}
            fileRef={fileRef}
            onPdfFile={handlePdfFile}
            period={period}
          />
        )}

        {step === 2 && draftCp && (
          <Step2 draftCp={draftCp} />
        )}

        {step === 3 && draftCp && <Step3 cpId={draftCp.id} />}
      </DrawerBody>

      <DrawerFooter>
        {step === 1 && (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleContinueToStep2}
              disabled={
                creating ||
                !lotId ||
                (source === "pdf" && !situationId) ||
                (source === "manuel" && !pctGlobal)
              }
            >
              {creating ? "Calcul…" : "Continuer →"}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Retour
            </Button>
            <Button onClick={() => setStep(3)}>Aperçu PDF →</Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Retour
            </Button>
            <Button variant="light" onClick={handleSaveDraft}>
              Enregistrer brouillon
            </Button>
            <Button onClick={handleSign} disabled={signing}>
              {signing ? "Signature…" : "Signer maintenant"}
            </Button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  );
}

// ---------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <StepDot n={1} active={step >= 1} done={step > 1} label="Situation" />
      <Bar done={step > 1} />
      <StepDot n={2} active={step >= 2} done={step > 2} label="Calcul" />
      <Bar done={step > 2} />
      <StepDot n={3} active={step >= 3} done={false} label="Aperçu" />
    </div>
  );
}

function StepDot({
  n,
  active,
  done,
  label,
}: {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
        style={{
          background: done
            ? "var(--success)"
            : active
              ? "var(--black)"
              : "var(--surface-2)",
          color: done || active ? "white" : "var(--text-tertiary)",
        }}
      >
        {done ? "✓" : n}
      </div>
      <span
        className="text-[13px]"
        style={{
          color: active ? "var(--text-primary)" : "var(--text-tertiary)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Bar({ done }: { done: boolean }) {
  return (
    <div
      className="flex-1 h-0.5"
      style={{ background: done ? "var(--success)" : "var(--surface-2)" }}
    />
  );
}

// ---------------------------------------------------------------
// Étape 1
// ---------------------------------------------------------------

function Step1({
  lots,
  lotId,
  setLotId,
  source,
  setSource,
  manualMode,
  setManualMode,
  pctGlobal,
  setPctGlobal,
  ocrLoading,
  ocrError,
  ocrPostes,
  ocrConfidenceGlobale,
  setOcrPostes,
  fileRef,
  onPdfFile,
  period,
}: {
  lots: LotChoice[];
  lotId: string;
  setLotId: (v: string) => void;
  source: "pdf" | "manuel";
  setSource: (v: "pdf" | "manuel") => void;
  manualMode: ManualMode;
  setManualMode: (v: ManualMode) => void;
  pctGlobal: string;
  setPctGlobal: (v: string) => void;
  ocrLoading: boolean;
  ocrError: string | null;
  ocrPostes: OcrPoste[];
  ocrConfidenceGlobale: number | null;
  setOcrPostes: (postes: OcrPoste[]) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPdfFile: (file: File | null) => void;
  period: { mois: number; annee: number };
}) {
  const [dragging, setDragging] = React.useState(false);
  return (
    <div className="space-y-5">
      {/* Lot + période */}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Lot *">
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[var(--brand)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.numero} · {l.libelle} ({l.company?.raisonSociale ?? "—"})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Période">
          <div
            className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {String(period.mois).padStart(2, "0")}/{period.annee}
          </div>
        </Field>
      </div>

      {/* Source */}
      <div>
        <span
          className="text-[12px] font-semibold mb-2 block"
          style={{ color: "var(--text-secondary)" }}
        >
          Source de la situation
        </span>
        <div className="flex gap-2">
          <SourcePill
            active={source === "pdf"}
            onClick={() => setSource("pdf")}
            label="PDF (OCR)"
            recommended
          />
          <SourcePill
            active={source === "manuel"}
            onClick={() => setSource("manuel")}
            label="Manuel"
          />
          <SourcePill
            active={false}
            onClick={() => toast.info("Bientôt — import Excel via SheetJS")}
            label="Excel"
            disabled
          />
        </div>
      </div>

      {source === "pdf" && (
        <>
          {ocrPostes.length === 0 ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onPdfFile(e.dataTransfer.files[0] ?? null);
              }}
              className="px-5 py-12 rounded-2xl cursor-pointer text-center transition-colors"
              style={{
                background: dragging
                  ? "var(--brand-soft)"
                  : "var(--surface)",
                border: `1.5px dashed ${dragging ? "var(--brand)" : "var(--border-strong)"}`,
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => onPdfFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {ocrLoading ? (
                <div
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Extraction Claude Vision…
                </div>
              ) : (
                <>
                  <div
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Glisser le PDF de situation ou cliquer pour parcourir
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    OCR Claude Sonnet 4.6 Vision · max 10 pages · max 20 Mo
                  </div>
                </>
              )}
              {ocrError && (
                <div
                  className="mt-4 text-[12px] font-medium"
                  style={{ color: "var(--danger)" }}
                >
                  {ocrError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">
                  Postes extraits par Claude Vision
                </div>
                {ocrConfidenceGlobale !== null && (
                  <StatusPill
                    variant={
                      ocrConfidenceGlobale >= 95
                        ? "success"
                        : ocrConfidenceGlobale >= 70
                          ? "warning"
                          : "danger"
                    }
                    size="sm"
                  >
                    Conf. globale {Math.round(ocrConfidenceGlobale)} %
                  </StatusPill>
                )}
              </div>
              <div className="space-y-2.5">
                {ocrPostes.map((p, i) => (
                  <OcrValidationCard
                    key={i}
                    index={i}
                    poste={p}
                    onChange={(next) => {
                      const arr = [...ocrPostes];
                      arr[i] = next;
                      setOcrPostes(arr);
                    }}
                  />
                ))}
              </div>
              <Card variant="section" padding="sm">
                <div
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ✅ Situation enregistrée en DB. Les valeurs OCR ont été
                  pré-enregistrées. Tu pourras affiner chaque % à l&apos;étape
                  suivante avant signature.
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {source === "manuel" && (
        <>
          <div>
            <span
              className="text-[12px] font-semibold mb-2 block"
              style={{ color: "var(--text-secondary)" }}
            >
              Mode de saisie
            </span>
            <div className="flex gap-2">
              <SourcePill
                active={manualMode === "global"}
                onClick={() => setManualMode("global")}
                label="% global"
              />
              <SourcePill
                active={false}
                onClick={() =>
                  toast.info("Bientôt — saisie par poste DPGF")
                }
                label="Par poste DPGF"
                disabled
              />
            </div>
          </div>
          {manualMode === "global" && (
            <Field label="% d'avancement global *">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={pctGlobal}
                onChange={(e) => setPctGlobal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[14px] font-tabular outline-none focus:ring-2 focus:ring-[var(--brand)]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <span
                className="text-[11px] mt-1 block"
                style={{ color: "var(--text-tertiary)" }}
              >
                Appliqué au marché révisé du lot.
              </span>
            </Field>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Étape 2 — Calcul
// ---------------------------------------------------------------

function Step2({ draftCp }: { draftCp: DraftCp }) {
  const compact = formatMoneyCompact(draftCp.netTtc);
  return (
    <div className="space-y-5">
      {/* Hero mint */}
      <Card variant="mint" padding="lg">
        <span
          className="text-[12px] uppercase tracking-[0.6px] font-semibold"
          style={{ color: "rgba(6,78,44,0.55)" }}
        >
          Net à payer TTC
        </span>
        <div className="mt-3 flex items-baseline gap-1">
          <div className="num-hero font-tabular">{compact.display}</div>
          <div className="text-[28px] font-semibold ml-1">{compact.unit}</div>
        </div>
        <div
          className="mt-3 text-[12px]"
          style={{ color: "rgba(6,78,44,0.65)" }}
        >
          {draftCp.numero}
        </div>
      </Card>

      {/* Card noire ventilation */}
      <Card variant="black" padding="lg">
        <div
          className="text-[12px] uppercase tracking-[0.6px] font-semibold mb-4"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Détail du calcul
        </div>
        <div className="space-y-2 text-[13px] font-tabular">
          <Row label="Cumul travaux exécutés HT" value={draftCp.cumulTravauxHt} />
          <Row label="− Cumul CP précédents" value={draftCp.cumulCpPrecedentsHt} muted />
          <div
            className="flex justify-between font-bold pt-2.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
          >
            <span>Brut à payer HT</span>
            <span>{formatMoneyFull(draftCp.brutAPayerHt)}</span>
          </div>
          <Row label="− Retenue garantie" value={draftCp.retenueGarantie} muted negative />
          {draftCp.revisionMontantHt && Number(draftCp.revisionMontantHt) !== 0 && (
            <Row label="+ Révision" value={draftCp.revisionMontantHt} muted signed />
          )}
          <Row label="+ TVA" value={draftCp.tva} muted positive />
          <div
            className="flex justify-between text-[18px] font-bold pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
          >
            <span>Net TTC</span>
            <span>{formatMoneyFull(draftCp.netTtc)}</span>
          </div>
        </div>
      </Card>

      <div
        className="text-[12px] p-4 rounded-xl"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-secondary)",
        }}
      >
        💡 Les ajustements manuels (override retenue, formule révision custom)
        viendront dans un sprint suivant. Pour MVP, les valeurs sont calculées
        automatiquement par le moteur computeCP (decimal.js, conforme NF P03-001).
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  negative,
  positive,
  signed,
}: {
  label: string;
  value: string;
  muted?: boolean;
  negative?: boolean;
  positive?: boolean;
  signed?: boolean;
}) {
  const prefix = negative ? "− " : positive ? "+ " : signed && Number(value) > 0 ? "+ " : "";
  return (
    <div className="flex justify-between">
      <span style={{ color: muted ? "rgba(255,255,255,0.65)" : "white" }}>
        {label}
      </span>
      <span style={{ color: muted ? "rgba(255,255,255,0.85)" : "white" }}>
        {prefix}
        {formatMoneyFull(value)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------
// Étape 3 — Aperçu
// ---------------------------------------------------------------

function Step3({ cpId }: { cpId: string }) {
  // Cache-buster : nouveau timestamp à chaque mount du composant pour
  // forcer le navigateur à re-fetcher le PDF (sinon il peut servir la
  // version cachée de l'itération précédente).
  const [cacheBuster] = React.useState(() => Date.now());
  return (
    <div className="space-y-4">
      <div
        className="text-[13px]"
        style={{ color: "var(--text-secondary)" }}
      >
        Aperçu du PDF généré dynamiquement. Au moment de signer, ce PDF sera
        figé et stocké dans le coffre privé (`.uploads/`).
      </div>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          height: 600,
          background: "var(--surface)",
        }}
      >
        <iframe
          src={`/api/cps/${cpId}/pdf?t=${cacheBuster}`}
          className="w-full h-full"
          title="Aperçu PDF du CP"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Pieces réutilisables
// ---------------------------------------------------------------

function SourcePill({
  active,
  onClick,
  label,
  recommended,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  recommended?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2.5 rounded-2xl text-[13px] font-semibold transition-all duration-[180ms]"
      style={{
        background: active ? "var(--black)" : "var(--surface)",
        color: active
          ? "var(--surface)"
          : disabled
            ? "var(--text-tertiary)"
            : "var(--text-primary)",
        border: active ? "none" : "1px solid var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
      {recommended && (
        <span
          className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md"
          style={{
            background: active ? "rgba(255,255,255,0.15)" : "var(--brand-soft)",
            color: active ? "white" : "var(--brand)",
          }}
        >
          Recommandé
        </span>
      )}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="text-[12px] font-semibold mb-1.5 block"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </label>
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}
