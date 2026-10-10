import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  beginSession,
  buildRedirectUrl,
  clearSession,
  loadPending,
  loadSession,
  newRequestId,
  savePending,
  secretKeyOf,
  takeResponseFromUrl,
  hostWindow,
  REQUEST_ID_PARAM,
  RESPONSE_PARAM,
} from './session.js'

function setUrl(url: string): void {
  window.history.replaceState({}, '', url)
}

/** Puts this window inside a frame owned by `top`, until the returned undo. */
function frameUnder(top: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'top')
  Object.defineProperty(window, 'top', { value: top, configurable: true })
  return () => {
    if (original) Object.defineProperty(window, 'top', original)
    else Reflect.deleteProperty(window, 'top')
  }
}

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
  })

  it('starts a session with a usable keypair', () => {
    const session = beginSession('movement-mobile-deeplink')
    expect(session.publicKeyHex).toMatch(/^[0-9a-f]{64}$/)
    expect(secretKeyOf(session)).toHaveLength(32)
    expect(loadSession('movement-mobile-deeplink')?.walletId).toBe('movement-mobile-deeplink')
  })

  it('rotates the keypair when a session is restarted', () => {
    const first = beginSession('w')
    const second = beginSession('w')
    expect(second.publicKeyHex).not.toBe(first.publicKeyHex)
  })

  it('clears the pending request along with the session', () => {
    beginSession('w')
    savePending({ id: 'a', walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/app' })
    clearSession('w')
    expect(loadSession('w')).toBeNull()
    expect(loadPending()).toBeNull()
  })

  it("keeps each wallet's session in its own slot", () => {
    // A single shared slot let beginSession(B) destroy wallet A's secret key.
    const a = beginSession('wallet-a')
    beginSession('wallet-b')
    expect(loadSession('wallet-a')?.publicKeyHex).toBe(a.publicKeyHex)
    clearSession('wallet-b')
    expect(loadSession('wallet-a')?.publicKeyHex).toBe(a.publicKeyHex)
    expect(loadSession('wallet-b')).toBeNull()
  })

  it("leaves another wallet's pending request alone on clear", () => {
    savePending({ id: 'a', walletId: 'other', method: 'sign_message', returnTo: 'x' })
    beginSession('w')
    clearSession('w')
    expect(loadPending()?.walletId).toBe('other')
  })

  it('migrates a session stored before slots were keyed by wallet', () => {
    const legacy = {
      walletId: 'w',
      secretKeyHex: 'aa'.repeat(32),
      publicKeyHex: 'bb'.repeat(32),
    }
    localStorage.setItem('movement.deeplink.session.v1', JSON.stringify(legacy))
    expect(loadSession('w')?.publicKeyHex).toBe(legacy.publicKeyHex)
    // Moved, not copied: the shared slot is gone afterwards.
    expect(localStorage.getItem('movement.deeplink.session.v1')).toBeNull()
    expect(localStorage.getItem('movement.deeplink.session.v1.w')).not.toBeNull()
  })

  it("does not migrate another wallet's legacy session", () => {
    localStorage.setItem(
      'movement.deeplink.session.v1',
      JSON.stringify({ walletId: 'other', secretKeyHex: 'aa', publicKeyHex: 'bb' }),
    )
    expect(loadSession('w')).toBeNull()
    expect(localStorage.getItem('movement.deeplink.session.v1')).not.toBeNull()
  })
})

