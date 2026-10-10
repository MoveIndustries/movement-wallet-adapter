import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bytesToHex } from '@noble/hashes/utils.js'
import { AccountAddress, Bool, MoveString, MoveVector, U64 } from '@moveindustries/ts-sdk'
import { UserResponseStatus } from '@moveindustries/wallet-standard'
import { DeeplinkWalletAdapter } from './adapter.js'
import {
  encodeRequest,
  generateKeyPair,
  open,
  seal,
  sharedKey,
  type ConnectData,
  type KeyPair,
} from './protocol.js'
import {
  loadSession,
  savePending,
  saveSession,
  REQUEST_ID_PARAM,
  RESPONSE_PARAM,
  type StoredSession,
} from './session.js'
import type { DeeplinkWallet } from './wallets.js'

const WALLET: DeeplinkWallet = {
  id: 'movement-mobile-deeplink',
  name: 'Motion Wallet',
  icon: 'data:image/svg+xml;base64,',
  url: 'https://motion.example',
  baseUrl: 'https://motion.example/dapp/v1/',
  transport: 'motion',
}

// A readable stored account: 32 bytes of hex parses as a bare Ed25519 key.
const ACCOUNT: ConnectData = {
  address: '0x' + '11'.repeat(32),
  publicKey: 'aa'.repeat(32),
  network: 'testnet',
}

function setUrl(url: string): void {
  window.history.replaceState({}, '', url)
}

/** A connected session with keys this test controls on both ends. */
function connectedSession(dapp: KeyPair, wallet: KeyPair): StoredSession {
  const session: StoredSession = {
    walletId: WALLET.id,
    secretKeyHex: bytesToHex(dapp.secretKey),
    publicKeyHex: dapp.publicKeyHex,
    walletPublicKeyHex: wallet.publicKeyHex,
    account: ACCOUNT,
  }
  saveSession(session)
  return session
}

/** Replaces the adapter's navigation with a capture, since jsdom cannot leave the page. */
function captureNavigate(adapter: DeeplinkWalletAdapter): { method?: string; payload?: any } {
  const captured: { method?: string; payload?: any } = {}
  ;(adapter as any).navigate = vi.fn(async (method: string, payload: unknown) => {
    captured.method = method
    captured.payload = payload
    return { navigated: true }
  })
  return captured
}

describe('connect', () => {
  let dapp: KeyPair
  let wallet: KeyPair

  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
    dapp = generateKeyPair()
    wallet = generateKeyPair()
  })

  it('serves a live session from the fast path', async () => {
    connectedSession(dapp, wallet)
    const adapter = new DeeplinkWalletAdapter(WALLET)
    const captured = captureNavigate(adapter)

    const response = await (adapter.features['movement:connect'] as any).connect()

    expect(response.status).toBe(UserResponseStatus.APPROVED)
    expect(response.args?.address.toString()).toBe(ACCOUNT.address)
    expect(captured.method).toBeUndefined()
  })

  it('falls through to a real connect when the stored account is unreadable', async () => {
    // The broken-state trap: APPROVED with a null account left core connected
    // with nothing to sign as, and retrying connect re-served the same null.
    const session = connectedSession(dapp, wallet)
    saveSession({ ...session, account: { ...ACCOUNT, publicKey: 'zz-not-hex' } })
    const adapter = new DeeplinkWalletAdapter(WALLET)
    const captured = captureNavigate(adapter)

    await (adapter.features['movement:connect'] as any).connect()

    expect(captured.method).toBe('connect')
    const stored = loadSession(WALLET.id)
    // The broken account is shed; the keypair and channel key survive so the
    // wallet can serve the reconnect silently via the proof.
    expect(stored?.account).toBeUndefined()
    expect(stored?.secretKeyHex).toBe(session.secretKeyHex)
    expect(stored?.previousWalletPublicKeyHex).toBe(wallet.publicKeyHex)
  })
})

describe('inputs the wire cannot carry are refused in the page', () => {
  let dapp: KeyPair
  let wallet: KeyPair
  let adapter: DeeplinkWalletAdapter

  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
    dapp = generateKeyPair()
    wallet = generateKeyPair()
    connectedSession(dapp, wallet)
    adapter = new DeeplinkWalletAdapter(WALLET)
  })

  it('refuses signMessage binding flags instead of dropping them', async () => {
    captureNavigate(adapter)
    const feature = adapter.features['movement:signMessage'] as any
    await expect(
      feature.signMessage({ message: 'm', nonce: 'n', address: true }),
    ).rejects.toThrow(/binding flags/i)
    await expect(
      feature.signMessage({ message: 'm', nonce: 'n', chainId: true }),
    ).rejects.toThrow(/binding flags/i)
  })

  it('still signs a message with no bindings requested', async () => {
    const captured = captureNavigate(adapter)
    const feature = adapter.features['movement:signMessage'] as any
    await feature.signMessage({ message: 'm', nonce: 'n', address: false })
    expect(captured.method).toBe('sign_message')
  })

  it('refuses custom gas settings instead of silently dropping them', async () => {
    captureNavigate(adapter)
    const feature = adapter.features['movement:signAndSubmitTransaction'] as any
    await expect(
      feature.signAndSubmitTransaction({
        payload: { function: '0x1::coin::transfer' },
        maxGasAmount: 5000,
      }),
    ).rejects.toThrow(/gas/i)
  })
})

