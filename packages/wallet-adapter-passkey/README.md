# @moveindustries/wallet-adapter-passkey

Movement passkey (WebAuthn / AIP-66) wallet adapter. Implements the
[`@moveindustries/wallet-standard`](https://www.npmjs.com/package/@moveindustries/wallet-standard)
so platform-authenticator passkeys plug into
[`@moveindustries/wallet-adapter-react`](https://www.npmjs.com/package/@moveindustries/wallet-adapter-react)
the same way Petra / Motion / Nightly do — consumers call `useWallet()` and
don't need to know whether the user signed in via Touch ID, Face ID, Windows
Hello, or a browser extension.

Wraps `navigator.credentials.*` and the AIP-66 `WebAuthnSignature` /
`Secp256r1PublicKey` primitives from `@moveindustries/ts-sdk` internally;
users of this package never call WebAuthn APIs directly.

## Install

```bash
pnpm add @moveindustries/wallet-adapter-passkey \
         @moveindustries/wallet-adapter-react \
         @moveindustries/wallet-standard \
         @moveindustries/ts-sdk
```

The adapter exposes features under the `movement:*` namespace.
`@noble/hashes` is bundled as a regular dependency — it's an implementation
detail used to hash the signing message into a 32-byte WebAuthn challenge.

## Usage

Register once at app start, then use `useWallet()` from
`@moveindustries/wallet-adapter-react` everywhere. The adapter exposes
**two entries** in the wallet picker:

- **Create new passkey** — registers a fresh passkey on the device's
  platform authenticator. Touch ID / Face ID / Windows Hello prompt.
- **Sign in with existing passkey** — recovers an existing passkey
  (synced via iCloud Keychain or Google Password Manager) without a
  server. Uses dual-signature ECDSA point recovery; see
  [Recovery flow](#sign-in-recovery-flow) below.

```tsx
// app/providers.tsx (Next.js)
'use client'

import { useEffect } from 'react'
import { registerPasskeyWallets } from '@moveindustries/wallet-adapter-passkey'
import { MovementWalletAdapterProvider } from '@moveindustries/wallet-adapter-react'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerPasskeyWallets({
      network: 'testnet',
      // Optional: surface progress UI for the dual-sign recovery flow
      onRecoveryStep: (step) => {
        // step is 'authenticating-1' | 'authenticating-2' | 'complete'
        console.log('passkey recovery step:', step)
      },
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

When the user picks **Create new passkey**, the platform's biometric prompt
fires (Touch ID / Face ID / Windows Hello / Android biometric) and a new
passkey is registered. When they pick **Sign in with existing passkey**, the
recovery flow runs (see below). Either way, after success the credential
caches in `localStorage` and subsequent calls to `connect()` reload it
without any prompt.

## Sign-in recovery flow

WebAuthn's `navigator.credentials.get()` does **not** include the public key
in its assertion — only `create()` does. So when a user shows up on a fresh
device (or after clearing site data), we have the credential ID + signature
but not the public key, and therefore not the on-chain address.

Without a backend to look it up, the only client-side path is **ECDSA point
recovery**. Every signature points to exactly two candidate public keys; if
we collect signatures from two different challenges and intersect their
candidate sets, the unique matching key is the real one.

The `'signin'` mode does this:

1. **First biometric** — `navigator.credentials.get()` with no
   `allowCredentials`. The OS shows a picker for any passkey at this rpId.
   User selects → recover candidates `[A, B]` from `(sig₁, msgHash₁)`.
2. **Second biometric** — bound to the credential the user just picked
   (so they can't accidentally pick a different passkey). User authenticates
   → recover candidates `[C, D]` from `(sig₂, msgHash₂)`.
3. **Intersect** — the unique public key appears in both `{A, B}` and
   `{C, D}`. Derive the address, cache, done.

After this, both modes behave identically — credential is in `localStorage`,
subsequent connects skip the biometric prompts.

`onRecoveryStep` is invoked with `'authenticating-1' | 'authenticating-2'
| 'complete'` so the host app can show progress UI.

## HTTPS requirement

WebAuthn requires a secure context. In production you must serve the page
over HTTPS — `localhost` and `127.0.0.1` are the only exceptions. Plain HTTP
on any other host will fail at `navigator.credentials.create()` with no
recoverable error path.

## Relying-party id (rpId)

Browsers tie each passkey to a single relying-party id (the rpId). We
default to:

- `'localhost'` when the page hostname is `localhost` or `127.0.0.1`
- the bare hostname otherwise (e.g. `keyless-playground.vercel.app`)

You can override with the `rpId` option in `PasskeyAdapterConfig`. Pick
something stable and as broad as your eTLD+1 allows — for example `rpId:
'mywallet.com'` so passkeys created on `app.mywallet.com` keep working if
you later migrate to `wallet.mywallet.com`.

**Important:** the rpId is permanent for any passkey created with it.
Changing it later invalidates existing passkeys (they only show in the
picker under the domain they were originally created on). Choose carefully
on day one.

Recommended deploys:

| Environment | rpId | Notes |
|---|---|---|
| `localhost:3000` | `localhost` (auto) | All localhost ports share one passkey set |
| `staging.example.com` | `staging.example.com` (auto) or `example.com` | Use eTLD+1 if you want to share with prod |
| `app.example.com` | `example.com` | Allows cross-subdomain reuse |

## Wallet standard features implemented

The `standard:events` row is the wallet-standard primitive — not namespaced.

| Namespace | Implementation |
|---|---|
| `standard:events` | Change-event emitter from `@wallet-standard/core`. Fires `change` with the new `accounts` array on connect / disconnect. Required — wallet-adapter libraries cache `wallet.accounts` and only re-read it when this fires; without it the consumer's `useWallet()` never sees connect succeed. |
| `movement:connect` | If a credential is cached in `localStorage`, restores it immediately. Otherwise calls `navigator.credentials.create()` to register a new platform-authenticator passkey. |
| `movement:disconnect` | Clears the cached credential, fires the change event. The OS-level passkey is left intact — the user can reconnect later (or remove it via OS settings). |
| `movement:account` | Returns address + 65-byte uncompressed P-256 public key. Throws if not connected. |
| `movement:network` | Returns Movement testnet info (chain ID 177, Movement RPC). |
| `movement:signTransaction` (v1.1) | Dispatches both v1.0 (positional `(transaction, asFeePayer?)`) and v1.1 (`{ payload, sender?, gasUnitPrice?, maxGasAmount?, expirationSecondsFromNow? }`) calling conventions. v1.0 returns an `AccountAuthenticatorSingleKey`; v1.1 returns `{ authenticator, rawTransaction }`. Triggers a biometric prompt to sign each transaction. |
| `movement:signAndSubmitTransaction` | Builds the transaction via `@moveindustries/ts-sdk`, signs with the passkey, and submits via `client.transaction.submit.simple`. Returns `{ hash }`. |
| `movement:onAccountChange` | Listener registry — fires on connect/disconnect. |
| `movement:onNetworkChange` | Registered but never fires (testnet only). |
| `movement:changeNetwork` | Always rejects — passkey adapter is testnet-only. |
| `movement:signMessage` | **Not yet supported.** Throws with a pointer to `signTransaction`. See [Roadmap](#roadmap). |

## Discoverability

The adapter is discovered via `getMovementWallets()` from
`@moveindustries/wallet-standard`.

The `chains` array is `['movement:testnet']` only — AIP-66 verification is
rolled out on Movement testnet (chain ID 177).

## Network

**Testnet only.** `changeNetwork` always rejects. Mainnet support arrives
once AIP-66 is enabled on Movement mainnet — at that point this becomes a
constructor option:

```ts
registerPasskeyWallet({ ..., network: 'mainnet' })
```

## Storage

The credential ID, public key, and derived address persist in
`localStorage` under the key `movement_passkey_credential`. Closing the tab
does not drop the cache — only `disconnect()` (or clearing site data
manually) removes it. The platform-authenticator passkey itself lives in
the OS keystore and is unaffected by clearing the cache; the user can
reconnect by calling `connect()` again, which re-prompts for biometric
verification and re-loads the public key from the assertion response.

There is no session timeout — once a credential is cached, the adapter
considers itself connected. Each individual signing operation triggers a
fresh biometric prompt (handled by the OS), so the user is never
authenticated for transactions purely by virtue of localStorage state.

## Roadmap

Known gaps tracked for future versions:

- **`signMessage`** — currently throws. The challenge is wrapping the
  AIP-62 `fullMessage` in WebAuthn's clientDataJSON envelope in a way that
  off-chain verifiers can validate. Tracked.
- **Fee-payer signing** — `signTransaction` rejects calls with
  `asFeePayer: true` (v1.0) or a `feePayer` field (v1.1). Sponsored-tx
  flows aren't supported yet.
- **`secondarySigners` in v1.1 `signTransaction`** — currently ignored.
  Multi-agent flows that need multiple signers per transaction aren't
  supported yet.
- **Mainnet support** — once AIP-66 is enabled on Movement mainnet.
- **Multi-credential / picker UI** — currently a single cached credential
  per origin. Letting the user manage multiple passkeys (e.g. one per
  device) is a future addition.
- **Single-signature recovery** — the dual-sign recovery flow could be
  reduced to one biometric prompt by checking on-chain history at both
  candidate addresses (cheaper UX when the user has prior activity).
  Not implemented; needs an indexer call.

## License

Apache-2.0.
