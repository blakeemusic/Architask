import { getDashboardData } from "@/server/actions/dashboard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ActivityHeroCard } from "@/components/dashboard/activity-hero-card";
import { DeadlinesBlackCard } from "@/components/dashboard/deadlines-black-card";
import { TodoGaugeCard } from "@/components/dashboard/todo-gauge-card";
import { PortfolioMintCard } from "@/components/dashboard/portfolio-mint-card";
import { ActiveOperationsList } from "@/components/dashboard/active-operations-list";
import { DecennaleAlertBanner } from "@/components/dashboard/decennale-alert-banner";

export default async function DashboardPage() {
  const res = await getDashboardData();
  if (res.error || !res.data) {
    return (
      <div className="max-w-[1600px] mx-auto px-10 py-10">
        <div
          className="rounded-3xl p-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          Impossible de charger le tableau de bord ({res.error ?? "erreur inconnue"}).
        </div>
      </div>
    );
  }
  const data = res.data;

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      <DashboardHeader userName={data.userName} today={data.today} />

      {/* Row 1 — Hero activité (2/3) + Échéances (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <ActivityHeroCard
            series={data.activitySeries}
            totals={data.activityTotals}
            canFinance={data.canFinance}
            today={data.today}
          />
        </div>
        <div>
          <DeadlinesBlackCard items={data.deadlines} />
        </div>
      </div>

      {/* Row 2 — Col gauche (Todo + Portfolio) + Chantiers actifs (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <TodoGaugeCard counts={data.todo} />
          <PortfolioMintCard
            canFinance={data.canFinance}
            portfolio={data.portfolio}
            nextMeeting={data.nextMeeting}
          />
        </div>
        <div className="lg:col-span-2">
          <ActiveOperationsList
            items={data.activeOperations}
            totalActive={data.portfolio.opsActiveCount}
          />
        </div>
      </div>

      <DecennaleAlertBanner items={data.expiringDecennales} />
    </div>
  );
}
