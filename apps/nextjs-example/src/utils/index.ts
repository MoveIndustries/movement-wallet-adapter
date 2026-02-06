import { Movement, MovementConfig, Network } from "@moveindustries/ts-sdk";
import { NetworkInfo } from "@moveindustries/wallet-adapter-react";

export const movementClient = (network?: NetworkInfo | null) => {
  if (network?.name === Network.DEVNET) {
    return DEVNET_CLIENT;
  } else if (network?.name === Network.TESTNET) {
    return TESTNET_CLIENT;
  } else if (network?.name === Network.MAINNET) {
    throw new Error("Please use devnet or testnet for testing");
  } else {
    const CUSTOM_CONFIG = new MovementConfig({
      network: Network.CUSTOM,
      fullnode: network?.url,
    });
    return new Movement(CUSTOM_CONFIG);
  }
};

// Devnet client
export const DEVNET_CONFIG = new MovementConfig({
  network: Network.DEVNET,
});
export const DEVNET_CLIENT = new Movement(DEVNET_CONFIG);

// Testnet client
export const TESTNET_CONFIG = new MovementConfig({ network: Network.TESTNET });
export const TESTNET_CLIENT = new Movement(TESTNET_CONFIG);

export const isSendableNetwork = (
  connected: boolean,
  networkName?: string,
): boolean => {
  return connected && !isMainnet(connected, networkName);
};

export const isMainnet = (
  connected: boolean,
  networkName?: string,
): boolean => {
  return connected && networkName === Network.MAINNET;
};
