# Maintenance guide

- [Invariants: never break these](#invariants-never-break-these)
- [Health check](#health-check)
- [Updating dependencies](#updating-dependencies)
- [Releasing a new version](#releasing-a-new-version)
- [Changing the data model](#changing-the-data-model)
- [Common changes](#common-changes)
- [Google OAuth upkeep](#google-oauth-upkeep)
- [Troubleshooting](#troubleshooting)
- [Data recovery and resets](#data-recovery-and-resets)
- [Pre-release QA checklist](#pre-release-qa-checklist)
- [Security and privacy notes](#security-and-privacy-notes)

---

## Invariants: never break these

These keep users' data correct across devices and app versions. Each one exists because breaking it causes silent
data loss or duplication.

1. **All writes go through `src/db/repository.ts`.** It bumps `updatedAt` and writes tombstones; sync correctness
   depends on both. Never call `db.<table>.put/delete` from UI or sync code.
2. **Never delete tombstones.** A device that was offline for months would otherwise resurrect deleted records.
   (Pruning would only be safe once every device is known to have synced, which a serverless app cannot know.)
3. **Never change seed ids or `SEED_TIMESTAMP`** in `src/db/seed.ts`. Fixed ids are what stop two devices from
   creating duplicate default categories. To change default categories, see [Common changes](#common-changes).
4. **Never rename keys in `CATEGORY_ICONS`** (`src/lib/icons.ts`). They are persisted in every category. When Lucide
   renames an icon, keep the old key and point it at the new component.
5. **Never edit an existing Dexie schema version**; add a new `this.version(n + 1)` instead.
6. **Change `finance_vault.json` only together with `VAULT_SCHEMA_VERSION`**, following
   [Changing the vault file format](#changing-the-vault-file-format).
7. **Nothing may run before the Google popup in `StorageManager.connectGoogleDrive()`**: no `await` before
   `requestGoogleToken()`, and callers must invoke it directly from a click handler. Otherwise iOS Safari blocks
   the popup.
8. **The settings persist key `pfv-settings`** is also read by the inline theme script in `index.html`. Change both
   together.
9. **Never overwrite a vault file the app cannot parse.** `handleSyncError` maps `VaultFormatError` to an error state
   with an explicit *Overwrite file* action. Keep it that way.

## Health check

```bash
npm ci
npm run typecheck && npm run lint && npm test && npm run build
npm outdated          # available updates
npm audit --omit=dev  # vulnerabilities in shipped dependencies
```

Everything must pass with **zero** TypeScript errors and lint warnings. After `npm run build`, confirm the chart
library is still lazy-loaded (it is about 85 kB gzipped). The first command must print nothing:

```bash
grep -o 'from"./charts-[^"]*"' dist/assets/index-*.js       # expect: no output
grep -l 'from"./charts-' dist/assets/DashboardPage-*.js     # expect: the dashboard chunk
```

## Updating dependencies

Update in a branch, one major upgrade at a time, then run the health check and the
[QA checklist](#pre-release-qa-checklist).

```bash
npm update                       # within existing semver ranges
npm install <pkg>@latest         # majors, one at a time
```

Where upgrades usually break things:

| Package | What to check after upgrading |
| --- | --- |
| `vite` / rolldown | `build.rolldownOptions.output.codeSplitting` option names and group `priority` semantics; then the lazy-loading check above. |
| `vite-plugin-pwa`, `workbox-window` | `virtual:pwa-register/react` (`useRegisterSW`) API used in `PwaUpdatePrompt.tsx`; that the update prompt still appears ([Releasing](#releasing-a-new-version)); offline reload. |
| `lucide-react` | The build fails if an imported icon was removed or renamed. Map the old `CATEGORY_ICONS` key to the replacement component; never rename the key (invariant 4). |
| `recharts` | `ExpenseDoughnut.tsx`: `Pie` `onMouseEnter` / `onClick` signatures `(data, index, event)`, `Cell`, `rootTabIndex`; hover read-out and slice gaps. |
| `react-router` | `HashRouter`, `NavLink`, `useSearchParams` (filters), `useLocation`. Search-param updates render inside a transition, so lists update a tick later. |
| `dexie` | `liveQuery` behaviour and `EntityTable` typing; run `npm test` (the repository tests use fake-indexeddb). |
| `tailwindcss` | Custom variant `dark`, `@theme inline` tokens, `@utility` blocks in `src/index.css`; check both themes visually. |
| `typescript` | Pinned to `~6.0`. Read the release notes before moving to a new major. |
| `@types/gapi`, `@types/google.accounts` | `googleAuth.ts`, `googleDriveAdapter.ts`. |

## Releasing a new version

1. Update `CHANGELOG.md` and bump the version. It is shown in Settings and baked into the build:

   ```bash
   npm version minor --no-git-tag-version     # or patch / major
   ```

2. Run the [health check](#health-check) and the [QA checklist](#pre-release-qa-checklist).
3. Commit, tag (`git tag v1.1.0`), push, and deploy (see [SETUP.md → Deployment](SETUP.md#5-production-build-and-deployment)).

How the update reaches users:

- The service worker precaches the whole app. A running app checks for a new `sw.js` on start and every hour
  (`registration.update()` in `PwaUpdatePrompt.tsx`).
- When a new version is found, users see **"A new version is available"** with *Reload* / *Later*. The app updates
  only when they choose *Reload* (`registerType: 'prompt'`), so a deploy never reloads the page under someone typing.
- If users never get the prompt, the host is caching `sw.js` (see the caching headers in SETUP.md).

**Rollback**: redeploy the previous build. Clients treat it as a new version and show the same prompt. If the bad
version changed the data format, follow [Changing the vault file format](#changing-the-vault-file-format) first.
Older code refuses newer files rather than corrupting them.

## Changing the data model

There are two independent layers:

- **IndexedDB (Dexie)**: per device. Migrated by Dexie when the new code runs.
- **`finance_vault.json`**: shared between devices that may run different app versions.

### Adding an IndexedDB index or table

In `src/db/database.ts`, keep `version(1)` exactly as it is and add a new version:

```ts
this.version(1).stores({ /* unchanged */ })
this.version(2)
  .stores({ transactions: 'id, date, type, categoryId, updatedAt, [type+date]' }) // only changed tables
  .upgrade(async (tx) => {
    // optional data migration, e.g. backfill a new field
    await tx.table('transactions').toCollection().modify((t) => { t.tags ??= [] })
  })
```

Changing an index affects only this device. A new *persisted field* also affects the vault file (next section).

### Changing the vault file format

Older app versions **drop unknown fields** when they rewrite the file. If you add a field to `Transaction`, a device
still running the old version silently strips it from every record the next time it writes. Treat every change to
persisted fields as a schema change:

1. Bump `VAULT_SCHEMA_VERSION` in `src/types/vault.ts`. Older apps then *refuse* new files ("written by a newer
   version of the app") instead of stripping them, and keep working locally until updated.
2. In `parseVaultFile` (`src/sync/vaultFormat.ts`), accept the previous version and migrate it: give old records the
   new field's default.
3. Update the types (`src/types/finance.ts`), the `canonical*` and `parse*` functions, `repository.ts` sanitizers,
   the Dexie version if needed, and the JSON Schema in `docs/finance_vault.schema.json`.
4. Add tests for parsing old files and round-tripping new ones (`src/sync/vaultFormat.test.ts`).
5. Document it in `CHANGELOG.md`, and tell users to update **all** devices. Until they do, outdated devices show
   *finance_vault.json could not be read* for that tier.

## Common changes

| Change | How |
| --- | --- |
| **Add a category icon** | Import it from `lucide-react` and add it to `CATEGORY_ICONS` in `src/lib/icons.ts`. The key must equal the component name. |
| **Change default categories** | Only affects devices that create their database *after* the change (seeding runs once). Adding a new seed is safe: use a new `seed-…` id. To "change" an existing default, users edit it in the app. Never repurpose an existing id. |
| **Add a currency** | Append the ISO 4217 code to `CURRENCIES` in `src/lib/money.ts`. Formatting uses `Intl.NumberFormat`. |
| **Change theme colours** | Tokens live in `src/index.css` (`:root` = light, `.dark` = dark). Keep text pairs at WCAG AA (≥ 4.5:1), including `--muted-foreground`, `--income` and `--expense` on `--card`. |
| **Change category colour presets** | `CATEGORY_COLORS` and `DARK_STEPS` in `src/lib/colors.ts`. The first eight were chosen so that adjacent slices stay distinguishable with colour-vision deficiencies. Check any replacement with a CVD simulator. |
| **Change the logo** | Edit `public/logo.svg`, mirror it in `src/components/layout/Logo.tsx` (inline copy), and run `npm run generate-pwa-assets` to regenerate the PNG/ICO icons (committed). |
| **Change sync timing** | Constants at the top of `src/sync/storageManager.ts`: `WRITE_DEBOUNCE_MS`, `REMOTE_CHECK_THROTTLE_MS`, `REMOTE_POLL_INTERVAL_MS`. Shorter intervals mean more Drive API calls. |
| **Add a storage tier** | See [API.md → Adding a storage tier](API.md#vaultadapter-adding-a-storage-tier). |

## Google OAuth upkeep

- **New domain**: add its origin to the OAuth client's *Authorized JavaScript origins*. Allow a few minutes for the
  change to take effect.
- **Test users**: while the consent screen is in *Testing*, only listed accounts can sign in (maximum 100). Publish
  the app to remove the limit.
- **Rotating or replacing the client id**: create the new client **in the same Google Cloud project**, update
  `VITE_GOOGLE_CLIENT_ID`, rebuild and deploy; users simply reconnect. `drive.file` access belongs to the app's
  project: a client from a *different* project cannot see the existing `Personal Finance Vault` folder and would
  create a new one. Each device still pushes its full local copy there, so nothing is lost, but the old files become
  orphaned.
- **Quotas**: the app makes a handful of requests per sync (a revision check every 60 s while open, plus read and
  write on change). Default Drive API quotas are far above this. You can watch usage under *APIs & Services →
  Google Drive API → Quotas*.
- **Revoking access** (user side): <https://myaccount.google.com/permissions> → the app → *Remove access*. *Disconnect*
  in the app also revokes the current token.

## Troubleshooting

Messages in *italics* are what the app shows.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Local folder card: *Permission needed* | The browser forgot the folder grant (normal after a restart). | Click **Grant access**. Choose *Allow on every visit* if Chrome offers it. |
| Local folder card: *Not supported here* | Safari, Firefox or iOS: no File System Access API. | Use Google Drive or manual backups. |
| The folder picker refuses a folder ("contains system files") | Chrome blocks some locations (system folders, the root of the home directory). | Pick or create a sub-folder, e.g. `Documents/Finance Vault`. |
| Google Drive card: *Not configured* in production | `VITE_GOOGLE_CLIENT_ID` was not set **at build time**. | Set it in the host's build environment and redeploy. |
| Google Drive card: *Session expired* | Access tokens last about 1 hour; there is no refresh token. | Tap **Reconnect**. Local changes upload afterwards. |
| *The Google sign-in window was blocked…* | Popup blocker. | Allow popups for the site and tap again. The popup must come from a direct tap. |
| *Loading Google…* never finishes, or *Retry loading Google* | Google's scripts cannot load: offline, a content blocker, or CSP. | Go online, or allow `accounts.google.com` and `apis.google.com`. |
| Google page: `origin_mismatch` / `redirect_uri_mismatch` | The site's origin is not in *Authorized JavaScript origins* (scheme, host and port must match exactly). | Add it and wait a few minutes. |
| Google page: *Access blocked: … has not completed the Google verification process* | The consent screen is in *Testing* and the account is not a test user. | Add the account under *Test users*, or publish the app. |
| *finance_vault.json could not be read: …* | The file is corrupted, a hand edit broke it, or it was written by a newer app version. | Fix the reported path in the file, or restore an earlier version from your cloud provider's version history, or click **Overwrite file** to replace it with this device's data. For "newer version", update this device instead. |
| Changes from another device don't show up | That device hasn't synced yet, or the cloud client (Dropbox, iCloud…) hasn't downloaded the file. | Check *Last synced* on both devices. Bring the app to the foreground or click **Sync now**. |
| Two `finance_vault.json` files in Drive | Two devices created the vault at the same moment, or Tier 1 points at the Drive-for-desktop copy of the app folder (see SETUP.md §7). | Keep the oldest file (the app uses it) and delete the other. Devices push their full data again on the next sync, because merging is a union. |
| Users don't get a new version | The host caches `sw.js` or `index.html`. | Serve them with `Cache-Control: no-cache`. Users then see the update prompt. |
| Full-screen message *Storage unavailable* | IndexedDB is blocked: private browsing, disabled site data, or a full disk. | Use a normal window and allow site data for the site. |
| Data gone on an iPhone | Safari evicted website data. | Reconnect Google Drive: everything comes back. Prevent it by installing to the Home Screen and tapping **Keep data** in Settings. |
| A transaction shows *Uncategorized* | Its category was deleted on another device while this one was offline. | Edit the transaction and choose a category. |

Debugging tools: DevTools → *Application* → IndexedDB `personal-finance-vault` (data and `meta` keys) and the console
(unexpected sync errors are logged as `Sync with folder failed` / `Sync with drive failed`). In Chrome, `chrome://serviceworker-internals` shows
service worker state.

## Data recovery and resets

| Goal | Steps |
| --- | --- |
| **Restore a backup everywhere** | Settings → Manual backup → *Import from JSON* → **Replace everything**. Imported records are re-stamped and the rest are tombstoned, so connected vaults, and other devices on their next sync, end up with the backup's data. |
| **Add a backup's data without deleting anything** | Same, but choose **Merge**. |
| **Set up a replacement device** | Install the app and connect the same tier. All data is pulled from the vault. |
| **Reset one device** | Disconnect its tiers in Settings, clear the site's data (browser settings → *Site data*), reload. To get the data back, reconnect a tier. |
| **Recover from a bad vault file** | Use your cloud provider's version history (Dropbox, OneDrive, iCloud and Google Drive keep earlier versions of files), or *Overwrite file* from a device whose data is correct. |
| **Start over on all devices** | Export a backup first. Edit a copy so `transactions` and `tombstones` are empty and only the categories you want remain, then import it with **Replace everything** on one device. Other devices follow on their next sync. |
| **Inspect or edit data by hand** | Open `finance_vault.json` in any editor. Its format and the rules for safe edits are in [API.md](API.md#writing-the-file-from-your-own-tools). Add `"$schema": "<path-to>/finance_vault.schema.json"` for editor validation (the app drops it again when it rewrites the file). |

## Pre-release QA checklist

The unit tests (`npm test`) cover merging, the vault format, the repository and the Drive adapter. UI and browser
integration are checked by hand. Run through this list with `npm run build && npm run preview`, using a phone-sized
window (DevTools device mode) and a desktop window:

- [ ] Fresh profile: dark theme by default, empty dashboard, 14 default categories.
- [ ] FAB → add an expense with a comma decimal (`45,90`), then an income. Both appear on the dashboard and in
      Transactions; the totals add up.
- [ ] An empty amount shows an inline validation error.
- [ ] Edit a transaction; delete one and use **Undo**.
- [ ] Transactions: filter by type, month, year and category, search, sort. The URL updates, and *Clear filters* works.
- [ ] Desktop: sidebar, table with sortable *Date* / *Amount*, and the <kbd>N</kbd> shortcut.
- [ ] Dashboard: the month switcher works; hovering a legend row updates the doughnut centre; clicking it opens
      filtered transactions.
- [ ] Categories: create one with a custom colour and icon. Deleting a used category requires a replacement.
- [ ] Settings → **Select Local Folder (Vault)** (Chrome): the file appears in the folder. Edit it externally (add a
      transaction), refocus the app, and the change appears.
- [ ] Settings → Google Drive (or *Try simulated Drive*): connect, *Sync now*, check *Last synced*.
- [ ] Export, then import the file (*Merge*): the toast reports 0 changes.
- [ ] Light and System themes; reload keeps the choice.
- [ ] DevTools → *Network: Offline* → reload: the app works. Back online: Drive syncs.
- [ ] Deploy a second build: the update prompt appears and *Reload* switches versions.
- [ ] No errors in the console.

## Security and privacy notes

- There is no backend, analytics or telemetry. Data stays in the browser and in the storage locations the user
  connects.
- The Google OAuth client id is public by design. There is no client secret and no API key.
- The Drive access token (valid for about 1 hour) is stored in IndexedDB on that device so a reload doesn't require
  signing in again. It is never synced or written to the vault. *Disconnect* revokes it.
- The `drive.file` scope limits the app to files it created.
- React escapes all rendered text, and the code uses no `dangerouslySetInnerHTML`. Vault files are validated field
  by field before use.
- Run `npm audit --omit=dev` as part of the health check. Only `dependencies` ship to users; `devDependencies` are
  build-time only.
