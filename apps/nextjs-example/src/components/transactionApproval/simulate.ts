import {
  Movement,
  type AnyRawTransaction,
  type InputGenerateTransactionPayloadData,
  type InputGenerateTransactionOptions,
  type UserTransactionResponse,
} from "@moveindustries/ts-sdk";
import type { TransactionApprovalKind } from "./TransactionApprovalModal";

interface TxInputShape {
  data?: InputGenerateTransactionPayloadData;
  options?: InputGenerateTransactionOptions;
  transactionOrPayload?: unknown;
  asFeePayer?: boolean;
}

/** A single state-change effect surfaced from a simulation. */
export interface SimEvent {
  /** Short "module::Event" name. */
  type: string;
  /** Amount, if the event carried one (coin/FA transfers). */
  amount?: string;
}

/** Result of a simulation attempt (never the in-flight "loading" state). */
export type SimulationResult =
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string }
  | {
      status: "done";
      success: boolean;
      vmStatus: string;
      feeOctas: bigint;
      events: SimEvent[];
    };

export type SimulationState = { status: "loading" } | SimulationResult;

interface SimulateArgs {
  client: Movement;
  sender: string;
  kind: TransactionApprovalKind;
  /** The raw argument the dApp passed to signAndSubmit / signTransaction. */
  input: unknown;
}

/**
 * Build the transaction described by `input` and simulate it against the node,
 * returning a normalized summary of its effects. Fee-payer and multi-agent
 * transactions are reported as unsupported (they need extra signer keys the
 * approval flow doesn't have).
 */
export async function runSimulation(
  args: SimulateArgs,
): Promise<SimulationResult> {
  try {
    const transaction = await resolveTransaction(args);
    if (!transaction) {
      return {
        status: "unsupported",
        reason: "This transaction type can't be simulated here.",
      };
    }
    // Omit signerPublicKey so the node skips the auth-key check — the tx still
    // runs and returns effects/gas. Passing a passkey (Secp256r1) key here trips
    // the single-signer simulation path.
    const [result] = await args.client.transaction.simulate.simple({
      transaction,
    });
    return normalize(result);
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function resolveTransaction({
  client,
  sender,
  kind,
  input,
}: SimulateArgs): Promise<AnyRawTransaction | null> {
  const p = (input ?? {}) as TxInputShape;

  if (kind === "sign-and-submit") {
    if (!p.data) return null;
    return client.transaction.build.simple({
      sender,
      data: p.data,
      options: p.options,
    });
  }

  // kind === "sign"
  if (p.asFeePayer) return null; // needs feePayerPublicKey
  const top = p.transactionOrPayload;
  if (isBuiltTransaction(top)) {
    // Multi-agent / fee-payer built transactions need secondary signer keys.
    if (
      "secondarySignerAddresses" in top ||
      (top as { feePayerAddress?: unknown }).feePayerAddress
    ) {
      return null;
    }
    return top as AnyRawTransaction;
  }
  const inner = top as TxInputShape | undefined;
  if (!inner?.data) return null;
  return client.transaction.build.simple({
    sender,
    data: inner.data,
    options: inner.options,
  });
}

function isBuiltTransaction(v: unknown): v is object {
  return !!v && typeof v === "object" && "rawTransaction" in v;
}

function normalize(result: UserTransactionResponse): SimulationResult {
  let feeOctas = BigInt(0);
  try {
    feeOctas = BigInt(result.gas_used) * BigInt(result.gas_unit_price);
  } catch {
    /* leave 0 */
  }
  const events: SimEvent[] = (result.events ?? []).map((e) => {
    const amount = (e.data as { amount?: unknown } | null)?.amount;
    return {
      type: shortType(e.type),
      amount: amount != null ? String(amount) : undefined,
    };
  });
  return {
    status: "done",
    success: result.success,
    vmStatus: result.vm_status,
    feeOctas,
    events,
  };
}

/** "0x1::coin::WithdrawEvent" → "coin::WithdrawEvent". */
function shortType(type: string): string {
  const parts = type.replace(/<.*>$/, "").split("::");
  return parts.slice(-2).join("::");
}
