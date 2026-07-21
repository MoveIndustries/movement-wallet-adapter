# @moveindustries/wallet-adapter-keyless

Movement keyless (Google sign-in) wallet adapter. Implements the
[`@moveindustries/wallet-standard`](https://www.npmjs.com/package/@moveindustries/wallet-standard)
so keyless accounts plug into
[`@moveindustries/wallet-adapter-react`](https://www.npmjs.com/package/@moveindustries/wallet-adapter-react)
the same way Petra / Motion / Nightly do — consumers call `useWallet()` and
don't need to know whether the user signed in via Google or via a browser
extension.

Wraps [`@moveindustries/keyless`](https://www.npmjs.com/package/@moveindustries/keyless)
internally; users of this package never import that SDK directly.

## Install

```bash
pnpm add @moveindustries/wallet-adapter-keyless \
         @moveindustries/wallet-adapter-react \
         @moveindustries/wallet-standard \
         @moveindustries/ts-sdk \
         @moveindustries/keyless
```

The adapter exposes features under the `movement:*` namespace
(see [Discoverability](#discoverability) below). `@moveindustries/ts-sdk` is
a peer of `@moveindustries/keyless` (the keyless SDK uses Movement SDK
types like `KeylessAccount` internally).

## Usage

Register once at app start, then use `useWallet()` from
`@moveindustries/wallet-adapter-react` everywhere. The adapter shows up in
the wallet picker as **"Sign in with Google"** alongside any other
Movement-compatible wallets the user has installed.

```tsx
// app/providers.tsx (Next.js)
'use client'

import { useEffect } from 'react'
import { registerKeylessWallet } from '@moveindustries/wallet-adapter-keyless'
import { MovementWalletAdapterProvider } from '@moveindustries/wallet-adapter-react'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerKeylessWallet({
      proverUrl: '/api/prove',
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirectUri: `${window.location.origin}/callback`,
      network: 'testnet',
    })
  }, [])

  return (
    <MovementWalletAdapterProvider autoConnect={false}>
      {children}
    </MovementWalletAdapterProvider>
  )
}
```

Then in any component:

```tsx
'use client'

import { useWallet } from '@moveindustries/wallet-adapter-react'

export function ConnectButton() {
  const { connected, account, wallets, connect, disconnect } = useWallet()

  if (connected && account) {
    return (
      <div>
        <span>{account.address.toString()}</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return wallets.map((w) => (
    <button key={w.name} onClick={() => connect(w.name)}>
      {w.name}
    </button>
  ))
}
```

## OAuth callback

The keyless flow uses a **full-page redirect** to Google, which is unusual
for a wallet adapter (most use popups). The `connect()` call before the
redirect never resolves — the page navigates away. After Google redirects
back to your configured `redirectUri`, your `/callback` page must call
`connect()` again so the adapter detects the `id_token` in the URL hash and
completes the login.

```tsx
// app/callback/page.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@moveindustries/wallet-adapter-react'

const KEYLESS_WALLET_NAME = 'Sign in with Google'

export default function CallbackPage() {
  const router = useRouter()
  const { connect } = useWallet()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !window.location.hash.includes('id_token')) return
    ran.current = true

    Promise.resolve(connect(KEYLESS_WALLET_NAME))
      .then(() => {
        const returnTo = sessionStorage.getItem('keyless_return_to') ?? '/'
        sessionStorage.removeItem('keyless_return_to')
        router.replace(returnTo)
      })
      .catch(() => router.replace('/?error=keyless_failed'))
  }, [connect, router])

  return <p>Signing you in…</p>
}
```

The Google OAuth `redirect_uri` you register in the Google Cloud Console
must match `redirectUri` exactly — Google does string equality, not prefix
matching. Add an entry per environment (e.g. `http://localhost:3000/callback`,
`https://yourdomain.com/callback`).

## Wallet standard features implemented

The `standard:events` row is the wallet-standard primitive — not namespaced.

| Namespace | Implementation |
|---|---|
| `standard:events` | Change-event emitter from `@wallet-standard/core`. Fires `change` with the new `accounts` array on connect / disconnect. Required — wallet-adapter libraries cache `wallet.accounts` and only re-read it when this fires; without it the consumer's `useWallet()` never sees connect succeed. |
| `movement:connect` | Detects `id_token` in URL hash → completes login. Otherwise initiates OAuth redirect. |
| `movement:disconnect` | Clears in-memory account, fires account-change event. |
| `movement:account` | Returns address + public key. Throws if not connected. |
| `movement:network` | Returns Movement testnet info (chain ID 177, Movement RPC). |
| `movement:signMessage` | Builds the AIP-62 `fullMessage` (with optional address/application/chainId) and signs with the keyless account. Returns `{ signature, fullMessage, prefix: 'MOVEMENT', ... }`. |
| `movement:signTransaction` (v1.1) | Dispatches both v1.0 (positional `(transaction, asFeePayer?)`) and v1.1 (`{ payload, sender?, feePayer?, gasUnitPrice?, maxGasAmount?, expirationSecondsFromNow? }`) calling conventions on the same method. v1.0 returns an `AccountAuthenticator`; v1.1 returns `{ authenticator, rawTransaction }`. Honors `asFeePayer`/`feePayer` to call `signWithFeePayerAuthenticator` instead of `signTransactionWithAuthenticator`. |
| `movement:signIn` | Sign-In With Movement (AIP-116). Builds a structured SIWM message from `{ domain, nonce, statement?, uri?, version?, chainId?, issuedAt?, expirationTime?, notBefore?, requestId?, resources? }`, signs it with the keyless account, returns `{ account, input, signature, type: 'ed25519' }`. Lets dApps offer one-click "sign in with Google → authenticated session" with no on-chain transaction. |
| `movement:signAndSubmitTransaction` | Builds the transaction via `@moveindustries/ts-sdk`, signs + submits, returns `{ hash }`. |
| `movement:onAccountChange` | Listener registry — fires on connect/disconnect. |
| `movement:onNetworkChange` | Registered but never fires (testnet only). |
| `movement:changeNetwork` | Always rejects — keyless is testnet-only. |

## Discoverability

The adapter is discovered via `getMovementWallets()` from
`@moveindustries/wallet-standard`.

**The `chains` array is `['movement:testnet']` only** — the keyless
verification key is deployed on Movement testnet (chain ID 177).

## Network

**Testnet only.** The keyless verification key is currently deployed on
Movement testnet (Porto, chain ID 177); mainnet support requires the chain's
governance to publish a matching VK. The adapter advertises only
`movement:testnet` in its `chains` array and rejects `changeNetwork` calls.

When mainnet support arrives, this becomes a constructor option:

```ts
registerKeylessWallet({ ..., network: 'mainnet' })
```

## Session lifetime

Keyless sessions are **bounded by the ephemeral key's lifetime — about 1
hour** from sign-in. After expiry, signing operations fail and the user must
re-authenticate.

The connected account lives in memory only. A page reload (or tab close)
drops it and the user signs in again — the OAuth round-trip re-derives the
same on-chain address, so no state is lost. There is no `sessionStorage`
rehydration today: restoring across a reload needs the ephemeral key that
`beginLogin` stores internally, and the keyless SDK exposes no getter to
retrieve it for `completeLoginWithJwt`.

There's no automatic silent re-authentication in the current version — it's
deliberate, to keep the threat model simple. Hosts that want to surface
"session expiring soon" warnings can read `account.ephemeralKeyPair.expiryDateSecs`
and watch the clock client-side.

## Runtime reconfiguration

```ts
const adapter = registerKeylessWallet({ ... })
adapter.setConfig({ proverUrl: 'http://localhost:3001' })
```

If `proverUrl` or `clientId` changes while connected, the adapter
**auto-disconnects** before recreating its internal SDK. A different prover
means a different pepper, which means a different on-chain address — we
don't want users unknowingly signing with a different wallet.

`registerKeylessWallet` is idempotent: calling it again with new config
returns the same adapter instance and applies the config via `setConfig`.

## Sender vs. fee-payer

`signTransaction` honors the fee-payer role on both calling conventions:

```ts
// v1.0 positional
signTransaction(rawTx, /* asFeePayer */ true)
// v1.1 with feePayer field
signTransaction({
  payload: { ... },
  feePayer: { address: AccountAddress.from('0xabc...'), publicKey },
})
```

When `asFeePayer === true` (v1.0) or when v1.1's `feePayer.address` matches
the connected account, the adapter calls
`KeylessAccount.signWithFeePayerAuthenticator()` instead of
`signTransactionWithAuthenticator()`.

## Testing

Unit tests use Vitest with `jsdom`. The package's own test suite uses a
hoisted module mock for `@moveindustries/keyless` and
`@moveindustries/ts-sdk` — see `src/adapter.test.ts` for the pattern.
Consumers writing their own tests against this adapter can use the same
approach:

```ts
const mockKeyless = {
  beginLogin: vi.fn(),
  completeLogin: vi.fn(),
  logout: vi.fn(),
  hasSession: vi.fn(() => false),
  completeLoginWithJwt: vi.fn(),
}
vi.mock('@moveindustries/keyless', () => ({
  MovementKeyless: vi.fn(() => mockKeyless),
}))
```

The adapter is module-singleton via `registerKeylessWallet`; if your tests
need a clean slate between cases, instantiate `KeylessWalletAdapter`
directly rather than going through the registration helper.

## Roadmap

Known gaps tracked for future versions:

- **`secondarySigners` in v1.1 `signTransaction`** — currently ignored.
  Multi-agent flows that need multiple signers per transaction aren't
  supported yet.
- **Silent re-auth via `prompt=none`** — extend session past EPK expiry
  without user interaction.
- **Mainnet support** — once the keyless verification key is deployed on
  Movement mainnet.
- **Non-Google identity providers** — Apple, Facebook, etc. Blocked on the
  keyless SDK (`@moveindustries/keyless`) supporting them upstream.

## License

Apache-2.0.
