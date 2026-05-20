import { MockBankProvider } from "./mock-provider";
import type { BankProvider } from "./types";

/**
 * Singleton-like : retourne le BankProvider configuré pour une organisation.
 *
 * En MVP : tout le monde utilise MockBankProvider — la table
 * einvoice_configurations / bank_accounts contient la trace du provider
 * (`bridge` / `powens`) mais on ne tape pas leur API.
 *
 * TODO V1 : lire `bank_accounts.provider` côté DB et brancher BridgeProvider
 * ou PowensProvider avec leurs SDK + secrets via KMS.
 */
export function getBankProvider(organizationId: string): BankProvider {
  void organizationId; // TODO V1 : lire bank_accounts.provider et switcher
  return MockBankProvider;
}

export type { BankProvider, BankAccountSnapshot, BankTransactionSnapshot } from "./types";
export { MOCK_BANK_ACCOUNT_IDS } from "./mock-provider";
