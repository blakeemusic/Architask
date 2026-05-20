import { eq } from "drizzle-orm";

import { db } from "@/db";
import { einvoiceConfigurations } from "@/db/schema/tresorerie";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessCockpit,
  getOrganizationOwner,
} from "@/lib/cockpit-access";
import {
  listEInvoiceEvents,
} from "@/server/actions/tresorerie/einvoice";

import { SubNavCockpit } from "../_components/sub-nav-cockpit";
import { CockpitRestrictedPanel } from "../honoraires/_components/cockpit-restricted-panel";
import { FacturationClient } from "./_components/facturation-client";

export default async function CockpitFacturationPage() {
  const user = await getCurrentUser();
  if (!(await canAccessCockpit(user, null))) {
    const owner = await getOrganizationOwner(user.organizationId);
    return (
      <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
        <SubNavCockpit active="facturation" />
        <CockpitRestrictedPanel ownerName={owner?.name ?? null} />
      </div>
    );
  }

  const cfg = await db.query.einvoiceConfigurations.findFirst({
    where: eq(einvoiceConfigurations.organizationId, user.organizationId),
  });

  const eventsRes = await listEInvoiceEvents({ limit: 60 });
  const events = eventsRes.data ?? [];

  return (
    <div className="px-10 py-10 min-w-0 max-w-[1600px] mx-auto">
      <SubNavCockpit active="facturation" />
      <FacturationClient
        config={
          cfg
            ? {
                provider: cfg.provider,
                externalOrgId: cfg.externalOrgId,
                active: cfg.active,
              }
            : null
        }
        events={events}
      />
    </div>
  );
}
