// Formatting helpers for the transaction-approval summary. Kept local so the
// approval UI has no dependency on any SDK network/token config.

/** Octas per 1 MOVE (8 decimals), matching the Movement/Aptos coin standard. */
export const OCTAS_PER_MOVE = BigInt(100000000);
const ZERO = BigInt(0);

/** `0x1234…abcd` — keeps long hex readable while preserving the full value elsewhere. */
export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Octas → MOVE with up to 8 decimals, trailing zeros stripped. */
export function formatOctas(octas: bigint): string {
  if (octas === ZERO) return "0";
  const whole = octas / OCTAS_PER_MOVE;
  const fraction = octas % OCTAS_PER_MOVE;
  if (fraction === ZERO) return whole.toString();
  const fracStr = fraction.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Coerce an on-chain amount argument to bigint. Handles primitives (bigint,
 * number, decimal string) and SDK wrappers like `U64`/`U128` — which arrive as
 * objects carrying a bigint `value` and a decimal `toString()`.
 */
export function parseAmount(raw: unknown): bigint | null {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw))
    return BigInt(Math.trunc(raw));
  if (typeof raw === "string") return digitsToBigInt(raw);
  if (raw !== null && typeof raw === "object") {
    const value = (raw as { value?: unknown }).value;
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value))
      return BigInt(Math.trunc(value));
    return digitsToBigInt(String(raw));
  }
  return null;
}

function digitsToBigInt(s: string): bigint | null {
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/**
 * JSON.stringify that survives values you'd otherwise see as "[object Object]":
 * bigints become decimal strings, Uint8Arrays and SDK objects exposing
 * `toUint8Array()` (Signature, PublicKey, AccountAddress, …) become 0x-hex.
 */
export function prettyJson(value: unknown, indent = 2): string {
  try {
    return JSON.stringify(value, prettyReplacer, indent);
  } catch (e) {
    return `<unserializable: ${e instanceof Error ? e.message : String(e)}>`;
  }
}

function prettyReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return uint8ToHex(value);
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toUint8Array?: unknown }).toUint8Array === "function"
  ) {
    try {
      const bytes = (value as { toUint8Array(): unknown }).toUint8Array();
      if (bytes instanceof Uint8Array) return uint8ToHex(bytes);
    } catch {
      /* fall through to default serialization */
    }
  }
  return value;
}

function uint8ToHex(bytes: Uint8Array): string {
  let out = "0x";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
