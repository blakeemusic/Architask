/**
 * Abstraction pluggable EInvoiceProvider — interface unifiée pour les
 * Plateformes de Dématérialisation Partenaires (PDP) Factur-X (Pennylane,
 * Sage, Generix, Esker, …) et le mock de démo.
 *
 * En MVP : seul MockEInvoiceProvider est implémenté. Une vraie intégration
 * Pennylane se brancherait en remplaçant simplement `getEInvoiceProvider`
 * sans toucher au code applicatif.
 */

export type EInvoiceProviderName =
  | "pennylane"
  | "sage"
  | "esker"
  | "generix"
  | "autre"
  | "mock";

export type EInvoiceDirection = "out" | "in";
export type EInvoiceStatus =
  | "envoyee"
  | "transmise"
  | "acceptee"
  | "refusee"
  | "payee";

export type EInvoiceSendInput = {
  organizationId: string;
  honoraireSituationId: string;
  /** PDF + métadonnées de la NH à transmettre. */
  pdfBuffer: Buffer;
  payload: {
    numero: string;
    montantHt: string;
    montantTva: string;
    montantTtc: string;
    moaName: string;
    dateEmission: Date;
    delaiPaiementJours: number;
  };
};

export type EInvoiceReceived = {
  externalId: string;
  supplierName: string;
  dateFacture: Date;
  montantTtc: string;
  montantHt: string;
  montantTva: string;
  tauxTva: string;
  pdfUrl: string | null;
};

export type EInvoiceProvider = {
  name: EInvoiceProviderName;

  /** Envoie une NH au format Factur-X via la PDP. Retourne le statut initial. */
  sendInvoice(input: EInvoiceSendInput): Promise<{
    externalId: string;
    status: EInvoiceStatus;
  }>;

  /** Liste les factures fournisseurs reçues via la PDP. */
  receiveInvoices(input: {
    organizationId: string;
    since?: Date;
  }): Promise<{ invoices: EInvoiceReceived[] }>;

  /** Récupère le statut courant d'une facture envoyée. */
  getStatus(input: {
    organizationId: string;
    externalId: string;
  }): Promise<{ status: EInvoiceStatus }>;
};
