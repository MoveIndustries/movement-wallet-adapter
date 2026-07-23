export interface KeylessAdapterConfig {
  /** URL of the Movement keyless prover (e.g. /api/prove). */
  proverUrl: string
  /** Google OAuth client_id. */
  clientId: string
  /** OAuth redirect URI registered with Google (must match exactly). */
  redirectUri: string
  /** Currently 'testnet' only. Forward-compat for 'mainnet' once VK is deployed. */
  network: 'testnet'
}
