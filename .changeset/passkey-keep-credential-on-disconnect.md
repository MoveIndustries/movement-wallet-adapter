---
"@moveindustries/wallet-adapter-passkey": patch
---

fix: keep the cached passkey credential across disconnect; re-authenticate on cached connect

`movement:disconnect` cleared the localStorage credential cache, so every
disconnect/reconnect cycle re-ran sign-in recovery — two user-verification
prompts (Touch ID / password) each time. Disconnect now clears only the
in-memory account and fires the change event; the cache survives.

Connecting from the cache is no longer silent: it performs one
`navigator.credentials.get()` bound to the cached credential id, so
reconnect costs a single user-verification prompt (no picker, no recovery).
Connect stays an explicit authorization moment, and a passkey that was
deleted from the OS fails at connect time with a clear error instead of at
first transaction signing. On failure (cancel or missing passkey) the cache
is kept so a cancelled prompt doesn't force recovery.

Dropping the cache is an explicit opt-in: `adapter.forgetCredential()`
clears the localStorage entry and disconnects, so the next connect re-runs
registration or sign-in recovery. The OS-level passkey is untouched in all
paths. The cached entry holds only public data (credential id, public key,
address) and is address-integrity-checked on load, unchanged from before.
