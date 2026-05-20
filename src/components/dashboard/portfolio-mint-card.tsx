import { formatMoneyCompact } from "@/lib/format";
import type {
  DashboardNextMeeting,
  DashboardPortfolio,
} from "@/server/actions/dashboard";

const MONTH_LONG = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function PortfolioMintCard({
  canFinance,
  portfolio,
  nextMeeting,
}: {
  canFinance: boolean;
  portfolio: DashboardPortfolio;
  nextMeeting: DashboardNextMeeting;
}) {
  return (
    <div
      className="p-7"
      style={{
        background:
          "linear-gradient(135deg, var(--mint-200) 0%, var(--mint-100) 100%)",
        color: "var(--mint-900, #064E2C)",
        borderRadius: 28,
      }}
    >
      {canFinance ? (
        <PortfolioOwner portfolio={portfolio} />
      ) : (
        <PortfolioSalarie nextMeeting={nextMeeting} />
      )}
    </div>
  );
}

function PortfolioOwner({ portfolio }: { portfolio: DashboardPortfolio }) {
  const { display, unit } = formatMoneyCompact(portfolio.totalCaHt);
  const pct = portfolio.avgAvancementPct;
  return (
    <>
      <div
        className="text-[11px] uppercase tracking-[0.6px] font-semibold"
        style={{ color: "rgba(6,78,44,0.55)" }}
      >
        Portefeuille en cours
      </div>
      <div className="flex items-baseline gap-1 mt-3">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 44, letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          {display}
        </div>
        <div className="text-[20px] font-semibold ml-1">{unit}</div>
      </div>
      <div
        className="text-[12px] mt-2"
        style={{ color: "rgba(6,78,44,0.65)" }}
      >
        {portfolio.opsActiveCount} chantier
        {portfolio.opsActiveCount > 1 ? "s" : ""} actif
        {portfolio.opsActiveCount > 1 ? "s" : ""} · avancement moyen {pct}%
      </div>
      <div
        className="h-2 rounded-full mt-4 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.45)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: "var(--mint-900, #064E2C)",
          }}
        />
      </div>
    </>
  );
}

function PortfolioSalarie({
  nextMeeting,
}: {
  nextMeeting: DashboardNextMeeting;
}) {
  if (!nextMeeting) {
    return (
      <>
        <div
          className="text-[11px] uppercase tracking-[0.6px] font-semibold"
          style={{ color: "rgba(6,78,44,0.55)" }}
        >
          Prochain rendez-vous chantier
        </div>
        <div className="mt-3">
          <div
            className="font-bold"
            style={{ fontSize: 32, letterSpacing: "-0.02em" }}
          >
            Rien à l&apos;agenda
          </div>
          <div
            className="text-[13px] mt-2"
            style={{ color: "rgba(6,78,44,0.65)" }}
          >
            Aucune réunion ou réception planifiée à venir.
          </div>
        </div>
      </>
    );
  }
  const d = nextMeeting.date;
  return (
    <>
      <div
        className="text-[11px] uppercase tracking-[0.6px] font-semibold"
        style={{ color: "rgba(6,78,44,0.55)" }}
      >
        Prochain rendez-vous chantier
      </div>
      <div className="flex items-baseline gap-2 mt-3">
        <div
          className="font-bold font-tabular"
          style={{ fontSize: 44, letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          {d.getDate()}
        </div>
        <div className="text-[20px] font-semibold">
          {MONTH_LONG[d.getMonth()]}
        </div>
      </div>
      <div className="text-[13px] mt-3 font-semibold">{nextMeeting.title}</div>
      <div
        className="text-[12px] mt-1 truncate"
        style={{ color: "rgba(6,78,44,0.65)" }}
      >
        {nextMeeting.operationName}
      </div>
    </>
  );
}
