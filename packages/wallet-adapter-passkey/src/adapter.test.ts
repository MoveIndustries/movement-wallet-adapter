import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { p256 } from '@noble/curves/nist.js'
import { hexToBytes } from '@noble/hashes/utils.js'
import { PasskeyWalletAdapter } from './adapter'
import {
  saveCredential,
  loadCredential,
  deriveAddress,
  computeWebAuthnSignedHash,
} from './core'
import type { PasskeyAdapterConfig } from './types'

const PRIV = hexToBytes('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff')
const PUB = p256.getPublicKey(PRIV, false)
const CRED_ID = btoa('test-cred')

function seedCachedCredential() {
  saveCredential({ credentialId: CRED_ID, publicKey: PUB, address: deriveAddress(PUB) })
}

// Build an assertion that satisfies the reauthentication checks: correct
// credential id, UV flag set, and a signature that verifies against PUB.
function validAssertion(opts: { uv?: boolean; rawId?: ArrayBuffer } = {}) {
  const authData = new Uint8Array(37)
  authData[32] = opts.uv === false ? 0x01 : 0x05 // UP always, UV unless disabled
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get' }))
  const hash = computeWebAuthnSignedHash(authData, clientDataJSON)
  const der = p256.sign(hash, PRIV, { prehash: false, format: 'der' })
  return {
    rawId: opts.rawId ?? new TextEncoder().encode('test-cred').buffer,
    response: {
      authenticatorData: authData.buffer,
      clientDataJSON: clientDataJSON.buffer,
      signature: der.buffer ?? der,
    },
  }
}

// jsdom has no navigator.credentials; the cached connect path performs one
// reauthentication get(), so tests stub exactly that.
function mockCredentialsGet(
  impl: () => Promise<unknown> = () => Promise.resolve(validAssertion()),
): Mock {
  const get = vi.fn(impl)
  Object.defineProperty(navigator, 'credentials', {
    value: { get },
    configurable: true,
  })
  return get
}

describe('PasskeyWalletAdapter disconnect/reconnect', () => {
  beforeEach(() => {
    localStorage.clear()
    // The active credential is module state shared by every instance (one page
    // in production), so reset it between tests.
    new PasskeyWalletAdapter({ network: 'testnet', mode: 'signin' }).forgetCredential()
  })

  function makeAdapter(extra: Partial<PasskeyAdapterConfig> = {}) {
    return new PasskeyWalletAdapter({ network: 'testnet', mode: 'signin', ...extra })
  }

  async function connect(adapter: PasskeyWalletAdapter) {
    return (adapter.features as any)['movement:connect'].connect()
  }

  it('connects from the cached credential with a single re-auth prompt, no recovery', async () => {
    seedCachedCredential()
    const get = mockCredentialsGet()
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    const res = await connect(adapter)
    expect(res.status).toBe('Approved')
    expect(adapter.accounts.length).toBe(1)
    expect(get).toHaveBeenCalledTimes(1)
    // Bound to the cached credential id — direct authentication, not a picker.
    const request = get.mock.calls[0]![0] as {
      publicKey: { allowCredentials?: { id: ArrayBuffer }[]; userVerification?: string }
    }
    const allowed = request.publicKey.allowCredentials
    expect(allowed?.length).toBe(1)
    expect(new TextDecoder().decode(allowed![0]!.id)).toBe('test-cred')
    expect(request.publicKey.userVerification).toBe('required')
  })

  it('keeps the cached credential across disconnect; each reconnect re-auths once', async () => {
    seedCachedCredential()
    const get = mockCredentialsGet()
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    await connect(adapter)

    await (adapter.features as any)['movement:disconnect'].disconnect()
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).not.toBeNull()

    const res = await connect(adapter)
    expect(res.status).toBe('Approved')
    expect(adapter.accounts.length).toBe(1)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('fails connect when re-auth is cancelled, keeping the cache for retry', async () => {
    seedCachedCredential()
    mockCredentialsGet(() => Promise.reject(new Error('NotAllowedError')))
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    await expect(connect(adapter)).rejects.toThrow(/forgetCredential/)
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).not.toBeNull()
  })

  it('does not prompt on cached connect by default (autoConnect stays silent)', async () => {
    seedCachedCredential()
    const get = mockCredentialsGet()
    const adapter = makeAdapter()
    const res = await connect(adapter)
    expect(res.status).toBe('Approved')
    expect(adapter.accounts.length).toBe(1)
    expect(get).not.toHaveBeenCalled()
  })

  it('rejects a reauthentication that did not verify the user', async () => {
    seedCachedCredential()
    mockCredentialsGet(() => Promise.resolve(validAssertion({ uv: false })))
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    await expect(connect(adapter)).rejects.toThrow(/forgetCredential/)
  })

  it('rejects a reauthentication bound to a different credential', async () => {
    seedCachedCredential()
    const other = new TextEncoder().encode('other-cred').buffer
    mockCredentialsGet(() => Promise.resolve(validAssertion({ rawId: other })))
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    await expect(connect(adapter)).rejects.toThrow(/forgetCredential/)
  })

  it('surfaces a non-NotAllowedError DOMException name and keeps the cause', async () => {
    seedCachedCredential()
    const domErr = new DOMException('bad rpId', 'SecurityError')
    mockCredentialsGet(() => Promise.reject(domErr))
    const adapter = makeAdapter({ reauthenticateOnConnect: true })
    await expect(connect(adapter)).rejects.toThrow(/SecurityError/)
    await expect(connect(adapter)).rejects.toHaveProperty('cause', domErr)
  })

  it('forgetCredential on one registered instance clears the other', async () => {
    seedCachedCredential()
    mockCredentialsGet()
    const create = makeAdapter({ mode: 'create' })
    const signin = makeAdapter({ mode: 'signin' })
    await connect(signin)
    expect(signin.accounts.length).toBe(1)
    expect(create.accounts.length).toBe(1)

    create.forgetCredential()
    expect(create.accounts.length).toBe(0)
    expect(signin.accounts.length).toBe(0)
    expect(loadCredential()).toBeNull()
  })

  it('forgetCredential drops the cache and disconnects', async () => {
    seedCachedCredential()
    mockCredentialsGet()
    const adapter = makeAdapter()
    await connect(adapter)

    adapter.forgetCredential()
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).toBeNull()
  })
})
