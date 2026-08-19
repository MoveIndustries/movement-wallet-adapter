import { afterEach, describe, expect, it } from 'vitest'
import { isMobileBrowser } from './wallets.js'

const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent')

function setUserAgent(value: string): void {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'userAgent')
  if (original) Object.defineProperty(Navigator.prototype, 'userAgent', original)
})

describe('isMobileBrowser', () => {
  it('matches phones', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    expect(isMobileBrowser()).toBe(true)
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    expect(isMobileBrowser()).toBe(true)
  })

  it('matches a literal iPad UA, as in-app WebViews report', () => {
    // Desktop-mode iPad Safari says Macintosh; WebViews and "Request Mobile
    // Website" still say iPad, and used to get no wallets registered.
    setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')
    expect(isMobileBrowser()).toBe(true)
  })

  it('does not match a desktop browser', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    expect(isMobileBrowser()).toBe(false)
  })
})
