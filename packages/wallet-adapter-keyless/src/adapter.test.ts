import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AccountAddress, Ed25519PublicKey, Serializer } from '@moveindustries/ts-sdk'
import { AccountInfo } from '@moveindustries/wallet-standard'
import { KeylessWalletAdapter } from './adapter'

// Single module-level mock for @moveindustries/keyless. vi.mock is hoisted.
// Per-test behavior is configured by mutating mockKeyless methods.
const mockKeyless = {
  beginLogin: vi.fn(),
  completeLogin: vi.fn(),
  completeLoginWithJwt: vi.fn(),
  hasSession: vi.fn(() => false),
  logout: vi.fn(),
}
vi.mock('@moveindustries/keyless', () => ({
  MovementKeyless: vi.fn(function MovementKeyless() { return mockKeyless }),
}))

const mockMovement = {
  transaction: { build: { simple: vi.fn() }, signAsFeePayer: vi.fn() },
  signAndSubmitTransaction: vi.fn(),
}
// Keep the REAL ts-sdk classes (AccountAddress, Ed25519PublicKey, AccountInfo's
// serialize deps) and stub only the network client. This is what lets the tests
// exercise the adapter's account output against the real type surface instead of
// asserting against strings the mocks invented.
vi.mock('@moveindustries/ts-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@moveindustries/ts-sdk')>()
  return {
    ...actual,
    Movement: vi.fn(function Movement() { return mockMovement }),
    MovementConfig: vi.fn(function MovementConfig() {}),
  }
})

const config = {
  proverUrl: '/api/prove',
  clientId: 'test-client-id',
  redirectUri: 'http://localhost:3000/callback',
  network: 'testnet' as const,
}

// A stand-in for the KeylessAccount the SDK returns, carrying REAL ts-sdk
// objects for the fields the adapter reads — so toAccountInfo() is tested
// against the same classes production uses.
const ADDR = '0x1234000000000000000000000000000000000000000000000000000000000abc'
const PUBKEY = '0x' + '11'.repeat(32)
const acctAddr = AccountAddress.fromString(ADDR)
function keylessAccount(extra: Record<string, unknown> = {}) {
  return {
    accountAddress: AccountAddress.fromString(ADDR),
    publicKey: new Ed25519PublicKey(PUBKEY),
    ...extra,
  }
}

