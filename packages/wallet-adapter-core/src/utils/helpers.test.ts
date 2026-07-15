import { Network } from "@moveindustries/ts-sdk";
import { NetworkInfo } from "@moveindustries/wallet-standard";
import { getMovementConfig } from "./helpers";

describe("getMovementConfig", () => {
  it("recognizes Movement mainnet by chain id when the wallet reports a custom network (e.g. Nightly)", () => {
    const networkInfo: NetworkInfo = {
      name: Network.CUSTOM,
      chainId: 126,
      url: "https://rpc.movement.nightly.app",
    };
    const config = getMovementConfig(networkInfo, undefined);
    expect(config.network).toBe(Network.MAINNET);
    expect(config.fullnode).toBe("https://rpc.movement.nightly.app");
  });

  it("recognizes Movement testnet by chain id for a custom network", () => {
    const networkInfo: NetworkInfo = {
      name: Network.CUSTOM,
      chainId: 250,
      url: "https://rpc.testnet.example",
    };
    const config = getMovementConfig(networkInfo, undefined);
    expect(config.network).toBe(Network.TESTNET);
    expect(config.fullnode).toBe("https://rpc.testnet.example");
  });

  it("still resolves a network reported by name", () => {
    const networkInfo: NetworkInfo = { name: Network.MAINNET, chainId: 126 };
    expect(getMovementConfig(networkInfo, undefined).network).toBe(Network.MAINNET);
  });

  it("still matches a known Movement RPC url when the chain id is not recognized", () => {
    const networkInfo: NetworkInfo = {
      name: Network.CUSTOM,
      chainId: 0,
      url: "https://mainnet.movementnetwork.xyz/v1",
    };
    expect(getMovementConfig(networkInfo, undefined).network).toBe(Network.MAINNET);
  });

  it("throws for an unrecognized network (unknown name, chain id, and url)", () => {
    const networkInfo: NetworkInfo = {
      name: Network.CUSTOM,
      chainId: 999,
      url: "https://evil.example",
    };
    expect(() => getMovementConfig(networkInfo, undefined)).toThrow(
      /not supported with Movement wallet adapter/,
    );
  });
});
