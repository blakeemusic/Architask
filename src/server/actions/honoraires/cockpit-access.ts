"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema/auth";
import { cockpitAccessGrants } from "@/db/schema/permissions";
import { operations } from "@/db/schema/operations";
import {
  type ActionResult,
  err,
  ok,
  withAction,
} from "@/server/actions/_helpers";

// ---------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------

const GrantAccessSchema = z.object({
  userId: z.string().uuid("User obligatoire."),
  scope: z.enum(["global", "operation"]),
  operationId: z.string().uuid().optional().nullable(),
});

const RevokeAccessSchema = z.object({
  id: z.string().uuid(),
});

const ListGrantsSchema = z.object({
  operationId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------

export async function grantCockpitAccess(
  rawInput: z.input<typeof GrantAccessSchema>,
): Promise<ActionResult<typeof cockpitAccessGrants.$inferSelect>> {
  return withAction(GrantAccessSchema, rawInput, async (input, { user }) => {
    if (user.role !== "owner" && user.role !== "admin") {
      return err(
        "Seul un Owner ou Admin peut accorder l'accès au Cockpit.",
        "forbidden",
      );
    }

    if (input.scope === "operation" && !input.operationId) {
      return err(
        "Préciser l'opération pour un grant 'operation'.",
        "missing_operation",
      );
    }

    const granteeUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, input.userId),
        eq(users.organizationId, user.organizationId),
      ),
    });
    if (!granteeUser) {
      return err("Utilisateur introuvable dans l'organisation.", "not_found");
    }

    if (input.scope === "operation") {
      const op = await db.query.operations.findFirst({
        where: and(
          eq(operations.id, input.operationId!),
          eq(operations.organizationId, user.organizationId),
        ),
        columns: { id: true },
      });
      if (!op) return err("Opération introuvable.", "not_found");
    }

    // Évite les doublons actifs (même user, même scope, même operation).
    const existing = await db.query.cockpitAccessGrants.findFirst({
      where: and(
        eq(cockpitAccessGrants.organizationId, user.organizationId),
        eq(cockpitAccessGrants.userId, input.userId),
        eq(cockpitAccessGrants.scope, input.scope),
        isNull(cockpitAccessGrants.revokedAt),
        input.scope === "operation"
          ? eq(cockpitAccessGrants.operationId, input.operationId!)
          : isNull(cockpitAccessGrants.operationId),
      ),
    });
    if (existing) return ok(existing);

    const [row] = await db
      .insert(cockpitAccessGrants)
      .values({
        organizationId: user.organizationId,
        userId: input.userId,
        scope: input.scope,
        operationId: input.scope === "operation" ? input.operationId! : null,
        grantedByUserId: user.userId,
      })
      .returning();

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "cockpit_grant",
      entityId: row.id,
      action: "created",
      payloadDiff: { scope: input.scope, granteeUserId: input.userId },
    });

    if (input.operationId) {
      revalidatePath(`/operations/${input.operationId}/honoraires`);
    }
    revalidatePath("/cockpit/honoraires");
    return ok(row);
  });
}

export async function revokeCockpitAccess(
  rawInput: z.input<typeof RevokeAccessSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(RevokeAccessSchema, rawInput, async ({ id }, { user }) => {
    if (user.role !== "owner" && user.role !== "admin") {
      return err(
        "Seul un Owner ou Admin peut révoquer un accès Cockpit.",
        "forbidden",
      );
    }

    const grant = await db.query.cockpitAccessGrants.findFirst({
      where: and(
        eq(cockpitAccessGrants.id, id),
        eq(cockpitAccessGrants.organizationId, user.organizationId),
      ),
    });
    if (!grant) return err("Grant introuvable.", "not_found");
    if (grant.revokedAt) return ok({ id });

    await db
      .update(cockpitAccessGrants)
      .set({ revokedAt: new Date() })
      .where(eq(cockpitAccessGrants.id, id));

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "cockpit_grant",
      entityId: id,
      action: "revoked",
    });

    if (grant.operationId) {
      revalidatePath(`/operations/${grant.operationId}/honoraires`);
    }
    revalidatePath("/cockpit/honoraires");
    return ok({ id });
  });
}

export async function listCockpitGrants(
  rawInput: z.input<typeof ListGrantsSchema>,
): Promise<
  ActionResult<
    Array<{
      id: string;
      scope: "global" | "operation";
      operationId: string | null;
      grantedAt: Date;
      revokedAt: Date | null;
      user: { id: string; name: string; email: string; role: string };
      grantedBy: { id: string; name: string };
    }>
  >
> {
  return withAction(ListGrantsSchema, rawInput, async (input, { user }) => {
    const grants = await db.query.cockpitAccessGrants.findMany({
      where: and(
        eq(cockpitAccessGrants.organizationId, user.organizationId),
        isNull(cockpitAccessGrants.revokedAt),
        input.operationId
          ? eq(cockpitAccessGrants.operationId, input.operationId)
          : undefined,
      ),
      orderBy: [desc(cockpitAccessGrants.grantedAt)],
      with: {
        user: { columns: { id: true, name: true, email: true, role: true } },
        grantedBy: { columns: { id: true, name: true } },
      },
    });
    return ok(
      grants.map((g) => ({
        id: g.id,
        scope: g.scope as "global" | "operation",
        operationId: g.operationId,
        grantedAt: g.grantedAt,
        revokedAt: g.revokedAt,
        user: g.user as { id: string; name: string; email: string; role: string },
        grantedBy: g.grantedBy as { id: string; name: string },
      })),
    );
  });
}

/**
 * MVP : "demande d'accès" simulée — on log juste un audit. En V1, on
 * créera une vraie notification Owner.
 */
const RequestAccessSchema = z.object({
  operationId: z.string().uuid(),
});
export async function requestCockpitAccess(
  rawInput: z.input<typeof RequestAccessSchema>,
): Promise<ActionResult<{ ownerName: string | null }>> {
  return withAction(RequestAccessSchema, rawInput, async (input, { user }) => {
    const op = await db.query.operations.findFirst({
      where: and(
        eq(operations.id, input.operationId),
        eq(operations.organizationId, user.organizationId),
      ),
      columns: { id: true, name: true },
    });
    if (!op) return err("Opération introuvable.", "not_found");

    const owner = await db.query.users.findFirst({
      where: and(
        eq(users.organizationId, user.organizationId),
        eq(users.role, "owner"),
      ),
      columns: { id: true, name: true },
    });

    await db.insert(auditLogs).values({
      organizationId: user.organizationId,
      userId: user.userId,
      entityType: "cockpit_grant",
      entityId: op.id,
      action: "access_requested",
      payloadDiff: { operationId: op.id, operationName: op.name },
    });

    return ok({ ownerName: owner?.name ?? null });
  });
}

export async function listOrgMembers(): Promise<
  ActionResult<
    Array<{ id: string; name: string; email: string; role: string }>
  >
> {
  return withAction(z.object({}), {}, async (_input, { user }) => {
    const members = await db.query.users.findMany({
      where: eq(users.organizationId, user.organizationId),
      columns: { id: true, name: true, email: true, role: true },
    });
    return ok(members);
  });
}