const resetMocks = () => {
  Object.values(mockKeyless).forEach((fn) => fn.mockReset())
  mockKeyless.hasSession.mockReturnValue(false)
  mockMovement.transaction.build.simple.mockReset()
  mockMovement.transaction.signAsFeePayer.mockReset()
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

  it('initiate path: preserves the hash fragment in the saved return path', async () => {
    window.history.replaceState(null, '', '/claim?ref=x#sk=0xabc&n=1')

    const adapter = new KeylessWalletAdapter(config)
    void adapter.features['movement:connect']!.connect()
    await new Promise(r => setTimeout(r, 0))

    expect(sessionStorage.getItem('keyless_return_to')).toBe('/claim?ref=x#sk=0xabc&n=1')
  })

  it('completion path: with id_token in hash, completes login and resolves with AccountInfo', async () => {
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
    window.history.replaceState(null, '', '/callback#id_token=fakejwt')

    const adapter = new KeylessWalletAdapter(config)
    const res = await adapter.features['movement:connect']!.connect()

    expect((res as any).status).toBe('Approved')
    expect((res as any).args).toBeInstanceOf(AccountInfo)
    expect((res as any).args.address.toString()).toBe(acctAddr.toString())
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())

    const adapter = new KeylessWalletAdapter(config)
    const cb = vi.fn()
    await adapter.features['movement:onAccountChange']!.onAccountChange(cb)

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()
    const info = cb.mock.calls[0]![0]
    expect(info).toBeInstanceOf(AccountInfo)
    expect(info.address.toString()).toBe(acctAddr.toString())

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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount({
      sign: vi.fn().mockReturnValue(fakeSig),
    }))

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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount({
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(fakeAuth),
    }))

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const fakeTx = { rawTransaction: { _kind: 'raw' } } as any
    const res = await adapter.features['movement:signTransaction']!.signTransaction(fakeTx)
    expect((res as any).status).toBe('Approved')
    expect((res as any).args).toBe(fakeAuth)
  })

  it('signs as fee payer via client.transaction.signAsFeePayer when asFeePayer=true', async () => {
    const senderAuth = { _kind: 'sender' }
    const feePayerAuth = { _kind: 'feePayer' }
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount({
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(senderAuth),
    }))
    mockMovement.transaction.signAsFeePayer.mockReturnValue(feePayerAuth)

    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const tx = { rawTransaction: { _kind: 'raw' } } as any
    const r1 = await adapter.features['movement:signTransaction']!.signTransaction(tx, false)
    const r2 = await adapter.features['movement:signTransaction']!.signTransaction(tx, true)
    expect((r1 as any).args).toBe(senderAuth)
    expect((r2 as any).args).toBe(feePayerAuth)
    expect(mockMovement.transaction.signAsFeePayer).toHaveBeenCalledOnce()
  })

  it('v1.1: takes input object with payload, returns authenticator + rawTransaction', async () => {
    const fakeAuth = { _kind: 'authenticator' }
    const fakeRawTx = { _kind: 'rawTx' }
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount({
      signTransactionWithAuthenticator: vi.fn().mockReturnValue(fakeAuth),
    }))
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount({
      sign: vi.fn().mockReturnValue(fakeSig),
    }))

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
    expect(args.account).toBeInstanceOf(AccountInfo)
    expect(args.account.address.toString()).toBe(acctAddr.toString())
    expect(args.input.address).toBe(acctAddr.toString())
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
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
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())

    const adapter = new KeylessWalletAdapter(config)
    const changeCb = vi.fn()
    const off = (adapter.features as any)['standard:events']!.on('change', changeCb)
    expect(typeof off).toBe('function')

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()

    const { accounts } = changeCb.mock.calls[0]![0]
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toBeInstanceOf(AccountInfo)
    expect(accounts[0].address.toString()).toBe(acctAddr.toString())
  })

  it("fires 'change' with empty accounts on disconnect", async () => {
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
    window.history.replaceState(null, '', '/callback#id_token=x')

    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const changeCb = vi.fn()
    ;(adapter.features as any)['standard:events']!.on('change', changeCb)

    await adapter.features['movement:disconnect']!.disconnect()
    expect(changeCb).toHaveBeenCalledWith(expect.objectContaining({ accounts: [] }))
  })

  it('returned unsubscribe function removes the listener', async () => {
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())

    const adapter = new KeylessWalletAdapter(config)
    const changeCb = vi.fn()
    const off = (adapter.features as any)['standard:events']!.on('change', changeCb)
    off()  // unsubscribe before any change

    window.history.replaceState(null, '', '/callback#id_token=x')
    await adapter.features['movement:connect']!.connect()
    expect(changeCb).not.toHaveBeenCalled()
  })
})

// Guards the account output against the real @moveindustries/ts-sdk /
// @moveindustries/wallet-standard type surface — the check the fully-mocked
// suite couldn't make, which is how a string-valued AccountInfo shipped.
describe('KeylessWalletAdapter — real SDK account shape', () => {
  beforeEach(() => {
    resetMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('exposes a real AccountInfo with object address/publicKey that serializes', async () => {
    mockKeyless.completeLogin.mockResolvedValue(keylessAccount())
    window.history.replaceState(null, '', '/callback#id_token=x')
    const adapter = new KeylessWalletAdapter(config)
    await adapter.features['movement:connect']!.connect()

    const info = adapter.accounts[0]!
    expect(info).toBeInstanceOf(AccountInfo)
    expect(info.address).toBeInstanceOf(AccountAddress)
    expect(info.publicKey).toBeInstanceOf(Ed25519PublicKey)
    // The crash primata flagged: a string publicKey has no verifySignature and
    // AccountInfo.serialize() throws on it. Real objects survive both.
    expect(typeof (info.publicKey as unknown as { verifySignature: unknown }).verifySignature).toBe('function')
    expect(() => {
      const s = new Serializer()
      info.serialize(s)
      return s.toUint8Array()
    }).not.toThrow()
  })
})
