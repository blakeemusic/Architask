import type {
  EInvoiceProvider,
  EInvoiceReceived,
  EInvoiceStatus,
} from "./types";

/**
 * MockEInvoiceProvider — simule Pennylane PDP en MVP.
 *
 * - sendInvoice : log + retourne immédiatement statut "transmise" (dans la
 *   vraie API, Pennylane répond async via webhook).
 * - receiveInvoices : retourne une liste fictive de factures fournisseurs
 *   Factur-X reçues (utilisée pour la page Rapprochement).
 * - getStatus : pour le MVP, on renvoie un statut figé déterministe basé
 *   sur l'externalId (les NH les plus anciennes passent à "payee").
 */

type MockReceivedRow = Omit<EInvoiceReceived, "dateFacture"> & {
  dateFactureIso: string;
};

const MOCK_RECEIVED: MockReceivedRow[] = [
  {
    externalId: "pen-rcv-001",
    supplierName: "Castorama Boulogne",
    dateFactureIso: "iso-day-offset:-7",
    montantTtc: "240.00",
    montantHt: "200.00",
    montantTva: "40.00",
    tauxTva: "20.00",
    pdfUrl: null,
  },
  {
    externalId: "pen-rcv-002",
    supplierName: "Hôtel Lutetia Paris",
    dateFactureIso: "iso-day-offset:-15",
    montantTtc: "468.00",
    montantHt: "425.45",
    montantTva: "42.55",
    tauxTva: "10.00",
    pdfUrl: null,
  },
  {
    externalId: "pen-rcv-003",
    supplierName: "FNAC Pro",
    dateFactureIso: "iso-day-offset:-22",
    montantTtc: "189.00",
    montantHt: "157.50",
    montantTva: "31.50",
    tauxTva: "20.00",
    pdfUrl: null,
  },
];

function isoDayOffset(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

export const MockEInvoiceProvider: EInvoiceProvider = {
  name: "mock",

  async sendInvoice(input) {
    const externalId = `pen-out-${input.payload.numero}`;
    console.info("[einvoice mock] sendInvoice", {
      numero: input.payload.numero,
      montantTtc: input.payload.montantTtc,
      bufferSize: input.pdfBuffer.length,
    });
    // Statut initial transmise — en V1 Pennylane webhook fera évoluer
    // vers "acceptee" puis "payee".
    return { externalId, status: "transmise" as EInvoiceStatus };
  },

  async receiveInvoices(input) {
    void input;
    return {
      invoices: MOCK_RECEIVED.map((m): EInvoiceReceived => {
        const offset = Number(m.dateFactureIso.replace("iso-day-offset:", ""));
        const { dateFactureIso: _drop, ...rest } = m;
        void _drop;
        return {
          ...rest,
          dateFacture: isoDayOffset(offset),
        };
      }),
    };
  },

  async getStatus(input) {
    // Heuristique mock : si l'externalId contient "RC-2026-001" ou "002" →
    // "payee" (les anciennes), sinon "transmise".
    if (
      input.externalId.includes("RC-2026-001") ||
      input.externalId.includes("RC-2026-002")
    ) {
      return { status: "payee" };
    }
    return { status: "transmise" };
  },
};
