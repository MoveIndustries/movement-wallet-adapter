import { describe, expect, it } from 'vitest'
import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js'
import {
  base64Decode,
  base64Encode,
  base64UrlEncode,
  decodeResponse,
  encodeRequest,
  generateKeyPair,
  HKDF_INFO,
  normalizeHex,
  open,
  seal,
  sharedKey,
} from './protocol.js'

describe('channel crypto', () => {
  it('agrees on a key from either side', () => {
    const dapp = generateKeyPair()
    const wallet = generateKeyPair()

    const fromDapp = sharedKey(dapp.secretKey, wallet.publicKeyHex)
    const fromWallet = sharedKey(wallet.secretKey, dapp.publicKeyHex)

    expect(bytesToHex(fromDapp)).toBe(bytesToHex(fromWallet))
  })

  it('tolerates a 0x-prefixed key', () => {
    const dapp = generateKeyPair()
    const wallet = generateKeyPair()
    expect(bytesToHex(sharedKey(dapp.secretKey, `0x${wallet.publicKeyHex}`))).toBe(
      bytesToHex(sharedKey(dapp.secretKey, wallet.publicKeyHex)),
    )
  })

  it('round-trips a sealed payload', () => {
    const key = randomBytes(32)
    const value = { message: 'hello', nonce: '12345' }
    expect(open(seal(value, key), key)).toEqual(value)
  })

  it('rejects a payload sealed under a different key', () => {
    const value = { message: 'hello' }
    expect(() => open(seal(value, randomBytes(32)), randomBytes(32))).toThrow()
  })

  it('rejects a truncated payload rather than returning garbage', () => {
    expect(() => open(base64Encode(new Uint8Array(8)), randomBytes(32))).toThrow()
  })
})

describe('wire compatibility with the wallet', () => {
  // The wallet derives its key with HKDF-SHA256 over an empty salt and this
  // info string, then seals with ChaCha20-Poly1305 in CryptoKit's combined
  // layout: nonce(12) ‖ ciphertext ‖ tag(16), base64. Reproduced here by hand
  // so a change to either side fails loudly instead of silently ending the
  // channel at runtime.
  it('derives the key the way the wallet does', () => {
    const dapp = generateKeyPair()
    const wallet = generateKeyPair()

    const shared = x25519.getSharedSecret(dapp.secretKey, x25519.getPublicKey(wallet.secretKey))
    const expected = hkdf(
      sha256,
      shared,
      new Uint8Array(0),
      new TextEncoder().encode(HKDF_INFO),
      32,
    )

    expect(bytesToHex(sharedKey(dapp.secretKey, wallet.publicKeyHex))).toBe(bytesToHex(expected))
  })

  it('seals in the nonce-first combined layout', () => {
    const key = randomBytes(32)
    const sealed = base64Decode(seal({ a: 1 }, key))

    const nonce = sealed.subarray(0, 12)
    const rest = sealed.subarray(12)
    const plaintext = chacha20poly1305(key, nonce).decrypt(rest)

    expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual({ a: 1 })
  })
})

describe('request encoding', () => {
  it('uses a url-safe alphabet with no padding', () => {
    // `data` rides in a query string, where + and / do not survive.
    const encoded = encodeRequest({ redirect: 'https://example.com/?a=1&b=2', n: 'ÿÿÿ' })
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('round-trips a response', () => {
    const value = { approved: true, data: 'x' }
    expect(decodeResponse(base64UrlEncode(new TextEncoder().encode(JSON.stringify(value))))).toEqual(
      value,
    )
  })

  it('decodes url-safe base64 with the padding stripped', () => {
    const bytes = new Uint8Array([251, 255, 190, 1, 2])
    expect(Array.from(base64Decode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes))
  })
})

describe('normalizeHex', () => {
  it('strips the prefix and lowercases', () => {
    expect(normalizeHex('0xAABB')).toBe('aabb')
    expect(normalizeHex('  AABB  ')).toBe('aabb')
  })
})
