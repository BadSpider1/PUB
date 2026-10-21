# API reference

Personal Finance Vault is a fully client-side app: there is **no server and no HTTP API**. What it does expose:

| Interface | Audience | Section |
| --- | --- | --- |
| `finance_vault.json`, the data file in the vault folder, Google Drive and backups | Scripts, other tools, power users | [Vault file format](#vault-file-format) |
| URLs and deep links | Bookmarks, shortcuts, automation | [URL interface](#url-interface) |
| TypeScript modules (`repository`, `storageManager`, `VaultAdapter`…) | Contributors | [Internal modules](#internal-modules) |
| Google Drive REST endpoints the app calls | Operators, security review | [External services](#external-services) |

---

## Vault file format

`finance_vault.json` is the app's data-exchange contract. The same format is used by Tier 1 (local folder),
Tier 2 (Google Drive) and Tier 3 (manual export/import).

- Machine-readable definition: [`finance_vault.schema.json`](finance_vault.schema.json) (JSON Schema 2020-12).
  It describes the canonical form the app **writes**. When **reading**, the app is more lenient (see below).
- Source of truth in code: `src/types/vault.ts`, `src/types/finance.ts`, `src/sync/vaultFormat.ts`.
- Encoding: UTF-8, pretty-printed with 2-space indentation and a trailing newline.

### Top level

| Field | Type | Notes |
| --- | --- | --- |
| `app` | `"personal-finance-vault"` | Files from other apps are rejected. |
| `schemaVersion` | `1` | Files with a higher version are rejected ("written by a newer version of the app"). |
| `exportedAt` | ISO-8601 date-time | When the file was written. Informational only; merging never uses it. |
| `data.categories` | `Category[]` | Sorted by type, then name. |
| `data.transactions` | `Transaction[]` | Sorted newest first by `date`. |
| `data.tombstones` | `Tombstone[]` | Deletion markers, oldest first. |

Ordering only aids readability. The app never depends on it.

### `Category`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string, non-empty | Unique among categories. Default categories use fixed ids such as `seed-food` (see `src/db/seed.ts`). |
| `name` | string, non-empty | Trimmed. The UI limits new names to 60 characters. |
| `type` | `"expense"` \| `"income"` | A category and its transactions always share the same type. |
| `color` | `#rrggbb` | Lower-case 6-digit hex. |
| `icon` | string | A key of `CATEGORY_ICONS` in `src/lib/icons.ts` (Lucide component name, e.g. `ShoppingCart`). Unknown names render a tag icon. |
| `createdAt` | ISO-8601 date-time (UTC) | |
| `updatedAt` | ISO-8601 date-time (UTC) | Drives conflict resolution. |

### `Transaction`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string, non-empty | Unique among transactions. The app uses UUID v4. |
| `amount` | number ≥ 0 | Major currency units, rounded to 2 decimals. Always positive: the sign comes from `type`. |
| `type` | `"expense"` \| `"income"` | |
| `categoryId` | string | Id of a category. May point to a deleted category (shown as *Uncategorized*). |
| `date` | ISO-8601 date-time (UTC) | When the transaction happened. |
| `note` | string | Free text, may be empty. |
| `createdAt` | ISO-8601 date-time (UTC) | |
| `updatedAt` | ISO-8601 date-time (UTC) | Drives conflict resolution. |

The currency is **not** stored. It is a per-device display preference.

### `Tombstone`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Id of the deleted category or transaction. |
| `entity` | `"category"` \| `"transaction"` | |
| `deletedAt` | ISO-8601 date-time (UTC) | |

### What the reader accepts

`parseVaultFile()` normalizes hand-written input instead of rejecting it, where that is safe:

| Input | Becomes |
| --- | --- |
| A bare `{ "categories": [...], "transactions": [...] }` object without the wrapper | A normal vault |
| Missing `app`, `schemaVersion`, `exportedAt` or `tombstones` | Defaults |
| Missing `createdAt` / `updatedAt` | `updatedAt` = `1970-01-01T00:00:00.000Z`; `createdAt` = `updatedAt` |
| Any date string `Date` can parse, e.g. `"2026-10-20 10:00"` | ISO-8601 UTC (date-only and space-separated strings are interpreted by the browser; prefer full ISO strings) |
| `amount` as a numeric string, negative, or with more than 2 decimals | Absolute value rounded to cents |
| Numeric `id` / `categoryId` | String |
| Colour like `EB6834`, `#ABC` | `#eb6834`, `#aabbcc` |
| Missing `icon` / `note` | `"Tag"` / `""` |
| Unknown properties (including `$schema`) | Ignored, and dropped when the app rewrites the file |

Rejected with a `VaultFormatError` that names the exact path (e.g. `transactions[3].type must be "expense" or "income".`):
invalid JSON; a missing or empty `id`, `categoryId` or category `name`; a missing or invalid colour; an invalid
`type`, `entity` or date; a missing transaction `date`; a non-numeric `amount`; and duplicate ids. **The app never overwrites a vault file it cannot read**; it shows the error
and offers an explicit *Overwrite file* action instead.

### Merge semantics

When a device syncs, it merges the file with its local data (`src/sync/merge.ts`):

1. Records are matched by `id` (categories and transactions separately).
2. The version with the later `updatedAt` wins. Exact ties are broken by comparing the records' canonical JSON, so
   every device picks the same winner.
3. A tombstone removes a record if `deletedAt >= updatedAt`. A record edited *after* its deletion survives.
4. For each id, the tombstone with the latest `deletedAt` is kept. Tombstones are never removed.

The merge is commutative and idempotent. Timestamps are compared as strings, which is correct because the app always
writes the same ISO-8601 UTC format (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### Writing the file from your own tools

The vault is designed to be edited outside the app. To make your changes merge correctly:

- **Adding** a record: use a new unique `id` and set `createdAt`/`updatedAt` to the current time.
- **Changing** a record: keep its `id` and set `updatedAt` to the current time. Otherwise the older copy on another
  device can win.
- **Deleting** a record: remove it *and* add a tombstone with `deletedAt` set to the current time. Removing it alone is
  not enough, because another device would bring it back on its next sync.
- Never delete tombstones or reuse ids.
- Write atomically (write a temporary file, then rename it over `finance_vault.json`), so the app never reads a
  half-written file.
- Running apps pick the change up when they regain focus, within about 60 seconds while visible, or on *Sync now*.

Example: append an expense with Python (standard library only):

```python
import json, os, tempfile, uuid
from datetime import datetime, timezone

VAULT = "/path/to/vault/finance_vault.json"
now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

with open(VAULT, encoding="utf-8") as f:
    vault = json.load(f)

vault["data"]["transactions"].insert(0, {
    "id": str(uuid.uuid4()), "amount": 12.5, "type": "expense", "categoryId": "seed-food",
    "date": now, "note": "Added by script", "createdAt": now, "updatedAt": now,
})

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(VAULT), suffix=".tmp")
with os.fdopen(fd, "w", encoding="utf-8") as f:
    json.dump(vault, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, VAULT)  # atomic on the same file system
```

### Versioning

`schemaVersion` changes only for incompatible changes. A newer app reads older files (migrating them in
`parseVaultFile`); an older app refuses newer files rather than corrupting them. See
[MAINTENANCE.md → Changing the vault format](MAINTENANCE.md#changing-the-vault-file-format).

---

## URL interface

The app uses hash routing, so every URL has the form `https://<host><base>#/<route>?<query>`. This works on any
static host without rewrite rules.

| Route | Page |
| --- | --- |
| `#/` | Dashboard |
| `#/transactions` | Transactions (accepts the filter parameters below) |
| `#/categories` | Categories |
| `#/settings` | Settings: storage tiers, backup, preferences, install |
| anything else | Redirects to `#/` |

**Transaction filters**, used by `#/transactions` and kept in the URL as you change them:

| Parameter | Values | Default |
| --- | --- | --- |
| `year` | four-digit year, e.g. `2026` | all years |
| `month` | `1`–`12` | all months |
| `type` | `expense`, `income` | both |
| `category` | category id, e.g. `seed-food` | all |
| `q` | search text (matches note or category name, case-insensitive) | none |
| `sort` | `date-desc`, `date-asc`, `amount-desc`, `amount-asc` | `date-desc` |

Invalid values are ignored. Examples:

- `#/transactions?year=2026&month=10&type=expense&category=seed-dining`: October 2026 dining expenses.
- `#/transactions?q=rent&sort=amount-desc`

**Quick entry**: add `new=1` to any route (`#/?new=1`) to open the *New transaction* sheet. The parameter is removed
afterwards. The installed PWA's *Add transaction* shortcut (long-press the app icon) uses this.

---

## Internal modules

For contributors. All paths are relative to `src/`; `@/` is an alias for `src/`.

### Data flow

```
UI ──writes──▶ repository ──▶ IndexedDB (Dexie)
 ▲                                  │ liveQuery (main.tsx → watchFinanceData)
 └──reads── useFinanceStore ◀───────┤
                                    └──▶ storageManager.handleLocalChange() ──▶ vault adapters
```

UI code never writes to Dexie directly. It calls `repository` and re-renders from `useFinanceStore`.

### `db/repository.ts`: data access

`repository` is `createRepository(db)`. Tests create their own instance with `createRepository(new FinanceDatabase(name))`.
All methods are async, run in Dexie transactions, and throw `Error` with a user-readable message on invalid input.

| Method | Behaviour |
| --- | --- |
| `getSnapshot(): FinanceData` | All categories, transactions and tombstones, read in one transaction. |
| `addTransaction(input): Transaction` | Validates (amount > 0, category required), rounds the amount, trims the note, normalizes the date to ISO UTC, assigns an id and timestamps. |
| `updateTransaction(id, input)` | Replaces the editable fields (`input` is a full `TransactionInput`). Throws if the transaction no longer exists. |
| `deleteTransaction(id)` | Deletes and writes a tombstone. No-op if already gone. |
| `restoreTransaction(tx)` | Undo for a delete: re-inserts the record stamped after its tombstone. |
| `addCategory(input): Category` | Validates the name (trimmed, cut to 60 characters) and lower-cases the colour. |
| `updateCategory(id, input)` | Throws when changing the `type` of a category that has transactions. |
| `deleteCategory(id, reassignToId?)` | If transactions use the category, `reassignToId` is required and must be another category of the same type; those transactions are moved first. Writes a tombstone. |
| `mergeIntoLocal(remote: FinanceData): number` | Merges another copy into the database in one read-write transaction against current state, so concurrent edits are not lost. Returns how many categories and transactions changed. |
| `replaceAll(data: FinanceData)` | Makes local data equal to `data`: re-stamps every incoming record and tombstones everything else, so the restore also wins in connected vaults. |

`stampAfter(previous)` returns "now", but never earlier than `previous + 1 ms`. Every update and deletion is stamped
with it, so a local change wins even if another device's clock ran ahead.

### `sync/storageManager.ts`: storage tiers

A singleton, `storageManager`. Sync status is published to `useSyncStore` (see below), and errors from user actions
are thrown so the caller can show them.

| Method | Behaviour |
| --- | --- |
| `init()` | Restores the remembered folder handle and Drive session, then registers focus, visibility, online and 60-second triggers. Called once from `main.tsx`. |
| `handleLocalChange(data)` | Called with every committed snapshot. Schedules a debounced (1.2 s) sync for each connected tier that has not yet seen this data. |
| `syncNow(id?: 'folder' \| 'drive')` | Immediate sync of one or all tiers, with a result toast. |
| `checkRemoteChanges(force?)` | Cheap revision check (file `lastModified`, Drive `version`); syncs if a tier changed remotely. Throttled to once per 15 s unless `force`. Also retries tiers that are offline or in a transient error state. |
| `overwriteRemote(id)` | Recovery: replace an unreadable vault file with this device's data. |
| `connectFolder()` | Opens the directory picker, requests read/write permission, stores the handle and syncs. Cancelling the picker is a no-op. |
| `reconnectFolder()` | Re-grants permission for the remembered folder after a browser restart. |
| `disconnectFolder()` | Forgets the folder. The file is left untouched. |
| `connectGoogleDrive()` | Google sign-in popup, then sync. **Must be called synchronously from a click handler**: the popup opens before the first `await`, otherwise iOS Safari blocks it. |
| `connectMockDrive()` | Uses the localStorage-backed Drive simulation. |
| `disconnectDrive()` | Revokes the token and forgets the Drive session. The Drive file is left untouched. |
| `exportJson()` | Downloads `finance_vault_backup_YYYY-MM-DD.json`. |
| `readBackup(file): VaultFile` | Parses and validates a backup file (throws `VaultFormatError`). |
| `importBackup(vault, 'merge' \| 'replace'): number` | Merge, or replace via `repository.replaceAll`. Returns the number of changed records. |

Every sync is pull → merge → push and runs through a single queue:

1. `adapter.read()`
2. `repository.mergeIntoLocal()`
3. `adapter.write()`, only if the remote content differs, compared by `fingerprint()`

### `VaultAdapter`: adding a storage tier

A tier only has to implement three methods (`sync/adapters/types.ts`):

```ts
interface VaultAdapter {
  /** Cheap change marker (mtime, version…), or null if the file does not exist. */
  getRevision(): Promise<string | null>
  /** Read and validate the vault (use parseVaultText), or null if it does not exist. */
  read(): Promise<{ vault: VaultFile; revision: string | null } | null>
  /** Create or overwrite the vault (use serializeVaultFile); return the new revision. */
  write(vault: VaultFile): Promise<string | null>
}
```

Error contract: throw `SyncAuthError` when the user must re-authorize, `SyncOfflineError` when the service is
unreachable (retried automatically), and let `VaultFormatError` from `parseVaultText` propagate for unreadable files.
Anything else is shown as a generic error. Existing implementations are `createFolderAdapter`,
`createGoogleDriveAdapter` and `createMockDriveAdapter`.

To add a tier (e.g. WebDAV or Dropbox API):

1. Implement the adapter in `sync/adapters/`, with unit tests against a fake of the service. See
   `sync/google/googleDriveAdapter.test.ts` for the pattern.
2. Add a `TargetId` and its initial status in `store/useSyncStore.ts`.
3. In `StorageManager`: add a runtime entry, `restore…` / `connect…` / `disconnect…` methods, persisted config under a
   new `meta` key, and the id to the loops in `handleLocalChange`, `syncNow` and `checkRemoteChanges`.
4. Add a card under `components/settings/` and a row in `StorageOverviewCard`, and extend `describeStorageMode`.

### `sync/vaultFormat.ts` and `sync/merge.ts`

| Export | Purpose |
| --- | --- |
| `buildVaultFile(data, exportedAt?)` | Canonical `VaultFile` (fixed key order, readable sort order). |
| `serializeVaultFile(vault)` | Pretty JSON + newline. |
| `parseVaultText(text)` / `parseVaultFile(raw)` | Validate and normalize (rules above). Throw `VaultFormatError`. |
| `fingerprint(data)` | Order-independent content hash used to skip redundant reads and writes. Change detection only; not cryptographic. |
| `canonicalCategory` / `canonicalTransaction` / `canonicalTombstone` | Strip unknown keys and fix key order. |
| `mergeFinanceData(a, b)` | Pure merge (rules above). |
| `diffLocal(local, merged)` | Puts and deletes needed to turn `local` into `merged`. |

### Stores (Zustand)

| Store | State | Actions / helpers |
| --- | --- | --- |
| `useFinanceStore` | `ready`, `error`, `categories` (sorted), `transactions` (newest first), `categoryById` | Read-only mirror of IndexedDB, filled by `watchFinanceData(onChange)`. |
| `useSyncStore` | `folder`, `drive`: `TargetStatus` (`state`, `label`, `lastSyncAt`, `error`, `canOverwriteRemote`, `mode`) | `setTargetStatus`, `isTargetConnected`, `describeStorageMode` |
| `useSettingsStore` | `theme` (`dark` default, `light`, `system`), `currency` (ISO 4217, `USD` default) | `setTheme`, `setCurrency`. Persisted as `pfv-settings` in localStorage. |
| `useUiStore` | `transactionSheet`, `toasts`, `dashboardMonth` | `openNewTransaction({ type?, categoryId? })`, `openEditTransaction(tx)`, `closeTransactionSheet()`, `toast({ title, description?, variant?, action?, durationMs? })`, `dismissToast(id)`, `setDashboardMonth(month)` |

`TargetStatus.state` is one of `unsupported`, `not-configured`, `disconnected`, `needs-permission` (folder),
`expired` (Drive), `idle`, `syncing`, `offline` or `error`.

### Local storage keys

| Where | Key | Content |
| --- | --- | --- |
| IndexedDB `personal-finance-vault` | tables `categories`, `transactions`, `tombstones` | Synced data |
| ″ | table `meta`, key `folder.handle` | `FileSystemDirectoryHandle` of the vault folder |
| ″ | `folder.lastSyncAt`, `drive.lastSyncAt` | ISO timestamps |
| ″ | `drive.config` | `{ mode: 'google' \| 'mock', account?, folderId?, fileId? }` |
| ″ | `drive.token` | `{ accessToken, expiresAt }`: short-lived Google access token (about 1 h) |
| localStorage | `pfv-settings` | Theme and currency. Also read by the inline script in `index.html`. |
| ″ | `pfv-mock-drive:finance_vault.json`, `pfv-mock-drive:revision` | Simulated Drive |

Nothing under `meta` or localStorage is synced between devices.

---

## External services

### Google Drive (Tier 2)

- Scripts loaded on demand: `https://accounts.google.com/gsi/client` (sign-in) and `https://apis.google.com/js/api.js`
  (`gapi` client).
- OAuth: Google Identity Services *token model* (popup, no redirect URI, no client secret, no refresh token).
- Scope: `https://www.googleapis.com/auth/drive.file`. The app can only access files it created, and nothing else
  in the user's Drive.
- Layout: `My Drive/Personal Finance Vault/finance_vault.json`.

Requests (all via `gapi.client.request`, authorized with the access token):

| Purpose | Request |
| --- | --- |
| Account shown in Settings | `GET https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)` |
| Find the app folder / vault file | `GET https://www.googleapis.com/drive/v3/files?q=…&fields=files(id[,version])&spaces=drive&orderBy=createdTime` |
| Validate cached ids, read the revision | `GET https://www.googleapis.com/drive/v3/files/{id}?fields=id,version,trashed` |
| Create the folder | `POST https://www.googleapis.com/drive/v3/files?fields=id` |
| Download the vault | `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` |
| Create the vault file | `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version` |
| Update the vault file | `PATCH https://www.googleapis.com/upload/drive/v3/files/{id}?uploadType=media&fields=id,version` |
| Sign out | `google.accounts.oauth2.revoke(token)` |

Error mapping:

| Drive response | Result |
| --- | --- |
| 401, or an insufficient-scope 403 | `SyncAuthError`; the card shows *Session expired* / *Reconnect* |
| Network failure (status 0) | `SyncOfflineError`; retried automatically |
| 404 on a cached id | The id is forgotten and the folder or file is searched for, or created, again |
| Other errors | `DriveApiError(status, message)`; the card shows the error |

### File System Access API (Tier 1)

The app calls `showDirectoryPicker({ id: 'finance-vault', mode: 'readwrite', startIn: 'documents' })`,
`queryPermission` / `requestPermission({ mode: 'readwrite' })`, `getFileHandle('finance_vault.json', { create })`,
`getFile()` and `createWritable()`. Revision = `lastModified:size` of the file. `NotAllowedError` / `SecurityError`
become `SyncAuthError`; the card shows *Permission needed*.
