import { describe, it, expect, beforeEach } from 'vitest'
import { p256 } from '@noble/curves/nist.js'
import { sha3_256 } from '@noble/hashes/sha3.js'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js'
import {
  deriveAddress,
  parseCoseP256Key,
  extractPublicKeyFromAuthData,
  derToCompactNormalized,
  recoverPublicKeyCandidates,
  findCommonCandidates,
  computeWebAuthnSignedHash,
  saveCredential,
  loadCredential,
  type PasskeyCredential,
} from './core'

// Fixed P-256 scalar (< curve order n) so every vector below is deterministic.
const PRIV = hexToBytes('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff')
const PUB = p256.getPublicKey(PRIV, false) // 65-byte uncompressed, 0x04-prefixed
const X = PUB.slice(1, 33)
const Y = PUB.slice(33, 65)

const P256_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// DER-encode an (r, s) pair exactly as WebAuthn authenticators emit it.
function derEncode(r: Uint8Array, s: Uint8Array): Uint8Array {
  const body = concat(Uint8Array.of(0x02, r.length), r, Uint8Array.of(0x02, s.length), s)
  return concat(Uint8Array.of(0x30, body.length), body)
}

function bigToBe32(v: bigint): Uint8Array {
  return hexToBytes(v.toString(16).padStart(64, '0'))
}

describe('parseCoseP256Key', () => {
  it('extracts 0x04||x||y from an ES256 COSE_Key map', () => {
    // COSE_Key: {1:2 (EC2), 3:-7 (ES256), -1:1 (P-256), -2:x, -3:y}
    const cose = concat(
      Uint8Array.of(0xa5), // map(5)
      Uint8Array.of(0x01, 0x02), // kty: EC2
      Uint8Array.of(0x03, 0x26), // alg: ES256 (-7)
      Uint8Array.of(0x20, 0x01), // crv: P-256 (1)
      Uint8Array.of(0x21, 0x58, 0x20),
      X, // -2: x (32-byte bstr)
      Uint8Array.of(0x22, 0x58, 0x20),
      Y, // -3: y (32-byte bstr)
    )
    expect(equal(parseCoseP256Key(cose), PUB)).toBe(true)
  })

  it('rejects a COSE key with a short coordinate', () => {
    const cose = concat(
      Uint8Array.of(0xa3),
      Uint8Array.of(0x01, 0x02),
      Uint8Array.of(0x21, 0x58, 0x10),
      X.slice(0, 16), // 16-byte x — invalid
      Uint8Array.of(0x22, 0x58, 0x20),
      Y,
    )
    expect(() => parseCoseP256Key(cose)).toThrow()
  })
})

describe('extractPublicKeyFromAuthData', () => {
  it('walks attested credential data to the COSE key', () => {
    const cose = concat(
      Uint8Array.of(0xa5),
      Uint8Array.of(0x01, 0x02),
      Uint8Array.of(0x03, 0x26),
      Uint8Array.of(0x20, 0x01),
      Uint8Array.of(0x21, 0x58, 0x20),
      X,
      Uint8Array.of(0x22, 0x58, 0x20),
      Y,
    )
    const credId = new Uint8Array(16).fill(0xab)
    const authData = concat(
      new Uint8Array(32).fill(0x11), // rpIdHash
      Uint8Array.of(0x45), // flags with AT (0x40) set
      new Uint8Array(4), // signCount
      new Uint8Array(16).fill(0x22), // aaguid
      Uint8Array.of(0x00, credId.length), // credIdLen (16)
      credId,
      cose,
    )
    expect(equal(extractPublicKeyFromAuthData(authData), PUB)).toBe(true)
  })

  it('throws when the AT flag is unset', () => {
    const authData = concat(new Uint8Array(32), Uint8Array.of(0x01), new Uint8Array(4))
    expect(() => extractPublicKeyFromAuthData(authData)).toThrow()
  })
})

describe('derToCompactNormalized', () => {
  it('produces a 64-byte compact signature', () => {
    const der = p256.sign(new Uint8Array(32).fill(9), PRIV, { prehash: false, format: 'der' })
    expect(derToCompactNormalized(der).length).toBe(64)
  })

  it('strips the DER leading-zero byte from a 33-byte high-bit coordinate', () => {
    const r = new Uint8Array(32).fill(0xff) // high bit set → DER prepends 0x00
    const s = new Uint8Array(32).fill(0x02) // low-S, no prefix
    const der = derEncode(concat(Uint8Array.of(0x00), r), s)
    const compact = derToCompactNormalized(der)
    expect(equal(compact.slice(0, 32), r)).toBe(true)
    expect(equal(compact.slice(32), s)).toBe(true)
  })

  it('normalizes a high-S signature to low-S (s -> n - s)', () => {
    const r = new Uint8Array(32).fill(0x11)
    const highS = bigToBe32(P256_N - 1n) // n-1 is > n/2 (high) and has the high bit set
    const der = derEncode(r, concat(Uint8Array.of(0x00), highS))
    const compact = derToCompactNormalized(der)
    // n - (n-1) == 1
    expect(equal(compact.slice(32), bigToBe32(1n))).toBe(true)
    expect(equal(compact.slice(0, 32), r)).toBe(true)
  })
})

