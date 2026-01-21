import {
  encodeStructuredMessage,
  mapUserResponse,
  StructuredMessage,
  StructuredMessageInput,
} from "@movement-labs/derived-wallet-base";
import { Ed25519Signature } from "@movement-labs/ts-sdk";
import { MovementSignMessageOutput } from "@movement-labs/wallet-standard";
import { StandardWalletAdapter as SolanaWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { wrapSolanaUserResponse } from "./shared";
import { SolanaDerivedPublicKey } from "./SolanaDerivedPublicKey";

export interface StructuredMessageInputWithChainId
  extends StructuredMessageInput {
  chainId?: number;
}

export interface SignMovementMessageWithSolanaInput {
  solanaWallet: SolanaWalletAdapter;
  authenticationFunction: string;
  messageInput: StructuredMessageInputWithChainId;
  domain: string;
}

export async function signMovementMessageWithSolana(
  input: SignMovementMessageWithSolanaInput,
) {
  const { solanaWallet, authenticationFunction, messageInput, domain } = input;

  if (!solanaWallet.signMessage) {
    throw new Error("solana:signMessage not available");
  }

  const solanaPublicKey = solanaWallet.publicKey;
  if (!solanaPublicKey) {
    throw new Error("Account not connected");
  }

  const movementPublicKey = new SolanaDerivedPublicKey({
    domain,
    solanaPublicKey,
    authenticationFunction,
  });

  const { message, nonce, chainId, ...flags } = messageInput;

  const movementAddress = flags.address
    ? movementPublicKey.authKey().derivedAddress()
    : undefined;

  const application = flags.application ? window.location.origin : undefined;
  const structuredMessage: StructuredMessage = {
    address: movementAddress?.toString(),
    application,
    chainId,
    message,
    nonce,
  };

  const signingMessage = encodeStructuredMessage(structuredMessage);

  const response = await wrapSolanaUserResponse(
    solanaWallet.signMessage(signingMessage),
  );

  return mapUserResponse(response, (output): MovementSignMessageOutput => {
    // Solana signMessage standard always returns a Ed25519 signature type
    const signature = new Ed25519Signature(output);
    const fullMessage = new TextDecoder().decode(signingMessage);

    return {
      prefix: "MOVEMENT",
      fullMessage,
      message,
      nonce,
      signature,
    };
  });
}