describe('transaction arguments', () => {
  let dapp: KeyPair
  let wallet: KeyPair

  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
    dapp = generateKeyPair()
    wallet = generateKeyPair()
    connectedSession(dapp, wallet)
  })

  async function sealedArguments(functionArguments: unknown[]): Promise<unknown[]> {
    const adapter = new DeeplinkWalletAdapter(WALLET)
    const captured = captureNavigate(adapter)
    await (adapter.features['movement:signAndSubmitTransaction'] as any).signAndSubmitTransaction({
      payload: { function: '0x1::coin::transfer', functionArguments },
    })
    // The wallet's side of the channel can open what the page sealed.
    const key = sharedKey(wallet.secretKey, dapp.publicKeyHex)
    const opened = open<{ arguments: unknown[] }>(captured.payload.payload, key)
    return opened.arguments
  }

  it('unwraps SDK argument classes the way extension adapters accept them', async () => {
    const address = AccountAddress.fromString('0x' + '22'.repeat(32))
    const args = await sealedArguments([
      address,
      new U64(123n),
      new Bool(true),
      new MoveString('hello'),
      MoveVector.U64([1n, 2n]),
    ])
    expect(args[0]).toBe(address.toString())
    expect(args[1]).toBe('123')
    expect(args[2]).toBe(true)
    expect(args[3]).toBe('hello')
    expect(args[4]).toEqual(['1', '2'])
  })

  it('keeps stringifying plain values, byte buffers and nested vectors', async () => {
    const args = await sealedArguments(['s', 7, 9n, false, [1, [2n]], new Uint8Array([3, 4])])
    expect(args).toEqual(['s', '7', '9', false, ['1', ['2']], ['3', '4']])
  })

  it('still refuses arguments nothing can express', async () => {
    await expect(sealedArguments([{ some: 'object' }])).rejects.toThrow(/Unsupported/)
  })
})

describe('consuming responses', () => {
  let dapp: KeyPair
  let wallet: KeyPair

  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
    dapp = generateKeyPair()
    wallet = generateKeyPair()
  })

  function respondWith(pendingMethod: 'connect' | 'sign_message', envelope: unknown): void {
    const id = 'req-1'
    savePending({ id, walletId: WALLET.id, method: pendingMethod, returnTo: 'x' })
    setUrl(
      `https://dapp.example/app?${RESPONSE_PARAM}=${encodeURIComponent(
        encodeRequest(envelope),
      )}&${REQUEST_ID_PARAM}=${id}`,
    )
  }

  it('stores the account and the autoConnect name on an approved connect', () => {
    saveSession({
      walletId: WALLET.id,
      secretKeyHex: bytesToHex(dapp.secretKey),
      publicKeyHex: dapp.publicKeyHex,
    })
    const key = sharedKey(wallet.secretKey, dapp.publicKeyHex)
    respondWith('connect', {
      approved: true,
      walletEncryptionPublicKey: wallet.publicKeyHex,
      data: seal(ACCOUNT, key),
    })

    const adapter = new DeeplinkWalletAdapter(WALLET)
    const consumed = adapter.consumeResponse()

    expect(consumed?.method).toBe('connect')
    expect(loadSession(WALLET.id)?.account?.address).toBe(ACCOUNT.address)
    // What lets wallet-adapter-core's autoConnect resume the session: core's
    // own write never runs, because the connect promise settled by unload.
    expect(localStorage.getItem('MovementWalletName')).toBe(WALLET.name)
  })

  it('carries a rejection reason for the host app to display', () => {
    // The wallet refuses before approval (a failed simulation, say) and puts
    // why in the plaintext envelope. Without this the page shows nothing and
    // the refusal is indistinguishable from never having come back.
    saveSession({
      walletId: WALLET.id,
      secretKeyHex: bytesToHex(dapp.secretKey),
      publicKeyHex: dapp.publicKeyHex,
    })
    respondWith('sign_message', {
      approved: false,
      error: 'Transaction would fail: insufficient balance',
    })

    const adapter = new DeeplinkWalletAdapter(WALLET)
    adapter.consumeResponse()

    expect(adapter.lastConsumedResponse?.result).toBeNull()
    expect(adapter.lastConsumedResponse?.error).toBe(
      'Transaction would fail: insufficient balance',
    )
  })

  it('ignores a forged ACCOUNT_CHANGED when no channel was established', () => {
    // The envelope is plaintext: anyone holding the request id could send
    // this. Without an established channel there is nothing it may drop.
    saveSession({
      walletId: WALLET.id,
      secretKeyHex: bytesToHex(dapp.secretKey),
      publicKeyHex: dapp.publicKeyHex,
    })
    respondWith('sign_message', { approved: false, code: 'ACCOUNT_CHANGED' })

    const adapter = new DeeplinkWalletAdapter(WALLET)
    adapter.consumeResponse()

    expect(adapter.disconnectReason).toBeNull()
    expect(loadSession(WALLET.id)).not.toBeNull()
  })

  it('drops the session on ACCOUNT_CHANGED over an established channel', () => {
    connectedSession(dapp, wallet)
    respondWith('sign_message', { approved: false, code: 'ACCOUNT_CHANGED' })

    const adapter = new DeeplinkWalletAdapter(WALLET)
    adapter.consumeResponse()

    expect(adapter.disconnectReason).toBe('account-changed')
    const stored = loadSession(WALLET.id)
    expect(stored?.account).toBeUndefined()
    // Kept for the reconnect proof.
    expect(stored?.previousWalletPublicKeyHex).toBe(wallet.publicKeyHex)
  })

  it('records why an approval without a session key was dropped', () => {
    // The response is destructively consumed either way; losing it without a
    // trace is the silent-drop class this package documents.
    respondWith('sign_message', { approved: true, data: 'sealed' })

    const adapter = new DeeplinkWalletAdapter(WALLET)
    const consumed = adapter.consumeResponse()

    expect(consumed).toBeNull()
    expect(adapter.lastIgnoredResponse).toMatch(/no connected session/)
  })
})
