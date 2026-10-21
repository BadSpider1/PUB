/** The sync target needs the user to act: re-grant folder access or sign in to Google again. */
export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncAuthError'
  }
}

/** The device is offline; the sync will be retried when connectivity returns. */
export class SyncOfflineError extends Error {
  constructor(message = 'You are offline. Changes will sync when the connection is back.') {
    super(message)
    this.name = 'SyncOfflineError'
  }
}
