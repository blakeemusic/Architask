import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { operations } from "@/db/schema/operations";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessCockpit,
  getOrganizationOwner,
} from "@/lib/cockpit-access";
import { OperationTabs } from "@/components/operations/operation-tabs";
import { getContractByOperation } from "@/server/actions/honoraires/contracts";
import { listMissions } from "@/server/actions/honoraires/missions";
import { listSituationsByContract } from "@/server/actions/honoraires/situations";
import {
  listCockpitGrants,
  listOrgMembers,
} from "@/server/actions/honoraires/cockpit-access";

import { HonorairesClient } from "./_components/honoraires-client";
import { RestrictedAccessPanel } from "./_components/restricted-access-panel";

export default async function HonorairesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const op = await db.query.operations.findFirst({
    where: and(
      eq(operations.id, id),
      eq(operations.organizationId, user.organizationId),
    ),
    with: { moa: { columns: { id: true, raisonSociale: true } } },
  });
  if (!op) notFound();

  const hasAccess = await canAccessCockpit(user, id);

  if (!hasAccess) {
    const owner = await getOrganizationOwner(user.organizationId);
    return (
      <div className="px-10 py-10 min-w-0 max-w-[1400px] mx-auto">
        <Breadcrumb opName={op.name} />
        <OperationTabs operationId={id} active="honoraires" />
        <RestrictedAccessPanel
          operationId={id}
          operationName={op.name}
          ownerName={owner?.name ?? null}
        />
      </div>
    );
  }

  // Accès OK : charger contrat + missions + situations + members
  const [contractRes, membersRes, grantsRes] = await Promise.all([
    getContractByOperation({ operationId: id }),
    listOrgMembers(),
    listCockpitGrants({ operationId: id }),
  ]);

  const contractData = contractRes.data ?? null;
  const members = membersRes.data ?? [];
  const grants = grantsRes.data ?? [];

  let missions: Awaited<ReturnType<typeof listMissions>>["data"] = [];
  let situations: Awaited<ReturnType<typeof listSituationsByContract>>["data"] = [];

  if (contractData?.contract) {
    const missionsRes = await listMissions({
      contractId: contractData.contract.id,
    });
    missions = missionsRes.data ?? [];
    const situationsRes = await listSituationsByContract({
      contractId: contractData.contract.id,
    });
    situations = situationsRes.data ?? [];
  }

  return (
    <div className="px-10 py-10 min-w-0 max-w-[1400px] mx-auto">
      <Breadcrumb opName={op.name} />
      <OperationTabs operationId={id} active="honoraires" />
      <HonorairesClient
        operationId={id}
        operationName={op.name}
        operationCode={op.code}
        moa={op.moa}
        currentUserRole={user.role}
        currentUserId={user.userId}
        contractData={contractData}
        missions={missions ?? []}
        situations={situations ?? []}
        members={members}
        grants={grants}
      />
    </div>
  );
}

function Breadcrumb({ opName }: { opName: string }) {
  return (
    <div
      className="flex items-center gap-2 text-[13px] mb-4"
      style={{ color: "var(--text-secondary)" }}
    >
      <span>Opérations</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span>{opName}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span
        className="font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        Honoraires
      </span>
    </div>
  );
}
