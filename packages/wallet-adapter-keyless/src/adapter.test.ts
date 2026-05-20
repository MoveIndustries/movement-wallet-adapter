import { describe, expect, it, vi, beforeEach } from 'vitest'
import { KeylessWalletAdapter } from './adapter'

// Single module-level mock for @eigerco/movement-keyless. vi.mock is hoisted.
// Per-test behavior is configured by mutating mockKeyless methods.
const mockKeyless = {
  beginLogin: vi.fn(),
  completeLogin: vi.fn(),
  completeLoginWithJwt: vi.fn(),
  hasSession: vi.fn(() => false),
  logout: vi.fn(),
}
vi.mock('@eigerco/movement-keyless', () => ({
  MovementKeyless: vi.fn(function MovementKeyless() { return mockKeyless }),
}))

const mockMovement = {
  transaction: { build: { simple: vi.fn() } },
  signAndSubmitTransaction: vi.fn(),
}
vi.mock('@moveindustries/ts-sdk', () => ({
  Movement: vi.fn(function Movement() { return mockMovement }),
  MovementConfig: vi.fn(function MovementConfig() {}),
  Network: { CUSTOM: 'CUSTOM' },
}))

const config = {
  proverUrl: '/api/prove',
  clientId: 'test-client-id',
  redirectUri: 'http://localhost:3000/callback',
  network: 'testnet' as const,
}

const resetMocks = () => {
  Object.values(mockKeyless).forEach((fn) => fn.mockReset())
  mockKeyless.hasSession.mockReturnValue(false)
  mockMovement.transaction.build.simple.mockReset()
  mockMovement.signAndSubmitTransaction.mockReset()
}

describe('KeylessWalletAdapter — metadata', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('exposes wallet-standard metadata', () => {
    const adapter = new KeylessWalletAdapter(config)
    expect(adapter.id).toBe('movement-keyless')
    expect(adapter.name).toBe('Sign in with Google')
    expect(adapter.icon.startsWith('data:image/svg+xml')).toBe(true)
    expect(adapter.version).toBe('1.0.0')
    expect(adapter.chains).toEqual(['movement:testnet'])
    expect(adapter.accounts).toEqual([])
  })

  it('movement:network always returns testnet', async () => {
    const adapter = new KeylessWalletAdapter(config)
    const result = await adapter.features['movement:network']!.network()
    expect(result.name).toBe('testnet')
    expect(result.chainId).toBe(177)
    expect(result.url).toBe('https://testnet.movementnetwork.xyz/v1')
  })

  it('movement:account throws when not connected', async () => {
    const adapter = new KeylessWalletAdapter(config)
    await expect(adapter.features['movement:account']!.account()).rejects.toThrow(/not connected/i)
  })
})

describe('KeylessWalletAdapter — connect', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('initiate path: with no id_token in hash, calls beginLogin', async () => {
    const adapter = new KeylessWalletAdapter(config)
    void adapter.features['movement:connect']!.connect()
    await new Promise(r => setTimeout(r, 0))
    expect(mockKeyless.beginLogin).toHaveBeenCalledOnce()
  })

  it('completion path: with id_token in hash, completes login and resolves with AccountInfo', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })
    window.history.replaceState(null, '', '/callback#id_token=fakejwt')

    const adapter = new KeylessWalletAdapter(config)
    const res = await adapter.features['movement:connect']!.connect()

    expect((res as any).status).toBe('Approved')
    expect((res as any).args.address).toBe('0xabc')
    expect(adapter.accounts.length).toBe(1)
    expect(mockKeyless.completeLogin).toHaveBeenCalledOnce()
  })
})

