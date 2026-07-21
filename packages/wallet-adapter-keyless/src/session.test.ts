import { describe, expect, it, beforeEach } from 'vitest'
import { saveReturnTo, takeReturnTo } from './session'

describe('session', () => {
  beforeEach(() => sessionStorage.clear())

  it('saveReturnTo + takeReturnTo round-trips and clears', () => {
    saveReturnTo('/demos/connect')
    expect(takeReturnTo()).toBe('/demos/connect')
    expect(takeReturnTo()).toBeNull()
  })

  it('takeReturnTo returns null when nothing saved', () => {
    expect(takeReturnTo()).toBeNull()
  })
})
