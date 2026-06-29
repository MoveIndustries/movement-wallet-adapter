import { useContext, createContext } from "react";
import {
  AccountAuthenticator,
  AccountInfo,
  AdapterWallet,
  AnyRawTransaction,
  MovementSignAndSubmitTransactionOutput,
  InputTransactionData,
  NetworkInfo,
  MovementSignMessageInput,
  MovementSignMessageOutput,
  AdapterNotDetectedWallet,
  Network,
  MovementChangeNetworkOutput,
  PendingTransactionResponse,
  InputSubmitTransactionData,
  MovementSignInInput,
  MovementSignInOutput,
  ConfidentialBalance,
  ConfidentialTransferInput,
  ConfidentialWriteOptions,
  ConfidentialWriteResult,
} from "@moveindustries/wallet-adapter-core";

export interface WalletContextState {
  connected: boolean;
  isLoading: boolean;
  account: AccountInfo | null;
  network: NetworkInfo | null;
  connect(walletName: string): void;
  signIn(args: {
    walletName: string;
    input: MovementSignInInput;
  }): Promise<MovementSignInOutput | void>;
  signAndSubmitTransaction(
    transaction: InputTransactionData,
  ): Promise<MovementSignAndSubmitTransactionOutput>;
  signTransaction(args: {
    transactionOrPayload: AnyRawTransaction | InputTransactionData;
    asFeePayer?: boolean;
  }): Promise<{
    authenticator: AccountAuthenticator;
    rawTransaction: Uint8Array;
  }>;
  signMessage(message: MovementSignMessageInput): Promise<MovementSignMessageOutput>;
  signMessageAndVerify(message: MovementSignMessageInput): Promise<boolean>;
  disconnect(): void;
  changeNetwork(network: Network): Promise<MovementChangeNetworkOutput>;
  submitTransaction(
    transaction: InputSubmitTransactionData,
  ): Promise<PendingTransactionResponse>;
  refetchMnsName(): Promise<void>;
  supportsConfidentialAssets(): boolean;
  confidentialGetBalances(tokens: string[]): Promise<{ balances: ConfidentialBalance[] }>;
  confidentialIsRegistered(input: { token: string }): Promise<{ registered: boolean }>;
  confidentialGetEncryptionKey(input: {
    token: string;
  }): Promise<{ encryptionKey: string | null }>;
  confidentialGetGlobalAuditor(): Promise<{ auditorEncryptionKey?: string }>;
  confidentialGetAuditor(input: { token: string }): Promise<{ auditorEncryptionKey?: string }>;
  confidentialTransfer(input: ConfidentialTransferInput): Promise<ConfidentialWriteResult>;
  confidentialRegister(
    input: { token: string } & ConfidentialWriteOptions,
  ): Promise<ConfidentialWriteResult>;
  confidentialDeposit(
    input: { token: string; amount: string } & ConfidentialWriteOptions,
  ): Promise<ConfidentialWriteResult>;
  confidentialWithdraw(
    input: { token: string; amount: string } & ConfidentialWriteOptions,
  ): Promise<ConfidentialWriteResult>;
  confidentialRolloverPending(
    input: { token: string } & ConfidentialWriteOptions,
  ): Promise<ConfidentialWriteResult>;
  wallet: AdapterWallet | null;
  wallets: ReadonlyArray<AdapterWallet>;
  notDetectedWallets: ReadonlyArray<AdapterNotDetectedWallet>;
}

const DEFAULT_CONTEXT = {
  connected: false,
};

export const WalletContext = createContext<WalletContextState>(
  DEFAULT_CONTEXT as WalletContextState,
);

export function useWallet(): WalletContextState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletContextState");
  }
  return context;
}
