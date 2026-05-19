import { eq, sql, and } from "drizzle-orm";

import { db as defaultDb } from "@/db";
import { numberingCounters } from "@/db/schema/finance";

/**
 * Numérotation atomique pour les CP, NH, avenants, etc.
 *
 * Pattern Postgres : INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
 * Atomique : pas de race condition même sous load concurrent.
 *
 * Format scope (séparateur ":") :
 *   - "cp:<lot_id>"
 *   - "nh:<operation_id>:<year>"
 *   - "avenant:<lot_id>"
 *
 * Format numéro humain (composé côté caller avec le code opération + lot) :
 *   - CP  : "CP-{op-code}-{lot-num}-{N}"     (N sur 3 chiffres : 001, 002, …)
 *   - NH  : "NH-{op-code}-{year}-{N}"
 *   - AV  : "AV-{lot-num}-{N}" (V1 — pas géré ici)
 */

type DbClient = typeof defaultDb;

async function increment(
  organizationId: string,
  scope: string,
  db: DbClient = defaultDb,
): Promise<number> {
  // INSERT (current_value=1) si scope absent, sinon UPDATE current_value+1.
  // Tout ça atomique sous une seule requête grâce à ON CONFLICT.
  const result = await db
    .insert(numberingCounters)
    .values({
      organizationId,
      scope,
      currentValue: 1,
    })
    .onConflictDoUpdate({
      target: [numberingCounters.organizationId, numberingCounters.scope],
      set: {
        currentValue: sql`${numberingCounters.currentValue} + 1`,
      },
    })
    .returning({ currentValue: numberingCounters.currentValue });

  const value = result[0]?.currentValue;
  if (typeof value !== "number") {
    throw new Error(
      `Échec de la numérotation atomique pour le scope "${scope}".`,
    );
  }
  return value;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

// ---------------------------------------------------------------
// API publique
// ---------------------------------------------------------------

export type NextNumberOptions = {
  organizationId: string;
  /** Si fourni, override le client db par défaut (utile pour tests). */
  db?: DbClient;
};

export async function nextCPNumber(
  opts: NextNumberOptions & {
    operationCode: string;
    lotId: string;
    lotNumero: string;
  },
): Promise<{ numero: string; sequence: number }> {
  const seq = await increment(
    opts.organizationId,
    `cp:${opts.lotId}`,
    opts.db ?? defaultDb,
  );
  return {
    numero: `CP-${opts.operationCode}-${opts.lotNumero}-${pad(seq, 3)}`,
    sequence: seq,
  };
}

export async function nextNHNumber(
  opts: NextNumberOptions & {
    operationCode: string;
    operationId: string;
    year: number;
  },
): Promise<{ numero: string; sequence: number }> {
  const seq = await increment(
    opts.organizationId,
    `nh:${opts.operationId}:${opts.year}`,
    opts.db ?? defaultDb,
  );
  return {
    numero: `NH-${opts.operationCode}-${opts.year}-${pad(seq, 3)}`,
    sequence: seq,
  };
}

/**
 * Peek (lecture seule) — utile pour afficher le prochain numéro sans incrémenter.
 * À utiliser en preview uniquement, pas pour réserver le numéro.
 */
export async function peekCounter(
  opts: NextNumberOptions & { scope: string },
): Promise<number> {
  const db = opts.db ?? defaultDb;
  const row = await db
    .select({ currentValue: numberingCounters.currentValue })
    .from(numberingCounters)
    .where(
      and(
        eq(numberingCounters.organizationId, opts.organizationId),
        eq(numberingCounters.scope, opts.scope),
      ),
    )
    .limit(1);
  return row[0]?.currentValue ?? 0;
}
