import { cn } from "@/lib/utils";
import {
  formatOctas,
  parseAmount,
  prettyJson,
  truncateAddress,
} from "./format";
import type { TransactionApprovalKind } from "./TransactionApprovalModal";

interface TransactionData {
  function?: string;
  bytecode?: string;
  typeArguments?: unknown[];
  functionArguments?: unknown[];
}

interface Payload {
  // signAndSubmitTransaction — InputTransactionData: { data: {...} }
  data?: TransactionData;
  // wallet-standard sign-and-submit / signTransaction v1.1 — { payload: {...} }
  payload?: TransactionData;
  // signTransaction — { transactionOrPayload, asFeePayer? }
  transactionOrPayload?: unknown;
  asFeePayer?: boolean;
  feePayer?: unknown;
}

/**
 * Pull the innermost transaction data out of any of the shapes the demo passes
 * to signAndSubmitTransaction / signTransaction:
 *   - { data: {...} }                          (InputTransactionData)
 *   - { payload: {...} }                       (wallet-standard)
 *   - { transactionOrPayload: { data: {...} } } (signTransaction wrapping InputTransactionData)
 *   - { transactionOrPayload: <AnyRawTransaction> } (already-built tx → no function)
 */
function resolveData(p: Payload): TransactionData | undefined {
  const hasFn = (d?: TransactionData) => !!(d?.function || d?.bytecode);
  if (hasFn(p.data)) return p.data;
  if (hasFn(p.payload)) return p.payload;
  const t = p.transactionOrPayload;
  if (t && typeof t === "object") {
    const inner = t as { data?: TransactionData } & TransactionData;
    if (hasFn(inner.data)) return inner.data;
    if (hasFn(inner)) return inner;
  }
  return p.data ?? p.payload;
}

/**
 * Human-readable summary of a transaction payload. Recognized functions
 * (MOVE/coin/FA transfers) get a structured "Action / Amount / Recipient"
 * block; anything else falls back to a generic "Call function" view with the
 * full payload behind a disclosure.
 */
export function TxPayloadSummary({
  payload,
  kind,
}: {
  payload: unknown;
  kind: TransactionApprovalKind;
}) {
  const p = (payload ?? {}) as Payload;
  const data = resolveData(p);
  const fn = data?.function;
  const isFeePayer = !!p.feePayer || !!p.asFeePayer;

  // Native MOVE transfer: 0x1::aptos_account::transfer(recipient, amount).
  // Amount is always in octas.
  if (fn === "0x1::aptos_account::transfer") {
    const args = data?.functionArguments ?? [];
    const amount = parseAmount(args[1]);
    return (
      <Summary>
        <Pill label="Action" value="Send MOVE" />
        <DetailRow
          label="Amount"
          value={amount !== null ? `${formatOctas(amount)} MOVE` : "—"}
          mono
        />
        <AddressRow label="Recipient" address={String(args[0] ?? "")} />
        <FootnoteRow kind={kind} feePayer={isFeePayer} />
      </Summary>
    );
  }

  // Coin transfer, generic over the coin type argument:
  //   0x1::coin::transfer<T>(recipient, amount)
  //   0x1::aptos_account::transfer_coins<T>(recipient, amount)
  // Only "MOVE" (and octas formatting) when T is the native AptosCoin;
  // otherwise show the coin type and the raw amount.
  if (fn === "0x1::coin::transfer" || fn === "0x1::aptos_account::transfer_coins") {
    const args = data?.functionArguments ?? [];
    const amount = parseAmount(args[1]);
    const coinType = String(data?.typeArguments?.[0] ?? "");
    const isMove = /aptos_coin::AptosCoin/.test(coinType);
    return (
      <Summary>
        <Pill label="Action" value={isMove ? "Send MOVE" : "Send coin"} />
        {!isMove && (
          <DetailRow label="Coin type" value={coinType || "unknown"} mono truncate />
        )}
        <DetailRow
          label="Amount"
          value={
            amount === null
              ? "—"
              : isMove
                ? `${formatOctas(amount)} MOVE`
                : amount.toString()
          }
          mono
        />
        <AddressRow label="Recipient" address={String(args[0] ?? "")} />
        <FootnoteRow kind={kind} feePayer={isFeePayer} />
      </Summary>
    );
  }

  // 0x1::primary_fungible_store::transfer(asset, recipient, amount)
  if (fn === "0x1::primary_fungible_store::transfer") {
    const args = data?.functionArguments ?? [];
    const amount = parseAmount(args[2]);
    return (
      <Summary>
        <Pill label="Action" value="Send fungible asset" />
        <AddressRow label="Asset" address={String(args[0] ?? "")} />
        <DetailRow label="Amount" value={amount !== null ? amount.toString() : "—"} mono />
        <AddressRow label="Recipient" address={String(args[1] ?? "")} />
        <FootnoteRow kind={kind} feePayer={isFeePayer} />
      </Summary>
    );
  }

  // Fallback: generic function / script call
  const typeArgs = (data?.typeArguments ?? []).map(String);
  return (
    <Summary>
      <Pill label="Action" value={data?.bytecode ? "Run script" : "Call function"} />
      {fn && <DetailRow label="Function" value={fn} mono truncate />}
      {typeArgs.length > 0 && (
        <DetailRow label="Type args" value={typeArgs.join(", ")} mono truncate />
      )}
      {data?.functionArguments && (
        <DetailRow
          label="Args"
          value={`${data.functionArguments.length} argument${
            data.functionArguments.length === 1 ? "" : "s"
          }`}
        />
      )}
      <FootnoteRow kind={kind} feePayer={isFeePayer} />
      <details className="min-w-0 text-xs">
        <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">
          Show raw payload
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-sm bg-muted p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
          {prettyJson(payload)}
        </pre>
      </details>
    </Summary>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full min-w-0 flex-col gap-3">{children}</div>;
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
      <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right",
          mono && "font-mono text-xs",
          truncate && "min-w-0 flex-1 truncate",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** Addresses render as `0x1234…abcd` with the full hex in the title attribute. */
function AddressRow({ label, address }: { label: string; address: string }) {
  const display = address.length > 12 ? truncateAddress(address) : address;
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs" title={address}>
        {display}
      </span>
    </div>
  );
}

function FootnoteRow({
  kind,
  feePayer,
}: {
  kind: TransactionApprovalKind;
  feePayer: boolean;
}) {
  const bits: string[] = [];
  bits.push(kind === "sign-and-submit" ? "Sign and submit" : "Sign only");
  if (feePayer) bits.push("Fee payer role");
  return (
    <p className="border-t border-border pt-3 text-xs text-muted-foreground">
      {bits.join(" · ")}
    </p>
  );
}