describe('taking a response off the URL', () => {
  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
  })

  it('returns nothing when the URL carries no response', () => {
    expect(takeResponseFromUrl('w')).toBeNull()
  })

  it('matches a response to the request that asked for it', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/app' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    const taken = takeResponseFromUrl('w')
    expect(taken?.ok).toBe(true)
    expect(taken?.ok && taken.encoded).toBe('abc')
    expect(taken?.ok && taken.pending.method).toBe('connect')
  })

  it('reads the newest response when stale ones survived on the URL', () => {
    // The strip in this module runs before the host framework hydrates, and a
    // framework restoring its own URL afterwards resurrects spent responses.
    // The wallet appends its answer, so the live one is always last.
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/app' })
    setUrl(
      `https://dapp.example/app?${RESPONSE_PARAM}=stale1&${RESPONSE_PARAM}=stale2&${REQUEST_ID_PARAM}=${id}&${RESPONSE_PARAM}=live`,
    )

    const taken = takeResponseFromUrl('w')
    expect(taken?.ok).toBe(true)
    expect(taken?.ok && taken.encoded).toBe('live')
    // Every copy is spent now, stale ones included.
    expect(new URL(window.location.href).searchParams.getAll(RESPONSE_PARAM)).toEqual([])
  })

  it('ignores a response whose id does not match, and says why', () => {
    savePending({ id: 'expected', walletId: 'w', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=stale`)
    const taken = takeResponseFromUrl('w')
    expect(taken?.ok).toBe(false)
    expect(taken?.ok === false && taken.reason).toMatch(/older request/)
  })

  it('explains a response arriving with no pending request', () => {
    // The shape of the new-tab failure: sessionStorage would have lost the
    // pending request here, and the response would vanish without a word.
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=x`)
    const taken = takeResponseFromUrl('w')
    expect(taken?.ok).toBe(false)
    expect(taken?.ok === false && taken.reason).toMatch(/no pending request/)
  })

  it('survives a session started in another tab', () => {
    // localStorage, not sessionStorage: the wallet often returns into a new
    // tab, which must still find the request that was made.
    savePending({ id: 'x', walletId: 'w', method: 'connect', returnTo: 'x' })
    expect(JSON.parse(localStorage.getItem('movement.deeplink.pending.v1')!).id).toBe('x')
  })

  it('strips both parameters so a reload cannot replay a spent response', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?keep=1&${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    takeResponseFromUrl('w')

    const url = new URL(window.location.href)
    expect(url.searchParams.get(RESPONSE_PARAM)).toBeNull()
    expect(url.searchParams.get(REQUEST_ID_PARAM)).toBeNull()
    // Unrelated query state belongs to the host app and must survive.
    expect(url.searchParams.get('keep')).toBe('1')
  })

  it('consumes an empty response value and says why', () => {
    // `?response=` with no value used to return before the URL was stripped
    // or a reason recorded — the silent-drop class this module documents.
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=&${REQUEST_ID_PARAM}=${id}`)

    const taken = takeResponseFromUrl('w')

    expect(taken?.ok).toBe(false)
    expect(taken?.ok === false && taken.reason).toMatch(/empty/)
    expect(new URL(window.location.href).searchParams.get(RESPONSE_PARAM)).toBeNull()
  })

  it('consumes a stale response instead of leaving it to re-fire', () => {
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=orphan`)
    expect(takeResponseFromUrl('w')?.ok).toBe(false)
    expect(new URL(window.location.href).searchParams.get(RESPONSE_PARAM)).toBeNull()
  })

  it("leaves another wallet's live response for its own adapter", () => {
    // Adapters take turns consuming; the first one must not destroy a
    // response addressed to a later one.
    const id = newRequestId()
    savePending({ id, walletId: 'other', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    expect(takeResponseFromUrl('w')).toBeNull()
    expect(new URL(window.location.href).searchParams.get(RESPONSE_PARAM)).toBe('abc')
    expect(loadPending()?.id).toBe(id)
    expect(takeResponseFromUrl('other')?.ok).toBe(true)
  })

  it('clears the pending request once its response is taken', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'sign_message', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    takeResponseFromUrl('w')

    expect(loadPending()).toBeNull()
  })
})

describe('framed hosts', () => {
  let undo: (() => void) | null = null

  beforeEach(() => {
    localStorage.clear()
    setUrl('https://dapp.example/app')
  })

  afterEach(() => {
    undo?.()
    undo = null
  })

  it('uses this window when the page is not framed', () => {
    expect(hostWindow()).toBe(window)
  })

  it('uses the top document when framed by a same-origin page', () => {
    const top = { location: { href: 'https://dapp.example/shell' }, history: {} }
    undo = frameUnder(top)
    expect(hostWindow()).toBe(top)
  })

  it('reports no host when an ancestor is cross-origin', () => {
    undo = frameUnder({
      get location(): never {
        throw new Error('cross-origin')
      },
    })
    expect(hostWindow()).toBeNull()
  })

  it('takes the response off the top URL, not the frame it is read from', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/shell' })

    let replacedWith = ''
    undo = frameUnder({
      location: {
        href: `https://dapp.example/shell?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`,
      },
      history: {
        replaceState: (_s: unknown, _t: string, url: string) => {
          replacedWith = url
        },
      },
    })

    const taken = takeResponseFromUrl('w')

    expect(taken?.ok).toBe(true)
    // Cleaned up on the top document, so a reload cannot re-fire it.
    expect(new URL(replacedWith).searchParams.get(RESPONSE_PARAM)).toBeNull()
    expect(new URL(replacedWith).searchParams.get(REQUEST_ID_PARAM)).toBeNull()
  })

  it('finds nothing when a cross-origin ancestor hides the URL', () => {
    undo = frameUnder({
      get location(): never {
        throw new Error('cross-origin')
      },
    })
    expect(takeResponseFromUrl('w')).toBeNull()
  })
})

describe('building the redirect URL', () => {
  it('sets the request id and keeps the host app query state', () => {
    const redirect = new URL(buildRedirectUrl('https://dapp.example/app?keep=1', 'id1'))
    expect(redirect.searchParams.get(REQUEST_ID_PARAM)).toBe('id1')
    expect(redirect.searchParams.get('keep')).toBe('1')
  })

  it('strips surviving responses so they cannot compound', () => {
    // The wallet appends its answer to this URL, so a spent response that a
    // host framework resurrected would otherwise return once per round trip,
    // forever, with the oldest in front.
    const href = `https://dapp.example/app?${RESPONSE_PARAM}=stale&${REQUEST_ID_PARAM}=old&${RESPONSE_PARAM}=staler`
    const redirect = new URL(buildRedirectUrl(href, 'fresh'))
    expect(redirect.searchParams.getAll(RESPONSE_PARAM)).toEqual([])
    expect(redirect.searchParams.get(REQUEST_ID_PARAM)).toBe('fresh')
  })
})
