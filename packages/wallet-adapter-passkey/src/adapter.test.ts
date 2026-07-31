import { describe, it, expect, beforeEach } from 'vitest'
import { p256 } from '@noble/curves/nist.js'
import { hexToBytes } from '@noble/hashes/utils.js'
import { PasskeyWalletAdapter } from './adapter'
import { saveCredential, loadCredential, deriveAddress } from './core'

const PRIV = hexToBytes('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff')
const PUB = p256.getPublicKey(PRIV, false)

function seedCachedCredential() {
  saveCredential({ credentialId: 'test-cred', publicKey: PUB, address: deriveAddress(PUB) })
}

// jsdom has no navigator.credentials, so any test that connects successfully
// below also proves the cached path never starts a WebAuthn ceremony.
describe('PasskeyWalletAdapter disconnect/reconnect', () => {
  beforeEach(() => localStorage.clear())

  function makeAdapter() {
    return new PasskeyWalletAdapter({ network: 'testnet', mode: 'signin' })
  }

  async function connect(adapter: PasskeyWalletAdapter) {
    return (adapter.features as any)['movement:connect'].connect()
  }

  it('connects from the cached credential without a WebAuthn ceremony', async () => {
    seedCachedCredential()
    const adapter = makeAdapter()
    const res = await connect(adapter)
    expect(res.status).toBe('Approved')
    expect(adapter.accounts.length).toBe(1)
  })

  it('keeps the cached credential across disconnect so reconnect is prompt-free', async () => {
    seedCachedCredential()
    const adapter = makeAdapter()
    await connect(adapter)

    await (adapter.features as any)['movement:disconnect'].disconnect()
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).not.toBeNull()

    const res = await connect(adapter)
    expect(res.status).toBe('Approved')
    expect(adapter.accounts.length).toBe(1)
  })

  it('forgetCredential drops the cache and disconnects', async () => {
    seedCachedCredential()
    const adapter = makeAdapter()
    await connect(adapter)

    adapter.forgetCredential()
    expect(adapter.accounts.length).toBe(0)
    expect(loadCredential()).toBeNull()
  })
})
