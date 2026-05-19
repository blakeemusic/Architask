import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { env } from "@/lib/env";

/**
 * Extraction d'une situation entreprise depuis un PDF via Claude Sonnet 4.6
 * Vision.
 *
 * Approche : on envoie le PDF DIRECTEMENT comme content block "document"
 * (supporté nativement par Claude API depuis 2024), pas de pré-rendu image.
 * Plus simple, moins cher en tokens, gestion multipage native.
 *
 * Token usage : loggué dans console.info au format
 *   "[OCR] situation tokens=in_XXXX_out_XXXX confidence=YY%"
 *
 * Cap : 10 pages max par PDF. Au-delà → erreur "pdf_too_long".
 */

const PosteSchema = z.object({
  designation: z.string(),
  unite: z.string().optional(),
  quantiteExecutee: z.number().optional(),
  pctAvancement: z.number().min(0).max(100),
  montantCumuleHt: z.number().optional(),
  confidence: z.number().min(0).max(100),
});

const ResponseSchema = z.object({
  postes: z.array(PosteSchema),
  confidenceGlobale: z.number().min(0).max(100),
});

export type ExtractedPoste = z.infer<typeof PosteSchema> & {
  matchedDpgfLineId?: string;
};

export type ExtractSituationOk = {
  data: {
    postes: ExtractedPoste[];
    confidenceGlobale: number;
    rawTextFallback: string;
  };
  error?: undefined;
  errorCode?: undefined;
};

export type ExtractSituationErr = {
  data?: undefined;
  error: string;
  errorCode: "pdf_too_long" | "ocr_timeout" | "ocr_invalid_json" | "ocr_api_error";
};

export type ExtractSituationResult = ExtractSituationOk | ExtractSituationErr;

export type DpgfLineRef = {
  id: string;
  designation: string;
  unite: string | null;
  prixUnitaireHt: string | null;
};

const MAX_PAGES = 10;
const TIMEOUT_MS = 90_000;

/**
 * Heuristique : compte le nombre de pages PDF en cherchant "/Type /Page"
 * dans le buffer. Approximatif mais suffisant pour un garde-fou.
 */
