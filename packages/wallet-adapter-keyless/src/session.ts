const RETURN_TO_KEY = 'keyless_return_to'
const JWT_KEY = 'keyless_jwt'

/** Save the path the user was on before redirecting to Google. */
export function saveReturnTo(path: string): void {
  sessionStorage.setItem(RETURN_TO_KEY, path)
}

/** Read and clear the saved return path. */
export function takeReturnTo(): string | null {
  const v = sessionStorage.getItem(RETURN_TO_KEY)
  if (v !== null) sessionStorage.removeItem(RETURN_TO_KEY)
  return v
}

/** Save the JWT for rehydration on page reload within EPK lifetime. */
export function saveJwt(jwt: string): void {
  sessionStorage.setItem(JWT_KEY, jwt)
}

/** Read and clear the saved JWT. */
export function takeJwt(): string | null {
  const v = sessionStorage.getItem(JWT_KEY)
  if (v !== null) sessionStorage.removeItem(JWT_KEY)
  return v
}
