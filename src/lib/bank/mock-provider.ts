import { Decimal } from "decimal.js";

import type {
  BankAccountSnapshot,
  BankProvider,
  BankTransactionSnapshot,
} from "./types";

/**
 * MockBankProvider — provider banque pour la démo MVP.
 *
 * Génère 2 comptes "Crédit Mutuel Pro" + "Qonto Épargne" et un flux de
 * transactions réalistes sur 3 mois glissants (mois en cours + 2
 * précédents). Les libellés sont calqués sur le mockup v0.3.
 *
 * IMPORTANT : les externalTxId sont déterministes (compte + date + index)
 * pour que syncTransactions reste idempotent. Un re-sync ne crée pas de
 * doublon — l'unique index bank_transactions_external_unique fait le reste.
 */

const CM_PRO_EXTERNAL_ID = "mock-cm-pro";
const QONTO_EPARGNE_EXTERNAL_ID = "mock-qonto-epargne";

const ACCOUNTS: BankAccountSnapshot[] = [
  {
    externalAccountId: CM_PRO_EXTERNAL_ID,
    libelle: "Crédit Mutuel · Pro",
    ibanLast4: "4521",
    currency: "EUR",
    currentBalance: "84320.00",
    providerHint: "credit_mutuel",
  },
  {
    externalAccountId: QONTO_EPARGNE_EXTERNAL_ID,
    libelle: "Qonto · Compte d'épargne",
    ibanLast4: "7733",
    currency: "EUR",
    currentBalance: "22920.00",
    providerHint: "qonto",
  },
];

type RecurringRule = {
  label: string;
  amount: string; // signé
  day: number;
  account: "cm" | "qonto";
  category: string;
};

const RECURRING_RULES: RecurringRule[] = [
  // Sorties récurrentes (CM Pro)
  { label: "SEPA · Salaires", amount: "-14280.00", day: 5, account: "cm", category: "salaires" },
  { label: "PRLV SCI Lemoine · Loyer bureaux", amount: "-2850.00", day: 3, account: "cm", category: "loyer_bureau" },
  { label: "CB Autodesk · Revit Pro", amount: "-348.00", day: 1, account: "cm", category: "logiciels" },
  { label: "PRLV Slack Technologies", amount: "-89.00", day: 12, account: "cm", category: "logiciels" },
  { label: "PRLV Free Pro · Téléphonie+Internet", amount: "-179.00", day: 8, account: "cm", category: "telecom" },
  { label: "PRLV Arval · Leasing véhicules", amount: "-980.00", day: 10, account: "cm", category: "vehicules" },
  { label: "URSSAF Île-de-France", amount: "-5860.00", day: 15, account: "cm", category: "charges_sociales" },
  { label: "PRLV MMA · Assurance RCP+décennale", amount: "-462.00", day: 20, account: "cm", category: "assurances" },
];

// Sorties ponctuelles "à catégoriser / sans facture" pour alimenter
// le rapprochement. Indexées par mois de référence : 0 = mois courant.
const PUNCTUAL_OUT: Array<{
  monthOffset: number;
  day: number;
  label: string;
  amount: string;
  category: string | null;
}> = [
  { monthOffset: 0, day: 8, label: "CB Castorama · Achat fournitures", amount: "-240.00", category: null },
  { monthOffset: 0, day: 5, label: "CB Total Énergies · Carburant", amount: "-87.40", category: null },
  { monthOffset: 0, day: 2, label: "CB Le Petit Bistrot · Repas client", amount: "-64.80", category: null },
  { monthOffset: 0, day: 12, label: "CB Uber · Déplacement client", amount: "-22.40", category: null },
  { monthOffset: -1, day: 7, label: "CB Amazon Business · Achat divers", amount: "-348.90", category: null },
  { monthOffset: -1, day: 18, label: "CB Esso · Carburant tournée chantier", amount: "-72.10", category: "vehicules" },
  { monthOffset: -1, day: 22, label: "CB FNAC Pro · Écran second", amount: "-189.00", category: null },
  { monthOffset: -2, day: 14, label: "CB SNCF Pro · Train Paris Lyon", amount: "-126.50", category: null },
];

