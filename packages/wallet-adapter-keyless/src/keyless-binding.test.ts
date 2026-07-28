import { describe, expect, it, vi, afterEach } from 'vitest'
import { MovementKeyless } from '@moveindustries/keyless'

// This file deliberately does NOT mock @moveindustries/keyless. It exercises the
// real SDK's JWT/ephemeral-key binding, which is the check the adapter delegates
// to rather than implementing itself. `buildOAuthUrl` generates a genuine
// ephemeral key without navigating or touching sessionStorage, and
// `completeLoginWithJwt` verifies claims before any prover round-trip — so these
// run offline with no mocks.

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
const PROVER_URL = 'https://prover.example/prove'

function keyless() {
  return new MovementKeyless({
    proverUrl: PROVER_URL,
    clientId: CLIENT_ID,
    redirectUri: 'http://localhost:3000/callback',
  })
}

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** An unsigned JWT — the SDK's local claim check only base64-decodes the payload. */
function jwt(payload: Record<string, unknown>): string {
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.sig`
}

const futureExp = () => Math.floor(Date.now() / 1000) + 3600

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('@moveindustries/keyless — nonce ↔ ephemeral-key binding', () => {
  it('embeds the ephemeral key nonce in the OAuth request', () => {
    const { url, ephemeralKey } = keyless().buildOAuthUrl()

    const params = new URL(url).searchParams
    expect(params.get('nonce')).toBe(ephemeralKey.nonce)
    expect(params.get('client_id')).toBe(CLIENT_ID)
    expect(ephemeralKey.nonce).toMatch(/^\d+$/)
  })

  it('rejects a JWT whose nonce does not match the ephemeral key', async () => {
    const k = keyless()
    const { ephemeralKey } = k.buildOAuthUrl()

    const swapped = jwt({
      nonce: '99999999999999999999',
      aud: CLIENT_ID,
      sub: 'user-123',
      exp: futureExp(),
    })

    await expect(k.completeLoginWithJwt(swapped, ephemeralKey)).rejects.toThrow(
      /nonce does not match/i,
    )
  })

  it('rejects a JWT issued for a different OAuth client', async () => {
    const k = keyless()
    const { ephemeralKey } = k.buildOAuthUrl()

    const wrongAud = jwt({
      nonce: ephemeralKey.nonce,
      aud: 'attacker-client-id.apps.googleusercontent.com',
      sub: 'user-123',
      exp: futureExp(),
    })

    await expect(k.completeLoginWithJwt(wrongAud, ephemeralKey)).rejects.toThrow(/aud/i)
  })

  it('rejects an expired JWT', async () => {
    const k = keyless()
    const { ephemeralKey } = k.buildOAuthUrl()

    const expired = jwt({
      nonce: ephemeralKey.nonce,
      aud: CLIENT_ID,
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) - 60,
    })

    await expect(k.completeLoginWithJwt(expired, ephemeralKey)).rejects.toThrow(/expired/i)
  })

  it('a well-formed JWT passes the local claim checks and reaches the prover', async () => {
    // Positive control: proves the rejections above come from the claim check
    // and not from something failing earlier for an unrelated reason.
    const k = keyless()
    const { ephemeralKey } = k.buildOAuthUrl()

    const fetchMock = vi.fn(async (url: unknown, _init?: unknown) => {
      throw new Error(`network disabled in tests (${String(url)})`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const good = jwt({
      nonce: ephemeralKey.nonce,
      aud: CLIENT_ID,
      sub: 'user-123',
      exp: futureExp(),
    })

    await expect(k.completeLoginWithJwt(good, ephemeralKey)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalled()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('prover.example')
  })
})
