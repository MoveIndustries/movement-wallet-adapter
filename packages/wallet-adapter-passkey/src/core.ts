import {
  Secp256r1PublicKey,
  AccountAuthenticatorSingleKey,
  AnyPublicKey,
  AnySignature,
  WebAuthnSignature,
  generateSigningMessageForTransaction,
  Hex,
  type AnyRawTransaction,
} from '@moveindustries/ts-sdk'
import { sha3_256 } from '@noble/hashes/sha3.js'
import { sha256 } from '@noble/hashes/sha2.js'
// noble/curves v2 ships p256 from the `nist` entry, not a dedicated p256 export.
import { p256 } from '@noble/curves/nist.js'
import type { PasskeyRecoveryStep } from './types'

// ---- Types ----

export interface PasskeyCredential {
  credentialId: string
  publicKey: Uint8Array // 65-byte uncompressed P-256
  address: string
}

// ---- Storage (localStorage only, single session convenience) ----

// Snake_case to match the convention used elsewhere in the workspace for
// localStorage keys; bumped from the source repo's hyphenated key.
const STORAGE_KEY = 'movement_passkey_credential'

export function saveCredential(cred: PasskeyCredential): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      credentialId: cred.credentialId,
      publicKeyHex: Hex.fromHexInput(cred.publicKey).toString(),
      address: cred.address,
    }),
  )
}

export function loadCredential(): PasskeyCredential | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      credentialId: data.credentialId,
      publicKey: Hex.fromHexInput(data.publicKeyHex).toUint8Array(),
      address: data.address,
    }
  } catch {
    return null
  }
}

export function clearCredential(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ---- Address Derivation ----

export function deriveAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error('Invalid uncompressed P-256 public key')
  }
  return new Secp256r1PublicKey(publicKey).authKey().derivedAddress().toString()
}

// ---- Registration ----

export interface RegisterPasskeyOptions {
  rpId: string
  rpName?: string
}

export async function registerPasskey(opts: RegisterPasskeyOptions): Promise<PasskeyCredential> {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { id: opts.rpId, name: opts.rpName ?? 'Movement Network' },
      user: {
        name: 'Movement Network',
        displayName: 'Movement Network',
        id: crypto.getRandomValues(new Uint8Array(32)),
      },
      challenge: challenge.buffer as ArrayBuffer,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
        authenticatorAttachment: 'platform',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('Passkey creation was cancelled')

  const authData = new Uint8Array(
    (credential.response as AuthenticatorAttestationResponse).getAuthenticatorData(),
  )
  const publicKey = extractPublicKeyFromAuthData(authData)
  const credentialId = uint8ToBase64(new Uint8Array(credential.rawId))
  const address = deriveAddress(publicKey)

  const cred: PasskeyCredential = { credentialId, publicKey, address }
  saveCredential(cred)
  return cred
}

// ---- Transaction Signing ----

export interface SignTransactionOptions {
  rpId: string
}

