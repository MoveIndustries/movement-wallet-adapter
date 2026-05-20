// Inline fingerprint glyph as a data URI. No remote fetch — required because
// some hosts strip leading https references and we want this fully offline.
export const PASSKEY_ICON_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="48" height="48"><path d="M3 8a9 9 0 0 1 9-5 9 9 0 0 1 9 5"/><path d="M5 12a7 7 0 0 1 14 0v1"/><path d="M9 12c0-3 3-3 3-3s3 0 3 3"/><path d="M12 12v3.5a3.5 3.5 0 0 1-7 0v-1"/><path d="M12 12v6"/></svg>`,
  )
