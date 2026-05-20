"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  grantCockpitAccess,
  revokeCockpitAccess,
} from "@/server/actions/honoraires/cockpit-access";

type Member = { id: string; name: string; email: string; role: string };
type Grant = {
  id: string;
  scope: "global" | "operation";
  operationId: string | null;
  user: { id: string; name: string; email: string; role: string };
};

export function AccessManagementCard({
  operationId,
  members,
  grants,
  currentUserId,
  currentUserRole,
}: {
  operationId: string;
  members: Member[];
  grants: Grant[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const canManage =
    currentUserRole === "owner" || currentUserRole === "admin";

  const granteesById = new Map<string, Grant>();
  for (const g of grants) granteesById.set(g.user.id, g);

  const owners = members.filter(
    (m) => m.role === "owner" || m.role === "admin",
  );
  const accessUsers = [
    ...owners,
    ...members.filter((m) => granteesById.has(m.id) && !owners.includes(m)),
  ];

  const candidatesToInvite = members.filter(
    (m) =>
      m.role !== "owner" &&
      m.role !== "admin" &&
      !granteesById.has(m.id) &&
      m.id !== currentUserId,
  );

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");

  const onInvite = async () => {
    if (!selectedUserId) {
      toast.info("Sélectionne un utilisateur à inviter.");
      return;
    }
    const res = await grantCockpitAccess({
      userId: selectedUserId,
      scope: "operation",
      operationId,
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Accès accordé.");
    setSelectedUserId("");
    router.refresh();
  };

  const onRevoke = async (grantId: string) => {
    const res = await revokeCockpitAccess({ id: grantId });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Accès retiré.");
    router.refresh();
  };

  return (
    <div
      className="p-6 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #DDD6FE 0%, #EDE9FE 100%)",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(59,27,122,0.10)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B1B7A"
            strokeWidth="2.5"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold">Accès à cet onglet</div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "rgba(59,27,122,0.65)" }}
          >
            Réservé Owner / Admin par défaut
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {accessUsers.map((m) => {
          const grant = granteesById.get(m.id);
          const isCurrent = m.id === currentUserId;
          return (
            <div
              key={m.id}
              className="flex items-center gap-2 p-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.55)" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #3B1B7A 0%, #8B5CF6 100%)",
                }}
              >
                {initials(m.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold truncate">{m.name}</div>
                <div
                  className="text-[10px]"
                  style={{ color: "rgba(59,27,122,0.65)" }}
                >
                  {m.role === "owner"
                    ? "Owner"
                    : m.role === "admin"
                      ? "Admin"
                      : grant?.scope === "global"
                        ? "Member · accès global"
                        : "Member · accès cette opération"}
                </div>
              </div>
              {isCurrent ? (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#3B1B7A", color: "white" }}
                >
                  Vous
                </span>
              ) : grant && canManage ? (
                <button
                  type="button"
                  onClick={() => onRevoke(grant.id)}
                  className="text-[11px] font-semibold"
                  style={{ color: "#3B1B7A" }}
                >
                  Retirer
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {canManage && candidatesToInvite.length > 0 && (
        <div className="mt-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none mb-2"
            style={{
              background: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(59,27,122,0.15)",
              color: "#3B1B7A",
            }}
          >
            <option value="">— Choisir un membre à inviter —</option>
            {candidatesToInvite.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onInvite}
            disabled={!selectedUserId}
            className="w-full py-2.5 rounded-2xl text-[12px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "#3B1B7A", color: "white" }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Inviter sur cette opération
          </button>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
