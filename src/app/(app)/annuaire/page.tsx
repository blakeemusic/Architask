import {
  getAnnuaireKpis,
  listCompanies,
  type CompanyListItem,
} from "@/server/actions/annuaire/companies";
import { listMoas } from "@/server/actions/annuaire/moas";

import { AnnuaireClient } from "./_components/annuaire-client";

export default async function AnnuairePage() {
  const [kpisRes, companiesRes, moasRes] = await Promise.all([
    getAnnuaireKpis(),
    listCompanies({}),
    listMoas({}),
  ]);

  const kpis = kpisRes.data ?? {
    totalCompanies: 0,
    validPct: 0,
    expiringSoon: 0,
    activeChantiers: 0,
    volumeEngageHt: "0",
  };
  const companies: CompanyListItem[] = companiesRes.data ?? [];
  const moas = moasRes.data ?? [];

  return <AnnuaireClient kpis={kpis} companies={companies} moas={moas} />;
}
