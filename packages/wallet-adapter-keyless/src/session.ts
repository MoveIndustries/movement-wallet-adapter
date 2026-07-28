const RETURN_TO_KEY = 'keyless_return_to'

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
