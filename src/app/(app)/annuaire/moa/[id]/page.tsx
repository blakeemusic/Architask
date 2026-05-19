import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { StatusPill } from "@/components/ui/status-pill";
import { getMoaById } from "@/server/actions/annuaire/moas";

export default async function MoaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getMoaById({ id });
  if (res.error || !res.data) notFound();

  const moa = res.data;

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 text-[13px] mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link href="/annuaire" className="hover:text-[var(--text-primary)]">
          Annuaire
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href="/annuaire"
          className="hover:text-[var(--text-primary)]"
        >
          Maîtres d&apos;ouvrage
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }}>{moa.raisonSociale}</span>
      </div>

      <Card variant="white" padding="lg" className="mb-6">
        <div className="flex items-start gap-4">
          <CompanyLogo name={moa.raisonSociale} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="title-lg leading-tight">{moa.raisonSociale}</div>
            <div className="flex items-center gap-2 mt-2">
              <StatusPill variant="brand">{moa.typeJuridique.toUpperCase()}</StatusPill>
              {moa.siret && (
                <span
                  className="text-[12px] font-tabular"
                  style={{ color: "var(--text-secondary)" }}
                >
                  SIRET {moa.siret}
                </span>
              )}
            </div>
            <div
              className="text-[13px] mt-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {[
                moa.adresseLigne1,
                [moa.codePostal, moa.ville].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(" · ") || "Adresse non renseignée"}
            </div>
          </div>
        </div>
      </Card>

      <Card variant="white" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="title-md">Contacts</div>
          <span
            className="text-[12px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {moa.contacts.length} contact{moa.contacts.length > 1 ? "s" : ""}
          </span>
        </div>
        {moa.contacts.length === 0 ? (
          <div
            className="text-center py-8 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Aucun contact enregistré pour ce maître d&apos;ouvrage.
          </div>
        ) : (
          <div className="space-y-2">
            {moa.contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[14px] font-semibold truncate">
                      {c.name}
                    </div>
                    {c.role && (
                      <StatusPill variant="neutral" size="sm">
                        {c.role}
                      </StatusPill>
                    )}
                  </div>
                  <div
                    className="text-[12px] mt-1 font-tabular truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
