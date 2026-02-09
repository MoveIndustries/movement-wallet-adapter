import {
  createStructuredMessageStatement,
  createTransactionStatement,
  StructuredMessage,
} from "@moveindustries/derived-wallet-base";
import { AnyRawTransaction, Hex, HexInput } from "@moveindustries/ts-sdk";
import { SolanaSignInInputWithRequiredFields } from "@solana/wallet-standard-util";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";

export interface CreateSiwsEnvelopeInput {
  solanaPublicKey: SolanaPublicKey;
  signingMessageDigest: HexInput;
  domain: string;
}

function createSiwsEnvelope(
  input: CreateSiwsEnvelopeInput & {
    statement: string;
  },
): SolanaSignInInputWithRequiredFields {
  const { solanaPublicKey, signingMessageDigest, statement, domain } = input;
  const digestHex = Hex.fromHexInput(signingMessageDigest).toString();
  return {
    address: solanaPublicKey.toString(),
    domain,
    nonce: digestHex,
    statement,
  };
}

/**
 * Create a SIWS envelope for an Movement structured message.
 * A signature on the Solana blockchain by `solanaPublicKey` will be
 * considered as valid signature on the Movement blockchain for the provided message.
 */
export function createSiwsEnvelopeForMovementStructuredMessage(
  input: CreateSiwsEnvelopeInput & { structuredMessage: StructuredMessage },
): SolanaSignInInputWithRequiredFields {
  const { structuredMessage, ...rest } = input;
  const statement = createStructuredMessageStatement(structuredMessage);
  return createSiwsEnvelope({ ...rest, statement });
}

/**
 * Create a SIWS envelope for an Movement transaction.
 * A signature on the Solana blockchain by `solanaPublicKey` will be
 * considered as valid signature on the Movement blockchain for the provided transaction.
 */
export function createSiwsEnvelopeForMovementTransaction(
  input: CreateSiwsEnvelopeInput & { rawTransaction: AnyRawTransaction },
): SolanaSignInInputWithRequiredFields {
  const { rawTransaction, ...rest } = input;
  const statement = createTransactionStatement(rawTransaction);
  return createSiwsEnvelope({ ...rest, statement });
}
