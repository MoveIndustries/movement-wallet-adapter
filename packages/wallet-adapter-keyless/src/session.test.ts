import { describe, expect, it, beforeEach } from 'vitest'
import { saveReturnTo, takeReturnTo, saveJwt, takeJwt } from './session'

describe('session', () => {
  beforeEach(() => sessionStorage.clear())

  it('saveReturnTo + takeReturnTo round-trips and clears', () => {
    saveReturnTo('/demos/connect')
    expect(takeReturnTo()).toBe('/demos/connect')
    expect(takeReturnTo()).toBeNull()
  })

  it('saveJwt + takeJwt round-trips and clears', () => {
    saveJwt('eyJ...jwt')
    expect(takeJwt()).toBe('eyJ...jwt')
    expect(takeJwt()).toBeNull()
  })

  it('takeReturnTo returns null when nothing saved', () => {
    expect(takeReturnTo()).toBeNull()
  })
})
