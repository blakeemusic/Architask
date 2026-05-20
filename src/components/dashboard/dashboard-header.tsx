import Link from "next/link";

import { Button } from "@/components/ui/button";

const DAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const MONTHS = [
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

function firstName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first ?? fullName;
}

function formatLongDate(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function DashboardHeader({
  userName,
  today,
}: {
  userName: string;
  today: Date;
}) {
  return (
    <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        <div
          className="text-[11px] uppercase tracking-[0.6px] font-semibold mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {formatLongDate(today)}
        </div>
        <h1
          className="text-[40px] font-bold leading-[1.05]"
          style={{ letterSpacing: "-0.025em" }}
        >
          Bonjour {firstName(userName)}
        </h1>
        <p
          className="text-[15px] mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Voici l&apos;essentiel de ton agence aujourd&apos;hui.
        </p>
      </div>
      <Link href="/operations">
        <Button>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle opération
        </Button>
      </Link>
    </div>
  );
}
