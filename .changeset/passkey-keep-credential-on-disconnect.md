---
"@moveindustries/wallet-adapter-passkey": patch
---

fix: keep the cached passkey credential across disconnect

`movement:disconnect` cleared the localStorage credential cache, so every
disconnect/reconnect cycle re-ran sign-in recovery — two user-verification
prompts (Touch ID / password) each time, even though `connect()` is designed
to restore a cached credential prompt-free. Disconnect now clears only the
in-memory account and fires the change event; the cache survives, so
reconnecting on the same device never prompts.

Dropping the cache is now an explicit opt-in: `adapter.forgetCredential()`
clears the localStorage entry and disconnects, so the next connect re-runs
registration or sign-in recovery. The OS-level passkey is untouched in both
paths. The cached entry holds only public data (credential id, public key,
address) and is address-integrity-checked on load, unchanged from before.
