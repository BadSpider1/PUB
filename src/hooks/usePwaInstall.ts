import { create } from 'zustand'

/** Chromium-only event fired when the app is installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallState {
  promptEvent: BeforeInstallPromptEvent | null
  installed: boolean
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const usePwaInstall = create<InstallState>(() => ({
  promptEvent: null,
  installed: typeof window !== 'undefined' && isStandalone(),
}))

/**
 * Must run before React renders: `beforeinstallprompt` can fire very early during page load.
 * Called from main.tsx.
 */
export function capturePwaInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    usePwaInstall.setState({ promptEvent: event as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => usePwaInstall.setState({ promptEvent: null, installed: true }))
}

export async function promptPwaInstall(): Promise<void> {
  const event = usePwaInstall.getState().promptEvent
  if (!event) return
  await event.prompt()
  const { outcome } = await event.userChoice
  usePwaInstall.setState({ promptEvent: null, installed: outcome === 'accepted' })
}

/** iOS/iPadOS Safari has no install prompt – users must use Share → Add to Home Screen. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}
