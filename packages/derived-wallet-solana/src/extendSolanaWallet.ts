import { AccountAuthenticator, AnyRawTransaction } from "@moveindustries/ts-sdk";
import {
  MovementSignMessageOutput,
  UserResponse,
} from "@moveindustries/wallet-standard";
import { StandardWalletAdapter as SolanaWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { defaultAuthenticationFunction } from "./shared";
import {
  signMovementMessageWithSolana,
  StructuredMessageInputWithChainId,
} from "./signMovementMessage";
import { signMovementTransactionWithSolana } from "./signMovementTransaction";
import { SolanaDerivedPublicKey } from "./SolanaDerivedPublicKey";

export type SolanaWalletAdapterWithMovementFeatures = SolanaWalletAdapter & {
  getMovementPublicKey: (
    solanaPublicKey: SolanaPublicKey,
  ) => SolanaDerivedPublicKey;
  signMovementTransaction: (
    rawTransaction: AnyRawTransaction,
  ) => Promise<UserResponse<AccountAuthenticator>>;
  signMovementMessage: (
    input: StructuredMessageInputWithChainId,
  ) => Promise<UserResponse<MovementSignMessageOutput>>;
};

/**
 * Utility function for extending a SolanaWalletAdapter with Movement features.
 * @param solanaWallet the source wallet adapter
 * @param authenticationFunction authentication function required for DAA
 *
 * @example
 * ```typescript
 * const extendedWallet = extendSolanaWallet(solanaWallet, authenticationFunction);
 *
 * const solanaSignature = await extendedWallet.signTransaction(solanaTransaction);
 * const movementSignature = await extendedWallet.signMovementTransaction(movementRawTransaction);
 * ```
 */
export function extendSolanaWallet(
  solanaWallet: SolanaWalletAdapter,
  authenticationFunction = defaultAuthenticationFunction,
) {
  const extended = solanaWallet as SolanaWalletAdapterWithMovementFeatures;
  extended.getMovementPublicKey = (solanaPublicKey: SolanaPublicKey) =>
    new SolanaDerivedPublicKey({
      solanaPublicKey,
      domain: window.location.host,
      authenticationFunction,
    });
  extended.signMovementTransaction = (rawTransaction: AnyRawTransaction) =>
    signMovementTransactionWithSolana({
      solanaWallet,
      authenticationFunction,
      rawTransaction,
      domain: window.location.host,
    });
  extended.signMovementMessage = (messageInput) => {
    return signMovementMessageWithSolana({
      solanaWallet,
      authenticationFunction,
      messageInput,
      domain: window.location.host,
    });
  };
  return extended;
}
