import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { p256 } from '@noble/curves/nist.js'
import { hexToBytes } from '@noble/hashes/utils.js'
import { PasskeyWalletAdapter } from './adapter'
import { saveCredential, loadCredential, deriveAddress } from './core'

const PRIV = hexToBytes('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff')
const PUB = p256.getPublicKey(PRIV, false)
const CRED_ID = btoa('test-cred')

function seedCachedCredential() {
  saveCredential({ credentialId: CRED_ID, publicKey: PUB, address: deriveAddress(PUB) })
}

// jsdom has no navigator.credentials; the cached connect path performs one
// reauthentication get(), so tests stub exactly that.
function mockCredentialsGet(
  impl: () => Promise<unknown> = () => Promise.resolve({ rawId: new ArrayBuffer(8) }),
): Mock {
  const get = vi.fn(impl)
  Object.defineProperty(navigator, 'credentials', {
    value: { get },
    configurable: true,
  })
  return get
}

describe('PasskeyWalletAdapter disconnect/reconnect', () => {
  beforeEach(() => localStorage.clear())

  function makeAdapter() {
    return new PasskeyWalletAdapter({ network: 'testnet', mode: 'signin' })
  }

  async function connect(adapter: PasskeyWalletAdapter) {
    return (adapter.features as any)['movement:connect'].connect()
  }

  it('connects from the cached credential with a single re-auth prompt, no recovery', async () => {
    seedCachedCredential()
    const get = mockCredentialsGet()
    const adapter = makeAdapter()
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
    const adapter = makeAdapter()
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
    const adapter = makeAdapter()
    await expect(connect(adapter)).rejects.toThrow(/forgetCredential/)
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).not.toBeNull()
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
