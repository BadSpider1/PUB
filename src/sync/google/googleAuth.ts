/**
 * Google sign-in for Tier 2 (Drive sync) using Google Identity Services (token model)
 * and the gapi JavaScript client.
 *
 * Setup: set VITE_GOOGLE_CLIENT_ID in `.env.local` – see `.env.example` for the
 * step-by-step Google Cloud Console instructions.
 *
 * Only the `drive.file` scope is requested: the app can see and edit the files it created
 * itself and nothing else in the user's Drive.
 */

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const GAPI_SCRIPT = 'https://apis.google.com/js/api.js'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
export const isGoogleDriveConfigured = googleClientId.length > 0

export interface GoogleToken {
  accessToken: string
  /** Epoch milliseconds. */
  expiresAt: number
}

const scripts = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  let promise = scripts.get(src)
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        scripts.delete(src)
        script.remove()
        reject(new Error('Could not load Google services. Check your connection.'))
      }
      document.head.appendChild(script)
    })
    scripts.set(src, promise)
  }
  return promise
}

let gapiReady: Promise<void> | null = null

/** Load the gapi client library (used for all Drive REST calls). */
export function loadGapiClient(): Promise<void> {
  gapiReady ??= loadScript(GAPI_SCRIPT)
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          gapi.load('client', {
            callback: () => resolve(),
            onerror: () => reject(new Error('Could not initialise the Google API client.')),
            timeout: 15_000,
            ontimeout: () => reject(new Error('Timed out loading the Google API client.')),
          })
        }),
    )
    // No API key / discovery docs needed: requests are authorised with the OAuth token.
    .then(() => gapi.client.init({}))
    .catch((error: unknown) => {
      gapiReady = null
      throw error
    })
  return gapiReady
}

interface PendingRequest {
  resolve: (token: GoogleToken) => void
  reject: (error: Error) => void
}

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let pending: PendingRequest | null = null
let identityReady: Promise<void> | null = null

function loadGoogleIdentity(): Promise<void> {
  identityReady ??= loadScript(GIS_SCRIPT)
    .then(() => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          const request = pending
          pending = null
          if (!request) return
          if (response.error) {
            request.reject(new Error(response.error_description || `Google sign-in failed (${response.error}).`))
          } else if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
            request.reject(new Error('Google Drive access was not granted. Please allow access to continue.'))
          } else {
            request.resolve({
              accessToken: response.access_token,
              expiresAt: Date.now() + Number(response.expires_in) * 1000,
            })
          }
        },
        error_callback: (error) => {
          const request = pending
          pending = null
          if (!request) return
          const message =
            error.type === 'popup_closed'
              ? 'The Google sign-in window was closed.'
              : error.type === 'popup_failed_to_open'
                ? 'The Google sign-in window was blocked. Allow pop-ups for this site and try again.'
                : error.message || 'Google sign-in failed.'
          request.reject(new Error(message))
        },
      })
    })
    .catch((error: unknown) => {
      identityReady = null
      throw error
    })
  return identityReady
}

/**
 * Load both Google libraries ahead of time. Call this when the Drive settings are shown so
 * that the sign-in popup can be opened synchronously from the button click later.
 */
export function preloadGoogle(): Promise<void> {
  if (!isGoogleDriveConfigured) return Promise.reject(new Error('Google Drive is not configured.'))
  return Promise.all([loadGapiClient(), loadGoogleIdentity()]).then(() => undefined)
}

export function isGoogleSignInReady(): boolean {
  return tokenClient !== null
}

/**
 * Open the Google consent/sign-in popup.
 *
 * IMPORTANT: must be called synchronously inside a click/tap handler (no `await` before it),
 * otherwise popup blockers – especially Safari on iOS – will block the window.
 */
export function requestGoogleToken(loginHint?: string): Promise<GoogleToken> {
  if (!tokenClient) {
    return Promise.reject(new Error('Google sign-in is still loading. Please try again in a moment.'))
  }
  pending?.reject(new Error('Sign-in was restarted.'))
  return new Promise<GoogleToken>((resolve, reject) => {
    pending = { resolve, reject }
    tokenClient!.requestAccessToken({ prompt: '', login_hint: loginHint })
  })
}

export function setGapiToken(accessToken: string | null): void {
  if (typeof gapi === 'undefined' || !gapi.client) return
  gapi.client.setToken(accessToken ? { access_token: accessToken } : null)
}

export function revokeGoogleToken(accessToken: string): void {
  if (typeof google === 'undefined') return
  google.accounts.oauth2.revoke(accessToken, () => undefined)
}
