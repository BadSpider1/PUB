import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { capturePwaInstallPrompt } from './hooks/usePwaInstall'
import './index.css'
import { watchFinanceData } from './store/useFinanceStore'
import { storageManager } from './sync/storageManager'

capturePwaInstallPrompt()

// Tier 0 → Tiers 1/2: every committed IndexedDB change (from this tab, another tab or a sync)
// refreshes the UI store and lets the StorageManager schedule a write to the connected vaults.
watchFinanceData((data) => storageManager.handleLocalChange(data))
void storageManager.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