export async function signTransactionWithPasskey(
  credential: PasskeyCredential,
  transaction: AnyRawTransaction,
  opts: SignTransactionOptions,
): Promise<AccountAuthenticatorSingleKey> {
  const message = generateSigningMessageForTransaction(transaction)
  const challenge = sha3_256(message)

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      rpId: opts.rpId,
      allowCredentials: [
        {
          type: 'public-key',
          id: base64ToUint8(credential.credentialId),
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('Transaction signing was cancelled')

  const response = assertion.response as AuthenticatorAssertionResponse
  const compactSig = derToCompactNormalized(new Uint8Array(response.signature))

  return new AccountAuthenticatorSingleKey(
    new AnyPublicKey(new Secp256r1PublicKey(credential.publicKey)),
    new AnySignature(
      new WebAuthnSignature(
        compactSig,
        new Uint8Array(response.authenticatorData),
        new Uint8Array(response.clientDataJSON),
      ),
    ),
  )
}

// ---- Sign-In Recovery (dual-signature ECDSA point recovery) ----

export interface SignInOptions {
  rpId: string
  /** Optional progress callback so the host app can show "step 1 of 2" UI. */
  onRecoveryStep?: (step: PasskeyRecoveryStep) => void
}

/**
 * Sign in with a passkey that already exists on the device (or synced via
 * the OS keychain) — recovers the public key without ever talking to a
 * server.
 *
 * WebAuthn assertions don't include the public key (only registration does).
 * To get it back, we use ECDSA point recovery: every signature points to
 * exactly **two** candidate public keys; if we collect signatures from two
 * different challenges and intersect their candidate sets, the unique
 * matching key is the real one.
 *
 * Cost: two biometric prompts per first sign-in. Subsequent sessions on
 * this device skip both (credential cached in localStorage).
 *
 * The first prompt uses no `allowCredentials` so the OS shows a picker for
 * any passkey at this rpId. The second prompt is bound to the credential
 * the user just picked, so they can't accidentally pick a different
 * passkey on the second tap.
 */
export async function signInWithExistingPasskey(
  opts: SignInOptions,
): Promise<PasskeyCredential> {
  const { rpId, onRecoveryStep } = opts

  // ---- First signature: discoverable-credential picker ----
  onRecoveryStep?.('authenticating-1')
  const challenge1 = new Uint8Array(32)
  crypto.getRandomValues(challenge1)
  const assertion1 = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge1.buffer as ArrayBuffer,
      rpId,
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!assertion1) throw new Error('Passkey selection was cancelled')

  const r1 = assertion1.response as AuthenticatorAssertionResponse
  const sig1 = derToCompactNormalized(new Uint8Array(r1.signature))
  const authData1 = new Uint8Array(r1.authenticatorData)
  const clientData1 = new Uint8Array(r1.clientDataJSON)
  const msgHash1 = computeWebAuthnSignedHash(authData1, clientData1)
  const candidates1 = recoverPublicKeyCandidates(sig1, msgHash1)
  if (candidates1.length === 0) {
    throw new Error('Could not recover public key candidates from first signature')
  }

  const credentialId = uint8ToBase64(new Uint8Array(assertion1.rawId))

  // ---- Second signature: bound to the same credential ----
  onRecoveryStep?.('authenticating-2')
  const challenge2 = new Uint8Array(32)
  crypto.getRandomValues(challenge2)
  const assertion2 = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge2.buffer as ArrayBuffer,
      rpId,
      allowCredentials: [
        {
          type: 'public-key',
          id: base64ToUint8(credentialId),
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!assertion2) throw new Error('Verification step was cancelled')

  const r2 = assertion2.response as AuthenticatorAssertionResponse
  const sig2 = derToCompactNormalized(new Uint8Array(r2.signature))
  const authData2 = new Uint8Array(r2.authenticatorData)
  const clientData2 = new Uint8Array(r2.clientDataJSON)
  const msgHash2 = computeWebAuthnSignedHash(authData2, clientData2)
  const candidates2 = recoverPublicKeyCandidates(sig2, msgHash2)

  // ---- Intersection ----
  const found = findCommonCandidate(candidates1, candidates2)
  if (!found) {
    throw new Error(
      'Could not recover a unique public key — both signatures should come from the same passkey',
    )
  }

  const address = deriveAddress(found)
  const cred: PasskeyCredential = { credentialId, publicKey: found, address }
  saveCredential(cred)
  onRecoveryStep?.('complete')
  return cred
}

/**
 * Compute the exact bytes that the authenticator's ECDSA-P256 signature
 * is over, then SHA-256 it (P-256 / ES256 always pairs with SHA-256).
 *
 * Per the WebAuthn spec: signed payload = `authenticatorData || SHA-256(clientDataJSON)`.
 * ECDSA signs SHA-256 of that payload. For recovery we need that final hash.
 */
function computeWebAuthnSignedHash(
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
): Uint8Array {
  const clientDataHash = sha256(clientDataJSON)
  const signed = new Uint8Array(authenticatorData.length + clientDataHash.length)
  signed.set(authenticatorData, 0)
  signed.set(clientDataHash, authenticatorData.length)
  return sha256(signed)
}

/**
 * Given a 64-byte compact P-256 signature and the message hash that was
 * signed, recover the (up to two) candidate public keys in uncompressed
 * SEC1 form (65 bytes, 0x04-prefixed).
 */
function recoverPublicKeyCandidates(
  compactSig64: Uint8Array,
  messageHash32: Uint8Array,
): Uint8Array[] {
  const sig = p256.Signature.fromBytes(compactSig64, 'compact')
  const out: Uint8Array[] = []
  for (const rec of [0, 1] as const) {
    try {
      const point = sig.addRecoveryBit(rec).recoverPublicKey(messageHash32)
      out.push(projPointToUncompressed(point))
    } catch {
      // Some recovery bits don't yield valid points; skip.
    }
  }
  return out
}

/**
 * Convert any noble-curves point (affine or projective) to a 65-byte
 * uncompressed SEC1 public key. Defensive against API drift across
 * noble versions: we only assume the point exposes `.toAffine()` returning
 * `{ x: bigint; y: bigint }`, or that it already has those fields.
 */
function projPointToUncompressed(point: unknown): Uint8Array {
  const affine =
    typeof (point as { toAffine?: () => { x: bigint; y: bigint } }).toAffine === 'function'
      ? (point as { toAffine: () => { x: bigint; y: bigint } }).toAffine()
      : (point as { x: bigint; y: bigint })
  if (typeof affine.x !== 'bigint' || typeof affine.y !== 'bigint') {
    throw new Error('Recovered point does not expose bigint x/y coordinates')
  }
  const out = new Uint8Array(65)
  out[0] = 0x04
  writeBigInt32BE(out, 1, affine.x)
  writeBigInt32BE(out, 33, affine.y)
  return out
}

function writeBigInt32BE(buf: Uint8Array, offset: number, value: bigint): void {
  const hex = value.toString(16).padStart(64, '0')
  for (let i = 0; i < 32; i++) {
    buf[offset + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
}

function findCommonCandidate(a: Uint8Array[], b: Uint8Array[]): Uint8Array | null {
  for (const ca of a) {
    for (const cb of b) {
      if (uint8Equal(ca, cb)) return ca
    }
  }
  return null
}

function uint8Equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ---- COSE / Authenticator Data Parsing ----

function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array {
  const flagsByte = authData[32]
  if (flagsByte === undefined || !(flagsByte & 0x40)) {
    throw new Error('No attested credential data in authenticator data')
  }
  let offset = 37 + 16 // rpIdHash + flags + signCount + aaguid
  const hi = authData[offset]
  const lo = authData[offset + 1]
  if (hi === undefined || lo === undefined) throw new Error('Truncated authenticator data')
  const credIdLen = (hi << 8) | lo
  offset += 2 + credIdLen
  return parseCoseP256Key(authData.slice(offset))
}

function parseCoseP256Key(cbor: Uint8Array): Uint8Array {
  let offset = 0
  let x: Uint8Array | null = null
  let y: Uint8Array | null = null

  const firstByte = cbor[offset++]
  if (firstByte === undefined) throw new Error('Empty CBOR')
  if (firstByte >> 5 !== 5) throw new Error('Expected CBOR map')
  const mapLen = firstByte & 0x1f

  for (let i = 0; i < mapLen; i++) {
    const keyByte = cbor[offset++]
    if (keyByte === undefined) throw new Error('Truncated CBOR')
    const keyMajor = keyByte >> 5
    const key =
      keyMajor === 0
        ? keyByte & 0x1f
        : keyMajor === 1
          ? -1 - (keyByte & 0x1f)
          : (() => {
              throw new Error('Bad CBOR key')
            })()

    const valByte = cbor[offset]
    if (valByte === undefined) throw new Error('Truncated CBOR value')
    const valMajor = valByte >> 5

    if (valMajor === 0 || valMajor === 1) {
      offset++
    } else if (valMajor === 2) {
      const len = valByte & 0x1f
      offset++
      let byteLen: number
      if (len < 24) {
        byteLen = len
      } else {
        const lenByte = cbor[offset++]
        if (lenByte === undefined) throw new Error('Truncated CBOR length')
        byteLen = lenByte
      }
      const bytes = cbor.slice(offset, offset + byteLen)
      offset += byteLen
      if (key === -2) x = bytes
      if (key === -3) y = bytes
    } else if (valMajor === 3) {
      const len = valByte & 0x1f
      offset++
      if (len < 24) {
        offset += len
      } else {
        const lenByte = cbor[offset++]
        if (lenByte === undefined) throw new Error('Truncated CBOR length')
        offset += lenByte
      }
    } else {
      throw new Error('Unexpected CBOR value type')
    }
  }

  if (!x || !y || x.length !== 32 || y.length !== 32) {
    throw new Error('Invalid P-256 COSE key')
  }

  const pk = new Uint8Array(65)
  pk[0] = 0x04
  pk.set(x, 1)
  pk.set(y, 33)
  return pk
}

// ---- Signature Conversion ----

const P256_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')

function derToCompactNormalized(der: Uint8Array): Uint8Array {
  let o = 2 // skip 0x30 + length
  if (der[o++] !== 0x02) throw new Error('Bad DER')
  const rLen = der[o++]
  if (rLen === undefined) throw new Error('Bad DER (rLen)')
  const r = padTo32(der.slice(o, o + rLen))
  o += rLen
  if (der[o++] !== 0x02) throw new Error('Bad DER')
  const sLen = der[o++]
  if (sLen === undefined) throw new Error('Bad DER (sLen)')
  const s = padTo32(der.slice(o, o + sLen))

  // Low-S normalization
  let sBig = 0n
  for (let i = 0; i < 32; i++) {
    const b = s[i]
    if (b === undefined) throw new Error('padTo32 returned short array')
    sBig = (sBig << 8n) | BigInt(b)
  }
  if (sBig > P256_N >> 1n) {
    const norm = P256_N - sBig
    const hex = norm.toString(16).padStart(64, '0')
    const sNorm = new Uint8Array(32)
    for (let i = 0; i < 32; i++) sNorm[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    return concat(r, sNorm)
  }
  return concat(r, s)
}

function padTo32(b: Uint8Array): Uint8Array {
  if (b.length === 32) return b
  if (b.length > 32) return b.slice(b.length - 32)
  const p = new Uint8Array(32)
  p.set(b, 32 - b.length)
  return p
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length)
  r.set(a)
  r.set(b, a.length)
  return r
}

// ---- Base64 helpers ----

function uint8ToBase64(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    if (b === undefined) throw new Error('Index out of bounds in uint8ToBase64')
    s += String.fromCharCode(b)
  }
  return btoa(s)
}

function base64ToUint8(b64: string): ArrayBuffer {
  const s = atob(b64)
  const buf = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i)
  return buf.buffer as ArrayBuffer
}
