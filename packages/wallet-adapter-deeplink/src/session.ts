import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import type { ConnectData, Method } from './protocol'
import { generateKeyPair } from './protocol'

/**
 * Session state that has to outlive the page.
 *
 * Every request here is a full-page navigation: the browser leaves for the
 * wallet app and comes back through the redirect URL, so nothing in memory
 * survives. `sessionStorage` is the store because the session is per-tab and
 * should not outlive it — a connection left in `localStorage` would silently
 * reappear in a new tab where the user never connected.
 */

const STORAGE_KEY = 'movement.deeplink.session.v1'
const PENDING_KEY = 'movement.deeplink.pending.v1'

/** Query parameters the wallet appends when it returns. */
export const RESPONSE_PARAM = 'response'
export const REQUEST_ID_PARAM = 'movement_request_id'

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
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
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
export function takeResponseFromUrl(): { encoded: string; pending: PendingRequest } | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const encoded = url.searchParams.get(RESPONSE_PARAM)
  const requestId = url.searchParams.get(REQUEST_ID_PARAM)
  if (!encoded) return null

  const pending = loadPending()
  // Consume the parameters regardless of whether they match, so a stale one
  // cannot sit in the URL and re-fire on every subsequent request.
  url.searchParams.delete(RESPONSE_PARAM)
  url.searchParams.delete(REQUEST_ID_PARAM)
  window.history.replaceState({}, '', url.toString())

  if (!pending || !requestId || pending.id !== requestId) return null
  clearPending()
  return { encoded, pending }
}