describe('point recovery (sign-in path)', () => {
  // Mirror an authenticator assertion: sign the exact WebAuthn hash and hand
  // back the DER signature, as navigator.credentials.get() would.
  function fakeAssertion(seed: number): { der: Uint8Array; hash: Uint8Array } {
    const authData = new Uint8Array(37).fill(seed)
    const clientData = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge: `c${seed}` }),
    )
    const hash = computeWebAuthnSignedHash(authData, clientData)
    const der = p256.sign(hash, PRIV, { prehash: false, format: 'der', lowS: false })
    return { der, hash }
  }

  it('recovers the true key as one of the two candidates', () => {
    const { der, hash } = fakeAssertion(1)
    const candidates = recoverPublicKeyCandidates(derToCompactNormalized(der), hash)
    expect(candidates.length).toBe(2)
    expect(candidates.some((c) => equal(c, PUB))).toBe(true)
  })

  it('intersects two assertions to exactly one key == the registered key', () => {
    const a1 = fakeAssertion(1)
    const a2 = fakeAssertion(2)
    const c1 = recoverPublicKeyCandidates(derToCompactNormalized(a1.der), a1.hash)
    const c2 = recoverPublicKeyCandidates(derToCompactNormalized(a2.der), a2.hash)
    const common = findCommonCandidates(c1, c2)
    expect(common.length).toBe(1)
    expect(equal(common[0]!, PUB)).toBe(true)
  })
})

describe('findCommonCandidates', () => {
  const a = new Uint8Array([1, 2, 3])
  const b = new Uint8Array([4, 5, 6])
  const c = new Uint8Array([7, 8, 9])

  it('returns the single shared element', () => {
    expect(findCommonCandidates([a, b], [c, a])).toEqual([a])
  })

  it('returns all shared elements so the caller can reject a non-unique match', () => {
    expect(findCommonCandidates([a, b], [a, b]).length).toBe(2)
  })

  it('returns empty when there is no overlap', () => {
    expect(findCommonCandidates([a], [b, c])).toEqual([])
  })
})

describe('deriveAddress', () => {
  it('matches an independent SingleKey authentication-key derivation', () => {
    // auth key = sha3_256( bcs(AnyPublicKey::Secp256r1(pk)) || SingleKey scheme )
    // bcs(AnyPublicKey) = uleb(variant=2) || uleb(len=65) || pk
    const preimage = concat(
      Uint8Array.of(0x02), // AnyPublicKey variant: Secp256r1
      Uint8Array.of(0x41), // uleb128(65)
      PUB,
      Uint8Array.of(0x02), // SigningScheme::SingleKey
    )
    const expected = '0x' + bytesToHex(sha3_256(preimage))
    expect(deriveAddress(PUB)).toBe(expected)
  })

  it('rejects a public key that is not 65-byte uncompressed', () => {
    expect(() => deriveAddress(new Uint8Array(64))).toThrow()
    expect(() => deriveAddress(concat(Uint8Array.of(0x03), X, Y))).toThrow()
  })
})

describe('loadCredential integrity check', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a valid credential', () => {
    const cred: PasskeyCredential = {
      credentialId: 'abc',
      publicKey: PUB,
      address: deriveAddress(PUB),
    }
    saveCredential(cred)
    const loaded = loadCredential()
    expect(loaded?.address).toBe(cred.address)
    expect(equal(loaded!.publicKey, PUB)).toBe(true)
  })

  it('discards a credential whose stored address was tampered', () => {
    saveCredential({ credentialId: 'abc', publicKey: PUB, address: deriveAddress(PUB) })
    const raw = JSON.parse(localStorage.getItem('movement_passkey_credential')!)
    raw.address = '0x' + '00'.repeat(32) // spoofed address, real pubkey
    localStorage.setItem('movement_passkey_credential', JSON.stringify(raw))
    expect(loadCredential()).toBeNull()
    // and it clears the poisoned entry
    expect(localStorage.getItem('movement_passkey_credential')).toBeNull()
  })
})
