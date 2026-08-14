import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginSession,
  clearSession,
  loadPending,
  loadSession,
  newRequestId,
  savePending,
  secretKeyOf,
  takeResponseFromUrl,
  REQUEST_ID_PARAM,
  RESPONSE_PARAM,
} from './session.js'

function setUrl(url: string): void {
  window.history.replaceState({}, '', url)
}

describe('session storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setUrl('https://dapp.example/app')
  })

  it('starts a session with a usable keypair', () => {
    const session = beginSession('movement-mobile-deeplink')
    expect(session.publicKeyHex).toMatch(/^[0-9a-f]{64}$/)
    expect(secretKeyOf(session)).toHaveLength(32)
    expect(loadSession()?.walletId).toBe('movement-mobile-deeplink')
  })

  it('rotates the keypair when a session is restarted', () => {
    const first = beginSession('w')
    const second = beginSession('w')
    expect(second.publicKeyHex).not.toBe(first.publicKeyHex)
  })

  it('clears the pending request along with the session', () => {
    beginSession('w')
    savePending({ id: 'a', walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/app' })
    clearSession()
    expect(loadSession()).toBeNull()
    expect(loadPending()).toBeNull()
  })
})

describe('taking a response off the URL', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setUrl('https://dapp.example/app')
  })

  it('returns nothing when the URL carries no response', () => {
    expect(takeResponseFromUrl()).toBeNull()
  })

  it('matches a response to the request that asked for it', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'https://dapp.example/app' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    const taken = takeResponseFromUrl()
    expect(taken?.encoded).toBe('abc')
    expect(taken?.pending.method).toBe('connect')
  })

  it('ignores a response whose id does not match the pending request', () => {
    savePending({ id: 'expected', walletId: 'w', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=stale`)
    expect(takeResponseFromUrl()).toBeNull()
  })

  it('strips both parameters so a reload cannot replay a spent response', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'connect', returnTo: 'x' })
    setUrl(`https://dapp.example/app?keep=1&${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    takeResponseFromUrl()

    const url = new URL(window.location.href)
    expect(url.searchParams.get(RESPONSE_PARAM)).toBeNull()
    expect(url.searchParams.get(REQUEST_ID_PARAM)).toBeNull()
    // Unrelated query state belongs to the host app and must survive.
    expect(url.searchParams.get('keep')).toBe('1')
  })

  it('consumes a stale response instead of leaving it to re-fire', () => {
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=orphan`)
    expect(takeResponseFromUrl()).toBeNull()
    expect(new URL(window.location.href).searchParams.get(RESPONSE_PARAM)).toBeNull()
  })

  it('clears the pending request once its response is taken', () => {
    const id = newRequestId()
    savePending({ id, walletId: 'w', method: 'sign_message', returnTo: 'x' })
    setUrl(`https://dapp.example/app?${RESPONSE_PARAM}=abc&${REQUEST_ID_PARAM}=${id}`)

    takeResponseFromUrl()

    expect(loadPending()).toBeNull()
  })
})
