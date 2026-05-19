"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  avenants,
  lots,
  situations,
  situationLines,
} from "@/db/schema/operations";
import { extractSituation } from "@/lib/ocr/extractSituation";
import { upload as uploadFile } from "@/lib/storage/local";
import { type ActionResult, err, ok, withAction } from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const SituationLineInput = z.object({
  dpgfLineId: z.string().uuid().optional().nullable(),
  pctAvancement: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "% invalide."),
  montantCumuleHt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide.")
    .optional()
    .nullable(),
  ocrConfidence: z.number().int().min(0).max(100).optional().nullable(),
});

const CreateFromManualSchema = z.object({
  lotId: z.string().uuid(),
  periodeMois: z.number().int().min(1).max(12),
  periodeAnnee: z.number().int().min(2020).max(2100),
  /** Mode global : 1 ligne avec pctAvancement uniquement. */
  pctGlobal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  /** Mode lines : N lignes avec pct + montant. */
  lines: z.array(SituationLineInput).optional(),
});

const CreateFromOCRSchema = z.object({
  lotId: z.string().uuid(),
  periodeMois: z.number().int().min(1).max(12),
  periodeAnnee: z.number().int().min(2020).max(2100),
  base64Pdf: z.string(),
  mimeType: z.string().default("application/pdf"),
  filename: z.string().default("situation.pdf"),
});

const UpdateSituationSchema = z.object({
  id: z.string().uuid(),
  lines: z.array(
    SituationLineInput.extend({ id: z.string().uuid().optional() }),
  ),
});

const LotIdSchema = z.object({ lotId: z.string().uuid() });
const SituationIdSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function assertLotBelongsToOrg(lotId: string, organizationId: string) {
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, lotId),
    with: {
      operation: { columns: { id: true, organizationId: true } },
      avenants: true,
    },
  });
  if (!lot || lot.operation.organizationId !== organizationId) return null;
  return lot;
}

// ---------------------------------------------------------------
// Actions — Create from manual
// ---------------------------------------------------------------

