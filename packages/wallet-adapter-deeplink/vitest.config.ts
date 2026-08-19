import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      // The session tests drive history.replaceState, which jsdom refuses
      // across origins. Giving the document a real https origin also matches
      // where this adapter actually runs — it is mobile-web only.
      jsdom: { url: 'https://dapp.example/app' },
    },
  },
})