describe('KeylessWalletAdapter — disconnect', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('clears the in-memory account', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })
    window.history.replaceState(null, '', '/callback#id_token=x')

    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()
    expect(adapter.accounts.length).toBe(1)

    await adapter.features['movement:disconnect']!.disconnect()
    expect(adapter.accounts.length).toBe(0)
    expect(mockKeyless.logout).toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — events', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('onAccountChange fires on connect and disconnect', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })

    const adapter = new KeylessWalletAdapter(config)
    const cb = vi.fn()
    await adapter.features['movement:onAccountChange']!.onAccountChange(cb)

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ address: '0xabc' }))

    await adapter.features['movement:disconnect']!.disconnect()
    expect(cb).toHaveBeenLastCalledWith(undefined)
  })

  it('onNetworkChange registers without firing (testnet only)', async () => {
    const adapter = new KeylessWalletAdapter(config)
    const cb = vi.fn()
    await adapter.features['movement:onNetworkChange']!.onNetworkChange(cb)
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — signMessage', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('signs a message and returns the wallet-standard output shape', async () => {
    const fakeSig = { toUint8Array: () => new Uint8Array([0xde, 0xad, 0xbe, 0xef]) }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      sign: vi.fn().mockReturnValue(fakeSig),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const res = await adapter.features['movement:signMessage']!.signMessage({
      message: 'hello',
      nonce: 'abc123',
    })

    expect((res as any).status).toBe('Approved')
    expect((res as any).args.message).toBe('hello')
    expect((res as any).args.nonce).toBe('abc123')
    expect((res as any).args.prefix).toBe('MOVEMENT')
    expect((res as any).args.fullMessage).toContain('hello')
    expect((res as any).args.fullMessage).toContain('abc123')
  })

  it('rejects with not-connected when no account', async () => {
    const adapter = new KeylessWalletAdapter(config)
    await expect(adapter.features['movement:signMessage']!.signMessage({
      message: 'x', nonce: 'y',
    })).rejects.toThrow(/not connected/i)
  })
})

describe('KeylessWalletAdapter — signTransaction', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('signs a transaction and returns an authenticator', async () => {
    const fakeAuth = { _kind: 'authenticator' }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(fakeAuth),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const fakeTx = { rawTransaction: { _kind: 'raw' } } as any
    const res = await adapter.features['movement:signTransaction']!.signTransaction(fakeTx)
    expect((res as any).status).toBe('Approved')
    expect((res as any).args).toBe(fakeAuth)
  })

  it('signs as fee payer when asFeePayer=true', async () => {
    const senderAuth = { _kind: 'sender' }
    const feePayerAuth = { _kind: 'feePayer' }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(senderAuth),
      signWithFeePayerAuthenticator: vi.fn().mockReturnValue(feePayerAuth),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const tx = { rawTransaction: { _kind: 'raw' } } as any
    const r1 = await adapter.features['movement:signTransaction']!.signTransaction(tx, false)
    const r2 = await adapter.features['movement:signTransaction']!.signTransaction(tx, true)
    expect((r1 as any).args).toBe(senderAuth)
    expect((r2 as any).args).toBe(feePayerAuth)
  })

  it('v1.1: takes input object with payload, returns authenticator + rawTransaction', async () => {
    const fakeAuth = { _kind: 'authenticator' }
    const fakeRawTx = { _kind: 'rawTx' }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(fakeAuth),
      signWithFeePayerAuthenticator: vi.fn(),
    })
    mockMovement.transaction.build.simple.mockResolvedValue(fakeRawTx)

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const res = await (adapter.features['movement:signTransaction']!.signTransaction as any)({
      payload: {
        function: '0x1::aptos_account::transfer',
        typeArguments: [],
        functionArguments: ['0xrec', '100'],
      },
      gasUnitPrice: 100,
      maxGasAmount: 1000,
    })

    expect((res as any).status).toBe('Approved')
    expect((res as any).args.authenticator).toBe(fakeAuth)
    expect((res as any).args.rawTransaction).toBe(fakeRawTx)
    expect(mockMovement.transaction.build.simple).toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — signIn', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('builds the SIWM message and signs it', async () => {
    const fakeSig = { toUint8Array: () => new Uint8Array([1, 2, 3]) }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      sign: vi.fn().mockReturnValue(fakeSig),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const res = await adapter.features['movement:signIn']!.signIn({
      domain: 'example.com',
      nonce: 'random123',
      statement: 'Sign in to Example.',
    })

    expect((res as any).status).toBe('Approved')
    const args = (res as any).args
    expect(args.account.address).toBe('0xabc')
    expect(args.input.address).toBe('0xabc')
    expect(args.input.chainId).toBe('movement:testnet')
    expect(args.input.version).toBe('1')
    expect(args.type).toBe('ed25519')
  })

  it('rejects when not connected', async () => {
    const adapter = new KeylessWalletAdapter(config)
    await expect(adapter.features['movement:signIn']!.signIn({
      domain: 'example.com', nonce: 'x',
    })).rejects.toThrow(/not connected/i)
  })
})

