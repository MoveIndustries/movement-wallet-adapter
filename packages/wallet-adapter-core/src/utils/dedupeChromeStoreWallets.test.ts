import {
  chromeWebStoreExtensionId,
  chromeWebStoreListingSlug,
  dedupeExtensionWalletsByChromeStoreId,
} from "./dedupeChromeStoreWallets";

const MPC_VAULT_STORE_URL =
  "https://chromewebstore.google.com/detail/mpcvault/jgfmfplofjigjfokigdiaiibhonfnedj";

describe("chromeWebStoreExtensionId", () => {
  it("parses extension id from detail URL", () => {
    expect(chromeWebStoreExtensionId(MPC_VAULT_STORE_URL)).toBe(
      "jgfmfplofjigjfokigdiaiibhonfnedj",
    );
  });

  it("returns null for non-store URLs", () => {
    expect(chromeWebStoreExtensionId("https://nightly.app/")).toBeNull();
    expect(chromeWebStoreExtensionId("not-a-url")).toBeNull();
  });
});

describe("chromeWebStoreListingSlug", () => {
  it("parses listing slug", () => {
    expect(chromeWebStoreListingSlug(MPC_VAULT_STORE_URL)).toBe("mpcvault");
  });
});

describe("dedupeExtensionWalletsByChromeStoreId", () => {
  it("keeps one wallet per Chrome extension id, preferring name matching slug", () => {
    const wallets = [
      { name: "MPCVault", url: MPC_VAULT_STORE_URL, icon: "a" },
      { name: "Petra", url: MPC_VAULT_STORE_URL, icon: "a" },
      { name: "Nightly", url: MPC_VAULT_STORE_URL, icon: "a" },
    ];
    const out = dedupeExtensionWalletsByChromeStoreId(wallets);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("MPCVault");
  });

  it("does not merge different extension ids", () => {
    const nightlyUrl =
      "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa";
    const wallets = [
      { name: "MPCVault", url: MPC_VAULT_STORE_URL, icon: "a" },
      { name: "Nightly", url: nightlyUrl, icon: "b" },
    ];
    const out = dedupeExtensionWalletsByChromeStoreId(wallets);
    expect(out).toHaveLength(2);
  });

  it("passes through wallets without chrome store url", () => {
    const wallets = [
      { name: "Nightly", url: "https://nightly.app/", icon: "x" },
      { name: "Other", url: "https://example.com", icon: "y" },
    ];
    expect(dedupeExtensionWalletsByChromeStoreId(wallets)).toEqual(wallets);
  });
});
