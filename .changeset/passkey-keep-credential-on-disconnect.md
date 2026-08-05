---
"@moveindustries/wallet-adapter-passkey": minor
---

fix: keep the cached passkey credential across disconnect; add opt-in re-authentication on connect

`movement:disconnect` cleared the localStorage credential cache, so every
disconnect/reconnect cycle re-ran sign-in recovery, costing two
user-verification prompts (Touch ID / password) each time. Disconnect now
clears only the in-memory account and fires the change event; the cache
survives.

Restoring a cached credential on connect stays silent by default.
`autoConnect` calls `connect()` from a mount effect with no user gesture, so
prompting there would mean a biometric prompt on every page load, and some
browsers reject WebAuthn ceremonies outside a user activation entirely. The
new `reauthenticateOnConnect` option opts into one
`navigator.credentials.get()` bound to the cached credential id, which makes
connect an explicit authorization moment and surfaces a passkey deleted from
the OS at connect time rather than at first signing. Use it only where connect
is always user-initiated.

When re-authentication runs, the resulting assertion is verified rather than
merely awaited: the returned credential id must match the cached one, the
authenticator data's user-verified flag must be set, and the signature must
verify against the cached public key. Failures keep the cache so a cancelled
prompt doesn't force recovery, and a `DOMException` other than
`NotAllowedError` (which is deliberately opaque) is reported by name with the
original error attached as `cause`.

The active credential is now shared across the two adapter instances that
`registerPasskeyWallets()` creates, since both already wrote to one
localStorage slot. Previously `forgetCredential()` on one instance cleared the
shared slot while leaving the other instance reporting a connected account
whose cache was gone.

Dropping the cache remains an explicit opt-in: `adapter.forgetCredential()`
clears the localStorage entry and disconnects, so the next connect re-runs
registration or sign-in recovery. The OS-level passkey is untouched in all
paths. The cached entry holds only public data (credential id, public key,
address) and is address-integrity-checked on load, unchanged from before.