describe('KeylessWalletAdapter — signAndSubmitTransaction', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('builds, signs, submits, and returns hash', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })
    mockMovement.transaction.build.simple.mockResolvedValue({ _kind: 'rawTx' })
    mockMovement.signAndSubmitTransaction.mockResolvedValue({ hash: '0xdeadbeef' })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const payload = {
      function: '0x1::aptos_account::transfer' as const,
      typeArguments: [],
      functionArguments: ['0xrec', '100'],
    }
    const res = await adapter.features['movement:signAndSubmitTransaction']!.signAndSubmitTransaction({
      payload: payload as any,
    })

    expect((res as any).status).toBe('Approved')
    expect((res as any).args.hash).toBe('0xdeadbeef')
    expect(mockMovement.transaction.build.simple).toHaveBeenCalled()
    expect(mockMovement.signAndSubmitTransaction).toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — changeNetwork', () => {
  beforeEach(() => { resetMocks() })

  it('always rejects', async () => {
    const adapter = new KeylessWalletAdapter(config)
    const res = await adapter.features['movement:changeNetwork']!.changeNetwork({
      name: 'mainnet', chainId: 126, url: '',
    } as any)
    expect((res as any).status).toBe('Rejected')
  })
})

describe('KeylessWalletAdapter — setConfig', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('updates the prover URL when not connected', () => {
    const adapter = new KeylessWalletAdapter(config)
    adapter.setConfig({ proverUrl: '/api/different-prover' })
    expect(adapter.accounts.length).toBe(0)
  })

  it('auto-disconnects when changing prover URL while connected', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })
    window.history.replaceState(null, '', '/callback#id_token=x')

    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()
    expect(adapter.accounts.length).toBe(1)

    const cb = vi.fn()
    await adapter.features['movement:onAccountChange']!.onAccountChange(cb)

    adapter.setConfig({ proverUrl: '/api/different-prover' })
    expect(adapter.accounts.length).toBe(0)
    expect(cb).toHaveBeenCalledWith(undefined)
    expect(mockKeyless.logout).toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — standard:events', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it("fires 'change' with new accounts on connect — required for wallet-adapter-react to notice", async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })

    const adapter = new KeylessWalletAdapter(config)
    const changeCb = vi.fn()
    const off = (adapter.features as any)['standard:events']!.on('change', changeCb)
    expect(typeof off).toBe('function')

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()

    expect(changeCb).toHaveBeenCalledWith(expect.objectContaining({
      accounts: expect.arrayContaining([expect.objectContaining({ address: '0xabc' })]),
    }))
  })

  it("fires 'change' with empty accounts on disconnect", async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })
    window.history.replaceState(null, '', '/callback#id_token=x')

    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const changeCb = vi.fn()
    ;(adapter.features as any)['standard:events']!.on('change', changeCb)

    await adapter.features['movement:disconnect']!.disconnect()
    expect(changeCb).toHaveBeenCalledWith(expect.objectContaining({ accounts: [] }))
  })

  it('returned unsubscribe function removes the listener', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })

    const adapter = new KeylessWalletAdapter(config)
    const changeCb = vi.fn()
    const off = (adapter.features as any)['standard:events']!.on('change', changeCb)
    off()  // unsubscribe before any change

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()
    expect(changeCb).not.toHaveBeenCalled()
  })
})