export async function createSituationFromManual(
  rawInput: z.input<typeof CreateFromManualSchema>,
) {
  return withAction(CreateFromManualSchema, rawInput, async (input, { user }) => {
    const lot = await assertLotBelongsToOrg(input.lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    if (lot.statut === "en_preparation") {
      return err(
        "Lot non signé : émettre un CP nécessite un marché signé.",
        "lot_not_signed",
      );
    }
    if (!input.pctGlobal && (!input.lines || input.lines.length === 0)) {
      return err(
        "Renseigne soit un % global, soit des lignes par poste.",
        "missing_data",
      );
    }

    // Preflight : vérifie que la situation n'existe pas déjà pour cette
    // période (unique index lot_id + periode_annee + periode_mois).
    const conflict = await db.query.situations.findFirst({
      where: and(
        eq(situations.lotId, input.lotId),
        eq(situations.periodeMois, input.periodeMois),
        eq(situations.periodeAnnee, input.periodeAnnee),
      ),
      columns: { id: true },
    });
    if (conflict) {
      return err(
        "Une situation existe déjà pour ce lot et cette période. Tu peux la mettre à jour ou choisir une autre période.",
        "situation_exists",
      );
    }

    const [situationRow] = await db
      .insert(situations)
      .values({
        lotId: input.lotId,
        periodeMois: input.periodeMois,
        periodeAnnee: input.periodeAnnee,
        source: "manual",
        ocrStatus: "done",
      })
      .returning();

    if (input.lines && input.lines.length > 0) {
      for (const l of input.lines) {
        await db.insert(situationLines).values({
          situationId: situationRow.id,
          dpgfLineId: l.dpgfLineId ?? null,
          pctAvancement: l.pctAvancement,
          montantCumuleHt: l.montantCumuleHt ?? "0",
          ocrConfidence: l.ocrConfidence ?? null,
        });
      }
    } else if (input.pctGlobal) {
      // Mode global : 1 ligne "fictive" pour matérialiser
      await db.insert(situationLines).values({
        situationId: situationRow.id,
        pctAvancement: input.pctGlobal,
        montantCumuleHt: "0",
      });
    }

    revalidatePath(`/operations/${lot.operation.id}`);
    return ok(situationRow);
  });
}

// ---------------------------------------------------------------
// Actions — Create from OCR (Claude Vision)
// ---------------------------------------------------------------

export async function createSituationFromOCR(
  rawInput: z.input<typeof CreateFromOCRSchema>,
) {
  return withAction(CreateFromOCRSchema, rawInput, async (input, { user }) => {
    const lot = await assertLotBelongsToOrg(input.lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    if (lot.statut === "en_preparation") {
      return err(
        "Lot non signé : émettre un CP nécessite un marché signé.",
        "lot_not_signed",
      );
    }

    // Preflight : situation existe déjà ? On retourne une erreur structurée
    // pour que l'UI propose à l'utilisateur de la mettre à jour plutôt que
    // de bloquer sur une violation d'unique index Postgres.
    const conflict = await db.query.situations.findFirst({
      where: and(
        eq(situations.lotId, input.lotId),
        eq(situations.periodeMois, input.periodeMois),
        eq(situations.periodeAnnee, input.periodeAnnee),
      ),
      columns: { id: true },
    });
    if (conflict) {
      return err(
        `Une situation existe déjà pour ce lot en ${String(input.periodeMois).padStart(2, "0")}/${input.periodeAnnee}. Tu peux la mettre à jour avec ces nouvelles valeurs ou choisir une autre période.`,
        "situation_exists",
      );
    }

    const buffer = Buffer.from(input.base64Pdf, "base64");
    if (buffer.length > 20 * 1024 * 1024) {
      return err("PDF trop volumineux (max 20 Mo).", "pdf_too_large");
    }

    // Stockage du PDF original (kind: situation_raw).
    const fileResult = await uploadFile({
      organizationId: user.organizationId,
      buffer,
      mimeType: input.mimeType,
      originalFilename: input.filename,
      kind: "situation_raw",
      uploadedBy: user.userId,
    });

    // OCR via Claude Vision. Pre-existing DPGF lines pour le matching.
    const dpgfRefs = await db.query.dpgfLines.findMany({
      where: eq(lots.id, input.lotId),
      columns: { id: true, designation: true, unite: true, prixUnitaireHt: true },
    });

    const ocrResult = await extractSituation(buffer, {
      lotMarcheHt: lot.montantMarcheHt,
      dpgfLines: dpgfRefs,
    });

    if (!ocrResult.data) {
      return err(ocrResult.error, ocrResult.errorCode);
    }
    const ocrData = ocrResult.data;

    const [situationRow] = await db
      .insert(situations)
      .values({
        lotId: input.lotId,
        periodeMois: input.periodeMois,
        periodeAnnee: input.periodeAnnee,
        source: "pdf",
        fileId: fileResult.fileId,
        ocrStatus: "done",
        ocrConfidence: Math.round(ocrData.confidenceGlobale),
      })
      .returning();

    // INSERT lignes + récupère les rows pour les renvoyer à l'UI avec leurs IDs.
    const insertedLines: Array<{
      id: string;
      designation: string;
      unite: string | null;
      pctAvancement: number;
      montantCumuleHt: number;
      confidence: number;
      matchedDpgfLineId: string | null;
    }> = [];
    for (const poste of ocrData.postes) {
      const [row] = await db
        .insert(situationLines)
        .values({
          situationId: situationRow.id,
          dpgfLineId: poste.matchedDpgfLineId ?? null,
          pctAvancement: poste.pctAvancement.toFixed(2),
          montantCumuleHt:
            poste.montantCumuleHt !== undefined
              ? poste.montantCumuleHt.toFixed(2)
              : "0",
          ocrConfidence: Math.round(poste.confidence),
        })
        .returning();
      insertedLines.push({
        id: row.id,
        designation: poste.designation,
        unite: poste.unite ?? null,
        pctAvancement: poste.pctAvancement,
        montantCumuleHt: poste.montantCumuleHt ?? 0,
        confidence: poste.confidence,
        matchedDpgfLineId: poste.matchedDpgfLineId ?? null,
      });
    }

    revalidatePath(`/operations/${lot.operation.id}`);
    return ok({
      situation: situationRow,
      postes: insertedLines,
      ocrSummary: {
        confidenceGlobale: ocrData.confidenceGlobale,
        nbPostes: ocrData.postes.length,
      },
    });
  });
}

// ---------------------------------------------------------------
// Update / List / Get
// ---------------------------------------------------------------

export async function updateSituation(
  rawInput: z.infer<typeof UpdateSituationSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(UpdateSituationSchema, rawInput, async (input, { user }) => {
    const existing = await db.query.situations.findFirst({
      where: eq(situations.id, input.id),
      with: { lot: { with: { operation: { columns: { id: true, organizationId: true } } } } },
    });
    if (
      !existing ||
      existing.lot.operation.organizationId !== user.organizationId
    ) {
      return err("Situation introuvable.", "not_found");
    }

    // Update lines : pour chaque ligne avec id → UPDATE, sinon → INSERT.
    for (const line of input.lines) {
      if (line.id) {
        await db
          .update(situationLines)
          .set({
            pctAvancement: line.pctAvancement,
            montantCumuleHt: line.montantCumuleHt ?? "0",
            updatedAt: new Date(),
          })
          .where(eq(situationLines.id, line.id));
      } else {
        await db.insert(situationLines).values({
          situationId: input.id,
          dpgfLineId: line.dpgfLineId ?? null,
          pctAvancement: line.pctAvancement,
          montantCumuleHt: line.montantCumuleHt ?? "0",
        });
      }
    }
    revalidatePath(`/operations/${existing.lot.operation.id}`);
    return ok({ id: input.id });
  });
}

export async function listSituationsByLot(
  rawInput: z.infer<typeof LotIdSchema>,
) {
  return withAction(LotIdSchema, rawInput, async ({ lotId }, { user }) => {
    const lot = await assertLotBelongsToOrg(lotId, user.organizationId);
    if (!lot) return err("Lot introuvable.", "not_found");
    const rows = await db.query.situations.findMany({
      where: eq(situations.lotId, lotId),
      orderBy: [desc(situations.periodeAnnee), desc(situations.periodeMois)],
      with: { lines: { orderBy: [asc(situationLines.id)] } },
    });
    return ok(rows);
  });
}

export async function getSituationById(
  rawInput: z.infer<typeof SituationIdSchema>,
) {
  return withAction(SituationIdSchema, rawInput, async ({ id }, { user }) => {
    const sit = await db.query.situations.findFirst({
      where: eq(situations.id, id),
      with: {
        lot: {
          with: {
            operation: { columns: { id: true, organizationId: true } },
            avenants: true,
            company: true,
          },
        },
        lines: { with: { dpgfLine: true } },
        file: true,
      },
    });
    if (
      !sit ||
      sit.lot.operation.organizationId !== user.organizationId
    ) {
      return err("Situation introuvable.", "not_found");
    }
    return ok(sit);
  });
}

// Suppress unused-imports
void and;
void avenants;
