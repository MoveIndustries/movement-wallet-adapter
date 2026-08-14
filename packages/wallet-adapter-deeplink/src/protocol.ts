import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js'

/**
 * The wallet's native deeplink wire format.
 *
 * Byte-compatible with `DAppProtocol` in the wallet apps: X25519 key agreement,
 * HKDF-SHA256 with the info string below, then ChaCha20-Poly1305 over every
 * payload after the connect handshake. The sealed layout reproduces CryptoKit's
 * `ChaChaPoly.SealedBox.combined` — `nonce(12) ‖ ciphertext ‖ tag(16)`, base64 —
 * because the iOS side seals with CryptoKit and the Android side was written to
 * match it.
 *
 * Nothing here touches the DOM, so it can be tested without a browser.
 */

export const HKDF_INFO = 'motion-wallet-dapp-v1'

const NONCE_BYTES = 12

export type Method =
  | 'connect'
  | 'disconnect'
  | 'sign_and_submit'
  | 'sign_message'
  | 'sign_transaction'

/** What the wallet returns from `connect`, once unsealed. */
export interface ConnectData {
  address: string
  publicKey: string
  network: string
  /** Present from the build that introduced the https entry point. */
  version?: string
  /**
   * Wire methods the connected build answers. Absent on older builds, which
   * predate discovery — callers must treat missing as "assume the original
   * four", never as "supports nothing".
   */
  methods?: string[]
}

export interface KeyPair {
  secretKey: Uint8Array
  publicKeyHex: string
}

export function generateKeyPair(): KeyPair {
  const secretKey = x25519.utils.randomSecretKey()
  return { secretKey, publicKeyHex: bytesToHex(x25519.getPublicKey(secretKey)) }
}

/** X25519 → HKDF-SHA256 → 32-byte ChaCha20-Poly1305 key. */
export function sharedKey(secretKey: Uint8Array, theirPublicKeyHex: string): Uint8Array {
  const shared = x25519.getSharedSecret(secretKey, hexToBytes(normalizeHex(theirPublicKeyHex)))
  return hkdf(sha256, shared, new Uint8Array(0), new TextEncoder().encode(HKDF_INFO), 32)
}

/** dApps are inconsistent about the `0x` prefix; the wallet normalizes too. */
export function normalizeHex(hex: string): string {
  const s = hex.trim().toLowerCase()
  return s.startsWith('0x') ? s.slice(2) : s
}

export function seal(value: unknown, key: Uint8Array): string {
  const nonce = randomBytes(NONCE_BYTES)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = chacha20poly1305(key, nonce).encrypt(plaintext)
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce, 0)
  combined.set(ciphertext, nonce.length)
  return base64Encode(combined)
}

export function open<T>(sealed: string, key: Uint8Array): T {
  const combined = base64Decode(sealed)
  if (combined.length <= NONCE_BYTES) throw new Error('Malformed sealed payload')
  const nonce = combined.subarray(0, NONCE_BYTES)
  const ciphertext = combined.subarray(NONCE_BYTES)
  const plaintext = chacha20poly1305(key, nonce).decrypt(ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

/**
 * Request `data` is base64url, matching `DAppProtocol.base64UrlEncode` on the
 * wallet side — it travels in a query string, where `+` and `/` do not survive.
 * The sealed payload inside it stays standard base64.
 */
export function encodeRequest(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
}

export function decodeResponse<T>(encoded: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as T
}

export function base64Encode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function base64Decode(encoded: string): Uint8Array {
  const binary = atob(padBase64(encoded.replace(/-/g, '+').replace(/_/g, '/')))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(encoded: string): Uint8Array {
  return base64Decode(encoded)
}

function padBase64(s: string): string {
  return s.length % 4 === 0 ? s : s + '='.repeat(4 - (s.length % 4))
}
