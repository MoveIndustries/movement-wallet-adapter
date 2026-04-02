/**
 * Some extensions register multiple Wallet Standard names (e.g. "MPCVault", "Petra",
 * "Nightly") that all point at the same Chrome Web Store listing. Chrome still shows
 * separate extensions; the duplicate rows are bogus adapter metadata. Collapse them
 * to a single entry per store extension id.
 *
 * @see https://chromewebstore.google.com/detail/<slug>/<extension-id>
 */

const CHROME_STORE_HOST = "chromewebstore.google.com";

function pathParts(url: string): string[] {
  try {
    const u = new URL(url);
    if (!u.hostname.includes(CHROME_STORE_HOST)) return [];
    return u.pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

/** Last path segment for .../detail/<slug>/<extension-id> */
export function chromeWebStoreExtensionId(url: string): string | null {
  const parts = pathParts(url);
  if (parts.length < 3 || parts[0] !== "detail") return null;
  return parts[parts.length - 1] ?? null;
}

/** Middle segment: .../detail/<slug>/<extension-id> */
export function chromeWebStoreListingSlug(url: string): string | null {
  const parts = pathParts(url);
  if (parts.length < 3 || parts[0] !== "detail") return null;
  return parts[1] ?? null;
}

function normalizeWalletLabel(name: string): string {
  return name
    .replace(/ Wallet$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type WalletWithInstallLink = {
  readonly name: string;
  readonly url: string;
};

/**
 * One wallet per Chrome Web Store extension id. When several names share the same id,
 * keep the row whose name best matches the listing slug (e.g. mpcvault for /detail/mpcvault/id).
 */
export function dedupeExtensionWalletsByChromeStoreId<
  T extends WalletWithInstallLink,
>(wallets: readonly T[]): T[] {
  const byId = new Map<string, T[]>();
  const withoutStoreId: T[] = [];

  for (const w of wallets) {
    const id = chromeWebStoreExtensionId(w.url);
    if (!id) {
      withoutStoreId.push(w);
      continue;
    }
    const list = byId.get(id);
    if (list) list.push(w);
    else byId.set(id, [w]);
  }

  const result: T[] = [...withoutStoreId];

  // Array.from: downlevel `for..of` on MapIterator incorrectly uses `.length` (undefined).
  for (const group of Array.from(byId.values())) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }

    const slug = chromeWebStoreListingSlug(group[0]!.url);
    const slugNorm = slug ? normalizeSlug(slug) : "";

    let chosen: T | undefined;
    if (slugNorm) {
      chosen = group.find((w) => normalizeWalletLabel(w.name) === slugNorm);
      if (!chosen) {
        chosen = group.find((w) =>
          normalizeWalletLabel(w.name).includes(slugNorm),
        );
      }
      if (!chosen) {
        chosen = group.find((w) =>
          slugNorm.includes(normalizeWalletLabel(w.name)),
        );
      }
    }
    result.push(chosen ?? group[0]!);
  }

  return result;
}
