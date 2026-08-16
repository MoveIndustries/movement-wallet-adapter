import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import type { ConnectData, Method } from './protocol.js'
import { generateKeyPair } from './protocol.js'

/**
 * Session state that has to outlive the page.
 *
 * Every request here is a full-page navigation: the browser leaves for the
 * wallet app and comes back through the redirect URL, so nothing in memory
 * survives.
 *
 * `localStorage`, not `sessionStorage`, and that is load-bearing. The wallet
 * app frequently returns into a *new* browser tab rather than the one that
 * left, and `sessionStorage` is per-tab: the returning tab would find no
 * pending request and drop a perfectly good response on the floor, leaving the
 * user looking disconnected after approving. The reference dApp in the wallet
 * repo hit this and made the same choice.
 *
 * The cost is that a session outlives its tab, so `clearSession` on disconnect
 * matters more than it otherwise would.
 */

const STORAGE_KEY = 'movement.deeplink.session.v1'
const PENDING_KEY = 'movement.deeplink.pending.v1'

/** Query parameters the wallet appends when it returns. */
export const RESPONSE_PARAM = 'response'
export const REQUEST_ID_PARAM = 'movement_request_id'

/**
 * The document the user is actually looking at.
 *
 * A subframe cannot hand off to an external app: a custom-scheme navigation
 * made from one is ignored, silently, so the tap does nothing at all. Both
 * halves of the round trip therefore run against the top-level document, the
 * handoff and the response that comes back on its URL.
 *
 * Returns null when an ancestor is cross-origin, which the browser will not
 * let us read or navigate. That case cannot work, and callers say so rather
 * than appearing to do nothing.
 */
export function hostWindow(): Window | null {
  if (typeof window === 'undefined') return null
  const top = window.top
  if (!top || top === window) return window
  try {
    // Throws for a cross-origin ancestor; reading is the only way to ask.
    void top.location.href
    return top
  } catch {
    return null
  }
}

export interface StoredSession {
  walletId: string
  /** Our X25519 secret, hex. Per connection, never reused across wallets. */
  secretKeyHex: string
  /** Our public key, hex — echoed on every request so the wallet finds us. */
  publicKeyHex: string
  /** The wallet's X25519 public key, hex. Absent until connect returns. */
  walletPublicKeyHex?: string
  account?: ConnectData
}

export interface PendingRequest {
  id: string
  walletId: string
  method: Method
  /** Where the page was when the request went out, for restoring context. */
  returnTo: string
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Blocked by cookie policy in some embedded browsers; degrade rather than
    // throw at import time.
    return null
  }
}

function read<T>(key: string): T | null {
  const raw = storage()?.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  storage()?.setItem(key, JSON.stringify(value))
}

function remove(key: string): void {
  storage()?.removeItem(key)
}

export function loadSession(): StoredSession | null {
  return read<StoredSession>(STORAGE_KEY)
}

export function saveSession(session: StoredSession): void {
  write(STORAGE_KEY, session)
}

export function clearSession(): void {
  remove(STORAGE_KEY)
  remove(PENDING_KEY)
}

/** Starts a session with a fresh keypair, discarding any previous one. */
export function beginSession(walletId: string): StoredSession {
  const { secretKey, publicKeyHex } = generateKeyPair()
  const session: StoredSession = {
    walletId,
    secretKeyHex: bytesToHex(secretKey),
    publicKeyHex,
  }
  saveSession(session)
  return session
}

export function secretKeyOf(session: StoredSession): Uint8Array {
  return hexToBytes(session.secretKeyHex)
}

export function loadPending(): PendingRequest | null {
  return read<PendingRequest>(PENDING_KEY)
}

export function savePending(pending: PendingRequest): void {
  write(PENDING_KEY, pending)
}

export function clearPending(): void {
  remove(PENDING_KEY)
}

/**
 * A request id, used to tell our own response apart from a stale one.
 *
 * Without it, a user who navigates back to a URL still carrying an old
 * `response` parameter would have that response applied a second time.
 */
export function newRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/**
 * Pulls a wallet response off the current URL, if one is there and it matches
 * the request we sent.
 *
 * Strips both parameters from the address bar afterwards via `replaceState`, so
 * a reload or a shared link does not carry a spent response.
 */
export type TakenResponse =
  | { ok: true; encoded: string; pending: PendingRequest }
  | { ok: false; reason: string }

export function takeResponseFromUrl(): TakenResponse | null {
  // The response lands on whichever document made the request, which is the
  // top-level one whenever we are framed.
  const host = hostWindow()
  if (!host) return null
  const url = new URL(host.location.href)
  const encoded = url.searchParams.get(RESPONSE_PARAM)
  const requestId = url.searchParams.get(REQUEST_ID_PARAM)
  if (!encoded) return null

  const pending = loadPending()
  // Consume the parameters regardless of whether they match, so a stale one
  // cannot sit in the URL and re-fire on every subsequent request.
  url.searchParams.delete(RESPONSE_PARAM)
  url.searchParams.delete(REQUEST_ID_PARAM)
  host.history.replaceState({}, '', url.toString())

  // Each mismatch gets its own reason. Dropping a response silently is what
  // made this class of bug expensive to diagnose: the user approves, comes
  // back, and the page simply looks like nothing happened.
  if (!requestId) return { ok: false, reason: 'response carried no request id' }
  if (!pending) return { ok: false, reason: 'no pending request found in storage' }
  if (pending.id !== requestId) {
    return { ok: false, reason: 'response is for an older request' }
  }
  clearPending()
  return { ok: true, encoded, pending }
}