// Virements entrants — un par mois, calé sur une note d'honoraires NH.
// La réconciliation auto fait le lien via le n° NH dans le libellé.
type IncomingRule = {
  monthOffset: number;
  day: number;
  label: string;
  amount: string;
  account: "cm" | "qonto";
};

const INCOMING: IncomingRule[] = [
  { monthOffset: 0, day: 14, label: "VIR SCI Cèdres Habitat · NH-RC-2026-003", amount: "+8640.00", account: "cm" },
  { monthOffset: 0, day: 2, label: "VIR M. & Mme Robineau · Acompte chantier", amount: "+11970.00", account: "qonto" },
  { monthOffset: -1, day: 18, label: "VIR SCI Cèdres Habitat · NH-RC-2026-002", amount: "+13824.00", account: "cm" },
  { monthOffset: -2, day: 12, label: "VIR SCI Cèdres Habitat · NH-RC-2026-001", amount: "+9216.00", account: "cm" },
  { monthOffset: -2, day: 22, label: "VIR Foncière Atlantique · Acompte BR", amount: "+18500.00", account: "qonto" },
];

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function makeExternalTxId(externalAccountId: string, date: Date, idx: number): string {
  return `${externalAccountId}-${isoDay(date)}-${idx}`;
}

function generateTransactions(now: Date): BankTransactionSnapshot[] {
  const txs: BankTransactionSnapshot[] = [];
  const cmId = CM_PRO_EXTERNAL_ID;
  const qontoId = QONTO_EPARGNE_EXTERNAL_ID;

  // 3 mois glissants (mois courant + 2 précédents)
  for (let offset = -2; offset <= 0; offset += 1) {
    const monthDate = addMonths(now, offset);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Récurrentes
    for (const r of RECURRING_RULES) {
      const txDate = new Date(year, month, r.day, 6, 0, 0);
      if (txDate > now) continue; // ne pas mocker dans le futur
      const accId = r.account === "cm" ? cmId : qontoId;
      txs.push({
        externalTxId: makeExternalTxId(accId, txDate, RECURRING_RULES.indexOf(r)),
        transactionDate: txDate,
        amountTtc: new Decimal(r.amount).toFixed(2),
        libelle: r.label,
        category: r.category,
      });
    }
  }

  // Ponctuelles sorties (rapprochement)
  PUNCTUAL_OUT.forEach((p, idx) => {
    const monthDate = addMonths(now, p.monthOffset);
    const txDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), p.day, 14, 0, 0);
    if (txDate > now) return;
    txs.push({
      externalTxId: makeExternalTxId(cmId, txDate, 1000 + idx),
      transactionDate: txDate,
      amountTtc: new Decimal(p.amount).toFixed(2),
      libelle: p.label,
      category: p.category,
    });
  });

  // Virements entrants
  INCOMING.forEach((inc, idx) => {
    const monthDate = addMonths(now, inc.monthOffset);
    const txDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), inc.day, 9, 42, 0);
    if (txDate > now) return;
    const accId = inc.account === "cm" ? cmId : qontoId;
    txs.push({
      externalTxId: makeExternalTxId(accId, txDate, 2000 + idx),
      transactionDate: txDate,
      amountTtc: new Decimal(inc.amount).toFixed(2),
      libelle: inc.label,
      category: "honoraires",
    });
  });

  // Sort chronologique (descendant)
  txs.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
  return txs;
}

export const MockBankProvider: BankProvider = {
  name: "mock",

  async connectAccount() {
    return { accounts: ACCOUNTS };
  },

  async listAccounts() {
    return { accounts: ACCOUNTS };
  },

  async syncTransactions(input) {
    const all = generateTransactions(new Date());
    const filtered = all.filter((tx) => {
      if (input.since && tx.transactionDate < input.since) return false;
      // Filtrage par compte : on identifie le compte via préfixe externalTxId
      return tx.externalTxId.startsWith(input.externalAccountId + "-");
    });
    return { transactions: filtered };
  },

  async getBalance(input) {
    const acc = ACCOUNTS.find(
      (a) => a.externalAccountId === input.externalAccountId,
    );
    return { balance: acc?.currentBalance ?? "0.00" };
  },
};

export const MOCK_BANK_ACCOUNT_IDS = {
  cmPro: CM_PRO_EXTERNAL_ID,
  qontoEpargne: QONTO_EPARGNE_EXTERNAL_ID,
};
