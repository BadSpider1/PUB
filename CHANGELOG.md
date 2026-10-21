# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
Changes to the `finance_vault.json` format are always called out, because every device must be updated (see
[docs/MAINTENANCE.md](docs/MAINTENANCE.md#changing-the-vault-file-format)).

## [Unreleased]

### Added

- API reference (`docs/API.md`), JSON Schema for `finance_vault.json`, setup guide (`docs/SETUP.md`) and maintenance
  guide (`docs/MAINTENANCE.md`).

## [1.0.0] - 2026-10-21

### Added

- Offline-first PWA (React, TypeScript, Vite, vite-plugin-pwa) for Android, iOS/iPadOS, Windows, macOS and Linux.
- Transactions (add, edit, delete with undo; filter by month, year, type and category; search; sort) and categories
  (custom name, type, colour and icon; seeded defaults; reassignment when deleting a used category).
- Dashboard: balance, monthly income and expenses with month-over-month change, interactive spending doughnut, recent
  transactions.
- Storage tiers: IndexedDB (Dexie), local folder vault (File System Access API), Google Drive (Identity Services +
  gapi, `drive.file` scope) with a simulated Drive fallback, and manual JSON export/import.
- Sync engine: pull → merge → push with per-record last-writer-wins and tombstones.
- Mobile bottom navigation with FAB and bottom sheet; desktop sidebar and data table; dark (default), light and system
  themes.

### Vault format

- `finance_vault.json` schema version **1**.
