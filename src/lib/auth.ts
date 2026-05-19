import { cache } from "react";

import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations, users, type userRoleEnum } from "@/db/schema/auth";

export type AppRole = (typeof userRoleEnum.enumValues)[number];

export type CurrentUser = {
  /** UUID Architask interne du user (table users.id). */
  userId: string;
  /** UUID Architask interne de l'organisation (table organizations.id). */
  organizationId: string;
  /** Rôle dans cette organisation. */
  role: AppRole;
  /** Clerk user id (text — utile pour identifier le user côté Clerk SDK). */
  clerkUserId: string;
  /** Email du user, snapshot. */
  email: string;
  /** Nom complet, snapshot. */
  name: string;
};

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Lazy-init de l'organisation et du user au premier accès authentifié.
 *
 * MVP : pas de webhook Clerk. À chaque requête authentifiée, on s'assure
 * que la ligne users + organizations existent dans notre DB. À migrer vers
 * un webhook `user.created` / `organization.created` Clerk en V1 (cf.
 * src/db/migrations/README.md). Pour éviter les races, on s'appuie sur des
 * INSERT idempotents (ON CONFLICT DO NOTHING).
 *
 * Stratégie :
 *  1. Si Clerk a un orgId actif, on récupère ou crée une org Architask
 *     liée à ce clerk_org_id.
 *  2. Sinon (Clerk Organizations désactivées dans le dashboard), on crée
 *     une "personal org" Architask sans clerk_org_id, partagée par toutes
 *     les sessions du même user humain.
 *  3. On insère le user Architask correspondant si absent.
 *
 * Cached via React.cache() pour ne pas re-query plusieurs fois par requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId) {
    throw new UnauthenticatedError();
  }

  // 1. Trouver ou créer l'organisation Architask.
  const organization = clerkOrgId
    ? await findOrCreateOrgByClerkId(clerkUserId, clerkOrgId)
    : await findOrCreatePersonalOrg(clerkUserId);

  // 2. Trouver ou créer le user Architask dans cette organisation.
  const userRow = await findOrCreateUser({
    clerkUserId,
    organizationId: organization.id,
    // Le premier user d'une org devient owner.
    isFirstUser: true,
  });

  return {
    userId: userRow.id,
    organizationId: organization.id,
    role: userRow.role,
    clerkUserId,
    email: userRow.email,
    name: userRow.name,
  };
});

// ---------------------------------------------------------------
// Internals
// ---------------------------------------------------------------

async function findOrCreateOrgByClerkId(clerkUserId: string, clerkOrgId: string) {
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, clerkOrgId),
  });
  if (existing) return existing;

  // Récupérer le nom et slug depuis Clerk pour le snapshot.
  const cuser = await clerkCurrentUser();
  const fallbackName = computeFallbackOrgName(cuser);
  const slug = await uniqueSlug(slugify(fallbackName));

  const [created] = await db
    .insert(organizations)
    .values({
      clerkOrgId,
      name: fallbackName,
      slug,
    })
    .onConflictDoNothing({ target: organizations.clerkOrgId })
    .returning();

  // Si onConflict a swallowed la création (race condition), on re-query.
  if (created) return created;
  const refetched = await db.query.organizations.findFirst({
    where: eq(organizations.clerkOrgId, clerkOrgId),
  });
  if (!refetched) {
    throw new Error("Failed to create or fetch organization");
  }
  return refetched;
}

async function findOrCreatePersonalOrg(clerkUserId: string) {
  // Le user a-t-il déjà une "personal org" (= une org Architask où il est membre,
  // sans clerk_org_id) ? On prend la première créée.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    orderBy: [asc(users.createdAt)],
    with: { organization: true },
  });
  if (existingUser?.organization) return existingUser.organization;

  // Sinon on crée une nouvelle org "personnelle".
  const cuser = await clerkCurrentUser();
  const fallbackName = computeFallbackOrgName(cuser);
  const slug = await uniqueSlug(slugify(fallbackName));

  const [created] = await db
    .insert(organizations)
    .values({
      clerkOrgId: null,
      name: fallbackName,
      slug,
    })
    .returning();
  return created;
}

async function findOrCreateUser(opts: {
  clerkUserId: string;
  organizationId: string;
  isFirstUser: boolean;
}) {
  const existing = await db.query.users.findFirst({
    where: and(
      eq(users.clerkUserId, opts.clerkUserId),
      eq(users.organizationId, opts.organizationId),
    ),
  });
  if (existing) return existing;

  const cuser = await clerkCurrentUser();
  const email = cuser?.emailAddresses?.[0]?.emailAddress ?? "inconnu@example.com";
  const name = computeFullName(cuser) ?? email.split("@")[0];

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: opts.clerkUserId,
      organizationId: opts.organizationId,
      email,
      name,
      role: opts.isFirstUser ? "owner" : "member",
    })
    .onConflictDoNothing({
      target: [users.clerkUserId, users.organizationId],
    })
    .returning();

  if (created) return created;
  const refetched = await db.query.users.findFirst({
    where: and(
      eq(users.clerkUserId, opts.clerkUserId),
      eq(users.organizationId, opts.organizationId),
    ),
  });
  if (!refetched) {
    throw new Error("Failed to create or fetch user");
  }
  return refetched;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

type ClerkUserLike = Awaited<ReturnType<typeof clerkCurrentUser>>;

function computeFullName(cuser: ClerkUserLike): string | null {
  if (!cuser) return null;
  const parts = [cuser.firstName, cuser.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function computeFallbackOrgName(cuser: ClerkUserLike): string {
  const full = computeFullName(cuser);
  if (full) return `${full} — agence`;
  const email = cuser?.emailAddresses?.[0]?.emailAddress;
  if (email) return `${email.split("@")[0]} — agence`;
  return "Mon agence";
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || "agence";
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, candidate),
    columns: { id: true },
  });
  if (!existing) return candidate;
  for (let i = 2; i <= 99; i++) {
    const next = `${candidate}-${i}`;
    const row = await db.query.organizations.findFirst({
      where: eq(organizations.slug, next),
      columns: { id: true },
    });
    if (!row) return next;
  }
  // Fallback ultra-improbable.
  return `${candidate}-${Date.now()}`;
}

/**
 * Variante non-throwing : utile dans les server components / route handlers
 * publics qui veulent juste savoir si un user est connecté.
 */
export async function tryGetCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) return null;
    throw err;
  }
}
