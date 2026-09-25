---
"@moveindustries/wallet-adapter-react": patch
---

Import `JSX` from `react` instead of relying on the global namespace, which
`@types/react` 19 removed, and type the `isValidElement` check in the `asChild`
slot. Type-only change: the emitted declarations now work with both React 18
and React 19 types.
