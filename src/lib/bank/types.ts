/**
 * Abstraction pluggable BankProvider — interface unifiée pour les
 * connexions bancaires DSP2 (Bridge, Powens, …) et le mock de démo.
 *
 * En MVP : seul MockBankProvider est implémenté. La signature ci-dessous
 * est pensée pour qu'ajouter BridgeProvider en V1 ne touche AUCUN code
 * en amont — il suffira de switcher dans getBankProvider(orgId).
 */

export type BankProviderName = "bridge" | "powens" | "mock";

export type BankAccountSnapshot = {
  /** ID unique côté provider (ex. id Bridge). */
  externalAccountId: string;
  libelle: string;
  ibanLast4: string | null;
  currency: string;
  /** Solde courant en € (montant signé, "84320.00"). */
  currentBalance: string;
  providerHint?: string;
};

export type BankTransactionSnapshot = {
  /** ID unique côté provider. */
  externalTxId: string;
  transactionDate: Date;
  /** Montant signé (positif = entrée, négatif = sortie). */
  amountTtc: string;
  libelle: string;
  /** Catégorie déduite côté provider (ex. "salaires", "carburant"). */
  category: string | null;
};

export type BankProvider = {
  name: BankProviderName;

  /**
   * Lance la connexion d'un nouveau compte (en vrai : redirect OAuth Bridge,
   * ici : retourne directement les 2 comptes mockés).
   */
  connectAccount(input: {
    organizationId: string;
  }): Promise<{ accounts: BankAccountSnapshot[] }>;

  /** Liste les comptes déjà connectés (lecture seule, depuis cache provider). */
  listAccounts(input: {
    organizationId: string;
  }): Promise<{ accounts: BankAccountSnapshot[] }>;

  /**
   * Re-fetch les transactions du provider pour un compte donné. En MVP, le
   * mock régénère les transactions du mois courant (idempotent par
   * externalTxId).
   */
  syncTransactions(input: {
    organizationId: string;
    externalAccountId: string;
    /** Ne récupère que les transactions postérieures à cette date. */
    since?: Date;
  }): Promise<{ transactions: BankTransactionSnapshot[] }>;

  /** Renvoie le solde courant d'un compte. */
  getBalance(input: {
    organizationId: string;
    externalAccountId: string;
  }): Promise<{ balance: string }>;
};
