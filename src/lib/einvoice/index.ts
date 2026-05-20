import { MockEInvoiceProvider } from "./mock-provider";
import type { EInvoiceProvider } from "./types";

/**
 * Retourne le EInvoiceProvider configuré pour une organisation.
 *
 * En MVP : MockEInvoiceProvider pour toutes les agences. La table
 * einvoice_configurations stocke quand même le `provider` choisi par
 * l'agence (pennylane / sage / etc.) — c'est cette colonne qui pilotera
 * le switch en V1.
 *
 * TODO V1 : lire einvoice_configurations.provider et instancier
 * PennylaneEInvoiceProvider / SageEInvoiceProvider / etc. avec leurs SDK
 * et leurs secrets via KMS.
 */
export function getEInvoiceProvider(organizationId: string): EInvoiceProvider {
  void organizationId; // TODO V1 : lire einvoice_configurations.provider
  return MockEInvoiceProvider;
}

export type {
  EInvoiceProvider,
  EInvoiceSendInput,
  EInvoiceReceived,
  EInvoiceStatus,
  EInvoiceDirection,
} from "./types";
