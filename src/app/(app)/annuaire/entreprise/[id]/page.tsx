import Link from "next/link";
import { notFound } from "next/navigation";

import { getCompanyById } from "@/server/actions/annuaire/companies";

import { CompanyDetailClient } from "./_components/company-detail-client";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getCompanyById({ id });
  if (res.error || !res.data) {
    notFound();
  }

  return (
    <div className="max-w-[1280px] mx-auto px-10 py-10">
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
          Entreprises
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: "var(--text-primary)" }}>
          {res.data.raisonSociale}
        </span>
      </div>

      <CompanyDetailClient company={res.data} />
    </div>
  );
}
