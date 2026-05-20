import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { env } from "@/lib/env";

/**
 * Extraction d'une facture / ticket de dépense (fournisseur, montant, TVA)
 * depuis un PDF ou une photo via Claude Sonnet 4.6 Vision.
 *
 * Accepte :
 *   - application/pdf  (justificatif PDF — facture fournisseur, ticket caisse PDF)
 *   - image/jpeg, image/png  (photo de reçu prise sur mobile)
 *
 * Retour normalisé : fournisseur, date, montant HT/TVA/TTC, taux TVA,
 * confiance globale. Token usage loggué dans console.info.
 */

const ResponseSchema = z.object({
  fournisseur: z.string().min(1),
  dateFacture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ISO YYYY-MM-DD attendue"),
  montantHt: z.number().min(0),
  montantTva: z.number().min(0),
  montantTtc: z.number().min(0),
  tauxTva: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
});

export type ExtractExpenseInvoiceData = z.infer<typeof ResponseSchema>;

export type ExtractExpenseInvoiceResult =
  | { ok: true; data: ExtractExpenseInvoiceData }
  | {
      ok: false;
      error: string;
      code:
        | "ocr_api_error"
        | "ocr_timeout"
        | "ocr_invalid_json"
        | "unsupported_mime";
    };

const TIMEOUT_MS = 60_000;
const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function extractExpenseInvoice(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractExpenseInvoiceResult> {
  if (!SUPPORTED_MIME.has(mimeType)) {
    return {
      ok: false,
      error: `Type de fichier non supporté (${mimeType}). PDF ou image (jpeg/png/webp).`,
      code: "unsupported_mime",
    };
  }
  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY non configurée. Renseigne-la dans .env.local pour utiliser l'OCR.",
      code: "ocr_api_error",
    };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const systemPrompt = `Tu es un expert OCR pour factures et tickets de caisse en France. Tu extrais les
informations clés au format JSON strict, sans aucune phrase d'introduction.

Réponds UNIQUEMENT avec un JSON conforme à ce schéma :
{
  "fournisseur": string,         // nom du fournisseur / commerçant
  "dateFacture": string,          // ISO YYYY-MM-DD
  "montantHt": number,            // €, point décimal
  "montantTva": number,           // €, point décimal
  "montantTtc": number,           // €, point décimal
  "tauxTva": number,              // 20, 10, 5.5 ou 0
  "confidence": number            // 0 à 100, ta confiance globale
}

Règles :
- Si la facture montre plusieurs taux de TVA, retourne le taux MAJORITAIRE.
- Si tu n'es pas sûr d'un champ, baisse confidence en conséquence.
- N'invente JAMAIS de valeurs : si introuvable, mets 0 et baisse la confidence.
- Si le ticket ne montre que le TTC, déduis HT et TVA à partir du taux.`;

  const buffer64 = fileBuffer.toString("base64");

  const callPromise = client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          mimeType === "application/pdf"
            ? {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: buffer64,
                },
              }
            : {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as
                    | "image/jpeg"
                    | "image/png"
                    | "image/webp",
                  data: buffer64,
                },
              },
          {
            type: "text",
            text: "Extrais les données de cette facture / ce reçu au format JSON strict.",
          },
        ],
      },
    ],
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("ocr_timeout")),
      TIMEOUT_MS,
    ),
  );

  let resp;
  try {
    resp = await Promise.race([callPromise, timeoutPromise]);
  } catch (e) {
    if (e instanceof Error && e.message === "ocr_timeout") {
      return {
        ok: false,
        error: "OCR a dépassé le délai. Réessaie ou saisie manuelle.",
        code: "ocr_timeout",
      };
    }
    return {
      ok: false,
      error: `Erreur OCR : ${e instanceof Error ? e.message : "inconnue"}`,
      code: "ocr_api_error",
    };
  }

  const firstText = resp.content.find((c) => c.type === "text");
  if (!firstText || firstText.type !== "text") {
    return {
      ok: false,
      error: "Réponse OCR vide.",
      code: "ocr_invalid_json",
    };
  }
  // Strip code fences éventuelles
  const raw = firstText.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "OCR a retourné un JSON invalide.",
      code: "ocr_invalid_json",
    };
  }
  const safe = ResponseSchema.safeParse(parsed);
  if (!safe.success) {
    return {
      ok: false,
      error: `JSON OCR non conforme : ${safe.error.issues[0]?.message ?? ""}`,
      code: "ocr_invalid_json",
    };
  }

  console.info("[OCR] expense", {
    tokensIn: resp.usage.input_tokens,
    tokensOut: resp.usage.output_tokens,
    confidence: safe.data.confidence,
    fournisseur: safe.data.fournisseur,
  });
  return { ok: true, data: safe.data };
}