describe('KeylessWalletAdapter — aptos:* mirror', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('chains array advertises movement only (option A — honest chain advertisement)', () => {
    const adapter = new KeylessWalletAdapter(config)
    expect(adapter.chains).toEqual(['movement:testnet'])
    expect(adapter.chains).not.toContain('aptos:testnet')
  })

  it('aptos:network returns Movement testnet info (chainId 177)', async () => {
    const adapter = new KeylessWalletAdapter(config)
    const result = await (adapter.features as any)['aptos:network']!.network()
    expect(result.chainId).toBe(177)
    expect(result.url).toContain('movementnetwork')
  })

  it('aptos:account throws when not connected', async () => {
    const adapter = new KeylessWalletAdapter(config)
    await expect((adapter.features as any)['aptos:account']!.account()).rejects.toThrow(/not connected/i)
  })

  it('aptos:signMessage uses APTOS prefix', async () => {
    const fakeSig = { toUint8Array: () => new Uint8Array([1, 2, 3]) }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      sign: vi.fn().mockReturnValue(fakeSig),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await (adapter.features as any)['aptos:connect']!.connect()

    const res = await (adapter.features as any)['aptos:signMessage']!.signMessage({
      message: 'hi',
      nonce: 'n1',
    })
    expect((res as any).args.prefix).toBe('APTOS')
    expect((res as any).args.fullMessage.startsWith('APTOS\n')).toBe(true)
  })

  it('aptos:signIn message says "Aptos" not "Movement"', async () => {
    const fakeSig = { toUint8Array: () => new Uint8Array([1, 2, 3]) }
    let signedBytes: Uint8Array | null = null
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      sign: vi.fn((bytes: Uint8Array) => { signedBytes = bytes; return fakeSig }),
    })

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await (adapter.features as any)['aptos:connect']!.connect()

    await (adapter.features as any)['aptos:signIn']!.signIn({
      domain: 'example.com',
      nonce: 'random123',
    })

    const message = new TextDecoder().decode(signedBytes!)
    expect(message).toContain('your Aptos account')
    expect(message).not.toContain('your Movement account')
  })

  it('aptos:onAccountChange fires on connect/disconnect (independent of movement listeners)', async () => {
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
    })

    const adapter = new KeylessWalletAdapter(config)
    const movementCb = vi.fn()
    const aptosCb = vi.fn()
    await adapter.features['movement:onAccountChange']!.onAccountChange(movementCb)
    await (adapter.features as any)['aptos:onAccountChange']!.onAccountChange(aptosCb)

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()

    expect(movementCb).toHaveBeenCalledWith(expect.objectContaining({ address: '0xabc' }))
    expect(aptosCb).toHaveBeenCalledWith(expect.objectContaining({ address: '0xabc' }))
  })

  it('aptos:changeNetwork rejects', async () => {
    const adapter = new KeylessWalletAdapter(config)
    const res = await (adapter.features as any)['aptos:changeNetwork']!.changeNetwork({
      name: 'mainnet', chainId: 1, url: '',
    })
    expect((res as any).status).toBe('Rejected')
  })

  it('aptos:signTransaction v1.1 builds + signs', async () => {
    const fakeAuth = { _kind: 'auth' }
    const fakeRawTx = { _kind: 'raw' }
    mockKeyless.completeLogin.mockResolvedValue({
      accountAddress: { toString: () => '0xabc' },
      publicKey: { toString: () => '0xpub' },
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(fakeAuth),
      signWithFeePayerAuthenticator: vi.fn(),
    })
    mockMovement.transaction.build.simple.mockResolvedValue(fakeRawTx)

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await (adapter.features as any)['aptos:connect']!.connect()

    const res = await (adapter.features as any)['aptos:signTransaction']!.signTransaction({
      payload: { function: '0x1::aptos_account::transfer', typeArguments: [], functionArguments: ['0xrec', '100'] },
    })
    expect((res as any).args.authenticator).toBe(fakeAuth)
    expect((res as any).args.rawTransaction).toBe(fakeRawTx)
  })
})