function countPdfPages(buffer: Buffer): number {
  const sample = buffer.toString("latin1");
  const matches = sample.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

export async function extractSituation(
  pdfBuffer: Buffer,
  context: {
    lotMarcheHt: string;
    dpgfLines?: DpgfLineRef[];
  },
): Promise<ExtractSituationResult> {
  // Garde-fou taille / pages
  const pages = countPdfPages(pdfBuffer);
  if (pages > MAX_PAGES) {
    return {
      error: `PDF trop long (${pages} pages, max ${MAX_PAGES}). Divise-le ou utilise la saisie manuelle.`,
      errorCode: "pdf_too_long",
    };
  }

  if (!env.ANTHROPIC_API_KEY) {
    return {
      error:
        "ANTHROPIC_API_KEY non configurée. Renseigne-la dans .env.local pour utiliser l'OCR.",
      errorCode: "ocr_api_error",
    };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const dpgfHint = context.dpgfLines && context.dpgfLines.length > 0
    ? `\n\nPostes DPGF connus (utilise-les pour matcher la désignation si elle correspond) :\n${context.dpgfLines
        .map(
          (l) =>
            `- "${l.designation}" (${l.unite ?? "?"}, PU ${l.prixUnitaireHt ?? "?"} €)`,
        )
        .join("\n")}`
    : "";

  const systemPrompt = `Tu es un assistant qui lit des situations de travaux d'entreprise BTP en français (marché privé, NF P03-001).

Le PDF contient un tableau avec typiquement ces colonnes (les libellés peuvent varier) :
- "Désignation" / "Postes" / "Description" → texte de la ligne
- "Unité" / "Un." / "U." → m², m³, u., ml, etc.
- "Quantité" / "Qté" / "Qté exécutée" → nombre
- "% Avancement" / "% AVT" / "% Av." → nombre 0-100
- "Cumul HT" / "Montant cumulé HT" / "Cumul" → montant en euros

Retourne UNIQUEMENT du JSON conforme au schéma suivant, sans texte avant/après, sans bloc \`\`\` :

{
  "postes": [
    {
      "designation": "string — RECOPIE LE TEXTE LITTÉRAL DU PDF",
      "unite": "string optional",
      "quantiteExecutee": "number optional",
      "pctAvancement": "number 0-100",
      "montantCumuleHt": "number optional, EN EUROS sans la devise",
      "confidence": "number 0-100 — varie selon la lisibilité réelle"
    }
  ],
  "confidenceGlobale": "number 0-100"
}

RÈGLES STRICTES :

1. designation : COPIE EXACTEMENT le texte du PDF, mot pour mot. JAMAIS de libellé générique.
   ✅ Bon : "Terrassements généraux", "Fondations superficielles", "Voiles béton armé R+1", "Plancher haut RDC"
   ❌ Mauvais : "Poste 1", "Poste 1 extrait", "Première ligne", "Item X", "Poste principal n°1"

2. pctAvancement : LIS la valeur de la colonne "% AVT" / "% Avancement" / "% Av." pour CHAQUE ligne.
   Si la cellule contient "30 %" → renvoie 30. Si elle contient "100%" → renvoie 100.
   NE PAS mettre 0 par défaut — c'est une donnée critique pour le calcul du CP.

3. montantCumuleHt : LIS la valeur de la colonne "Cumul HT" / "Cumul" pour CHAQUE ligne, EN EUROS, sans la devise, sans séparateur de milliers.
   Si la cellule contient "70 848 €" → renvoie 70848. Si elle contient "1 234,50 €" → renvoie 1234.50.
   ❌ Ne pas mettre "Montant non extrait" — utilise une valeur numérique ou omets le champ.

4. confidence : VARIE selon ta certitude réelle ligne par ligne.
   ✅ Bon : 98, 95, 88, 72, 95, 65 (différent selon difficulté)
   ❌ Mauvais : 80, 80, 80, 80, 80 (tous identiques)
   • 95-100 : valeurs très claires et nettes
   • 70-94 : lisibles mais une ambiguïté (chiffre flou, désignation peu claire)
   • <70 : difficile à lire, faible certitude

5. confidenceGlobale : moyenne pondérée + ajustement selon la qualité globale du PDF.

6. Si tu n'arrives pas à lire une valeur, omets le champ optionnel plutôt que d'inventer.

Marché HT du lot : ${context.lotMarcheHt} €.${dpgfHint}`;

  try {
    const startedAt = Date.now();
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBuffer.toString("base64"),
                },
              },
              {
                type: "text",
                text: "Extrais les postes et leur avancement depuis ce PDF de situation. Retourne uniquement le JSON.",
              },
            ],
          },
        ],
      },
      { timeout: TIMEOUT_MS },
    );

    const durationMs = Date.now() - startedAt;
    const usage = response.usage;
    console.info(
      `[OCR] extractSituation tokens=in_${usage.input_tokens}_out_${usage.output_tokens} duration=${durationMs}ms pages=${pages}`,
    );

    // Concatène toutes les parties text de la réponse.
    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    if (!rawText) {
      return {
        error: "Réponse OCR vide.",
        errorCode: "ocr_invalid_json",
      };
    }

    // Strip ```json fences si Claude en a ajoutées malgré la consigne.
    const cleaned = rawText
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[OCR] JSON parse failed, raw text:", rawText.slice(0, 200));
      return {
        error:
          "L'OCR a renvoyé un format inattendu. Vérifie le PDF ou utilise la saisie manuelle.",
        errorCode: "ocr_invalid_json",
      };
    }

    const validated = ResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn("[OCR] Zod validation failed:", validated.error.issues);
      return {
        error:
          "L'OCR a renvoyé un schéma invalide. Vérifie le PDF ou utilise la saisie manuelle.",
        errorCode: "ocr_invalid_json",
      };
    }

    // Matching DPGF (Levenshtein simple, optionnel).
    const postesWithMatch: ExtractedPoste[] = validated.data.postes.map(
      (poste) => {
        if (!context.dpgfLines || context.dpgfLines.length === 0) return poste;
        const best = findBestDpgfMatch(poste.designation, context.dpgfLines);
        if (best && best.score > 0.6) {
          return { ...poste, matchedDpgfLineId: best.line.id };
        }
        return poste;
      },
    );

    return {
      data: {
        postes: postesWithMatch,
        confidenceGlobale: validated.data.confidenceGlobale,
        rawTextFallback: rawText,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return { error: "OCR Claude Vision a expiré (>90s). Re-tente ou bascule en saisie manuelle.", errorCode: "ocr_timeout" };
    }
    console.error("[OCR] API error:", e);
    return {
      error: `Erreur OCR : ${msg}`,
      errorCode: "ocr_api_error",
    };
  }
}

// ---------------------------------------------------------------
// Matching DPGF — similarité naïve (Dice coefficient sur trigrammes)
// ---------------------------------------------------------------

function findBestDpgfMatch(
  designation: string,
  lines: DpgfLineRef[],
): { line: DpgfLineRef; score: number } | null {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .trim();

  const target = normalize(designation);
  let best: { line: DpgfLineRef; score: number } | null = null;
  for (const line of lines) {
    const candidate = normalize(line.designation);
    const score = diceCoefficient(target, candidate);
    if (!best || score > best.score) {
      best = { line, score };
    }
  }
  return best;
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));
  let intersection = 0;
  for (const g of bigramsA) if (bigramsB.has(g)) intersection += 1;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
