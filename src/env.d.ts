interface ImportMetaEnv {
  /** OAuth 2.0 Web Client ID for Google Drive sync. See .env.example. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
