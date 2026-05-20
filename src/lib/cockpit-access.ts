import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { cockpitAccessGrants } from "@/db/schema/permissions";
import { users } from "@/db/schema/auth";
import type { CurrentUser } from "@/lib/auth";

/**
 * Accès au Cockpit (Honoraires + Trésorerie + Rapprochement + Facturation).
 *
 * Règle métier (PRD §5) :
 *   - Les rôles `owner` et `admin` ont accès par défaut à TOUT le Cockpit.
 *   - Les `member` / `viewer` n'ont accès QUE si un `CockpitAccessGrant`
 *     valide existe (revokedAt IS NULL), avec :
 *       - scope = "global" (accès toutes opérations), ou
 *       - scope = "operation" AND operationId = celle demandée.
 */
export async function canAccessCockpit(
  user: Pick<CurrentUser, "userId" | "organizationId" | "role">,
  operationId?: string | null,
): Promise<boolean> {
  if (user.role === "owner" || user.role === "admin") return true;

  const conditions = operationId
    ? or(
        eq(cockpitAccessGrants.scope, "global"),
        and(
          eq(cockpitAccessGrants.scope, "operation"),
          eq(cockpitAccessGrants.operationId, operationId),
        ),
      )
    : eq(cockpitAccessGrants.scope, "global");

  const grant = await db.query.cockpitAccessGrants.findFirst({
    where: and(
      eq(cockpitAccessGrants.organizationId, user.organizationId),
      eq(cockpitAccessGrants.userId, user.userId),
      isNull(cockpitAccessGrants.revokedAt),
      conditions,
    ),
  });

  return Boolean(grant);
}

/**
 * Retourne le premier Owner de l'organisation (pour notifications
 * "Demande d'accès envoyée à X"). Fallback Admin si pas d'Owner.
 */
export async function getOrganizationOwner(organizationId: string): Promise<{
  id: string;
  name: string;
  email: string;
} | null> {
  const owner = await db.query.users.findFirst({
    where: and(
      eq(users.organizationId, organizationId),
      eq(users.role, "owner"),
    ),
    columns: { id: true, name: true, email: true },
  });
  if (owner) return owner;
  const admin = await db.query.users.findFirst({
    where: and(
      eq(users.organizationId, organizationId),
      eq(users.role, "admin"),
    ),
    columns: { id: true, name: true, email: true },
  });
  return admin ?? null;
}
