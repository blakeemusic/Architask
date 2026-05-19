import { db } from "@/db";
import { eq } from "drizzle-orm";
import { organizations } from "@/db/schema/auth";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getOperationsKpis } from "@/server/actions/operations/operations";

/**
 * Layout du route group (app). Toutes les pages authentifiées sont rendues
 * dans <AppShell /> (sidebar + glass header).
 *
 * L'appel à getCurrentUser() garantit que l'org + le user Architask existent
 * en DB avant que les pages enfants s'exécutent (lazy-init idempotent).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const [org, kpisRes] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
      columns: { name: true },
    }),
    getOperationsKpis(),
  ]);

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        orgName: org?.name ?? "Architask",
      }}
      operationsActiveCount={kpisRes.data?.totalActive ?? 0}
    >
      {children}
    </AppShell>
  );
}
