import type { NetworkInfo } from '@moveindustries/wallet-standard'
import type { KeylessAdapterConfig } from './types'

interface NetworkEntry {
  info: NetworkInfo
  fullnode: string
  indexer: string
}

/**
 * Endpoints per network. The `satisfies` is load-bearing: widening
 * KeylessAdapterConfig['network'] to include 'mainnet' fails to compile until
 * an entry exists, rather than silently falling through to testnet.
 */
export const NETWORKS = {
  testnet: {
    info: {
      name: 'testnet' as unknown as NetworkInfo['name'],
      chainId: 250,
      url: 'https://testnet.movementnetwork.xyz/v1',
    },
    fullnode: 'https://testnet.movementnetwork.xyz/v1',
    indexer: 'https://indexer.testnet.movementnetwork.xyz/v1/graphql',
  },
} satisfies Record<KeylessAdapterConfig['network'], NetworkEntry>
