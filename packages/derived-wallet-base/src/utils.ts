import { AccountPublicKey, Movement } from "@moveindustries/ts-sdk";
import { AccountInfo } from "@moveindustries/wallet-standard";

export function accountInfoFromPublicKey(publicKey: AccountPublicKey) {
  return new AccountInfo({
    publicKey,
    address: publicKey.authKey().derivedAddress(),
  });
}

export function isNullCallback(callback: Function) {
  return "_isNull" in callback && callback._isNull === true;
}

/**
 * Helper function to fetch Devnet chain id
 */
export const fetchDevnetChainId = async (): Promise<number> => {
  const aptos = new Movement(); // default to devnet
  return await aptos.getChainId();
};
