# Setup guide

- [1. Development setup](#1-development-setup)
- [2. Configuration](#2-configuration)
- [3. Google Drive (Google Cloud setup)](#3-google-drive-google-cloud-setup)
- [4. Testing on real phones during development](#4-testing-on-real-phones-during-development)
- [5. Production build and deployment](#5-production-build-and-deployment)
- [6. Verifying a deployment](#6-verifying-a-deployment)
- [7. Setting up sync across your devices](#7-setting-up-sync-across-your-devices)

---

## 1. Development setup

Prerequisites: **Node.js 22.12 or newer** (required by Vitest; Vite itself needs 20.19+), npm 10+, and Git.
Use a Chromium-based browser (Chrome, Edge) for development: it supports every storage tier.

```bash
git clone https://github.com/BadSpider1/PUB.git personal-finance-vault
cd personal-finance-vault
npm ci              # exact versions from package-lock.json
npm run dev         # http://localhost:5173
```

Before committing, run the same checks a release runs:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Things that behave differently in `npm run dev`:

- The service worker is **disabled** (no offline mode, no install prompt, no update prompt). Use
  `npm run build && npm run preview` (http://localhost:4173) to test PWA behaviour.
- Each dev port is its own origin with its own IndexedDB, so data in `:5173` and `:4173` is separate.

Inspect local data in DevTools → **Application**: IndexedDB `personal-finance-vault` (tables `categories`,
`transactions`, `tombstones`, `meta`) and Local storage `pfv-settings`. The storage keys are listed in
[API.md](API.md#local-storage-keys).

## 2. Configuration

Configuration uses Vite environment variables, read **at build time** and compiled into the bundle. Copy
`.env.example` to `.env.local` (git-ignored) or set them in your CI/host.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | No | empty | OAuth Web client id for Google Drive sync. Without it, the Drive card shows *Not configured* and offers a simulated Drive. |
| `VITE_BASE_PATH` | No | `/` | Public path when the app is served from a sub-directory, e.g. `/my-repo/` for GitHub Pages. Needs a leading and trailing slash. |

Changing a variable requires restarting `npm run dev` or rebuilding. Both values are public; never put secrets in
`VITE_*` variables.

Device preferences such as theme and currency are not configuration. Each user sets them in **Settings →
Preferences**.

## 3. Google Drive (Google Cloud setup)

This takes about 5 minutes and is free. The app requests only the `drive.file` scope, which means it can see only
the files it created itself.

1. **Project**: open the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. **Enable the API**: *APIs & Services → Library* → search for **Google Drive API** → *Enable*.
3. **Consent screen**: *APIs & Services → OAuth consent screen* (shown as *Google Auth Platform* in newer consoles).
   - *Branding*: app name (e.g. "Personal Finance Vault"), support email, developer contact.
   - *Audience*: **External**. While the app is in *Testing*, add every Google account that will sign in under
     **Test users**.
   - *Data access*: add the scope `https://www.googleapis.com/auth/drive.file`.
4. **Client id**: *APIs & Services → Credentials → Create credentials → OAuth client ID*.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: one entry per origin, written as scheme + host + optional port, with no path
     and no trailing slash:
     - `http://localhost:5173` (dev)
     - `http://localhost:4173` (preview)
     - `https://your-domain.example` (production). For GitHub Pages use `https://<user>.github.io`, without the
       repository path.
   - **Authorized redirect URIs**: leave empty. The app uses the popup token flow.
5. **Configure the app**: put the client id into `.env.local` (or your host's build environment) and restart or
   rebuild:

   ```bash
   VITE_GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
   ```

6. **Try it**: Settings → Google Drive → **Sync with Google Drive**. A Google popup asks for consent, then the app
   creates `My Drive/Personal Finance Vault/finance_vault.json`.

Good to know:

- Changes to origins can take a few minutes to take effect at Google.
- *Testing* mode allows up to 100 test users. To let anyone sign in, publish the app (*Audience → Publish app*).
  Because `drive.file` is a non-sensitive scope, this normally needs no security review. Google may still ask you to
  verify the brand details shown on the consent screen.
- Access tokens last about one hour; browser-only apps get no refresh token. Users tap **Reconnect** when the
  session expires, and local changes are kept and uploaded afterwards.
- If you add a Content-Security-Policy, the app must be able to load scripts from `https://accounts.google.com` and
  `https://apis.google.com`, call `https://www.googleapis.com`, and open Google's sign-in popup. `gapi` may also load
  Google-hosted frames, so test Drive sync with DevTools open and allow any origin reported as blocked.

## 4. Testing on real phones during development

Service workers, the folder picker and Google sign-in need a **secure context**: `https://` or `http://localhost`.
`npm run dev -- --host` makes the dev server reachable at `http://192.168.x.x:5173`, but that is *not* a secure
context. There, only Tier 0 (IndexedDB) and the UI can be tested: no service worker, no folder sync, and Google
rejects non-localhost `http` origins.

For full-feature testing:

- **Android (USB)**: enable USB debugging, connect the phone, open `chrome://inspect/#devices` on the computer and
  set up **Port forwarding** `5173 → localhost:5173` (and `4173` for preview). On the phone, open
  `http://localhost:5173`. It counts as localhost, so everything works, including Google sign-in with the
  localhost origins above.
- **iPhone / iPad, or Android without a cable**: expose the preview server over HTTPS with a tunnel (for example
  Cloudflare Tunnel or ngrok), add the tunnel's `https://…` origin to the OAuth client, and open that URL. Web Inspector
  for iOS Safari is available from Safari on a Mac (*Develop* menu).
- Alternatively, deploy a preview build to your host (most hosts create preview URLs per branch) and add its origin
  to the OAuth client.

## 5. Production build and deployment

```bash
npm ci
VITE_GOOGLE_CLIENT_ID=… npm run build      # add VITE_BASE_PATH=/sub-path/ when needed
```

The output in `dist/` is static: HTML, JS, CSS, icons, `manifest.webmanifest`, and the service worker `sw.js` plus
`workbox-*.js`. Requirements for any host:

- **HTTPS** (mandatory for PWA, folder sync and Google sign-in).
- **No rewrite rules needed**: routing is hash-based (`/#/transactions`).
- **Caching headers**. Wrong headers here are the most common cause of "users don't get updates":

  | Path | `Cache-Control` |
  | --- | --- |
  | `sw.js`, `index.html`, `manifest.webmanifest` | `no-cache` |
  | `assets/*` and `workbox-*.js` (file names contain content hashes) | `public, max-age=31536000, immutable` |

Then add the production origin to the OAuth client's *Authorized JavaScript origins*.

### GitHub Pages

1. Repository → *Settings → Pages* → *Source*: **GitHub Actions**.
2. Optional: *Settings → Secrets and variables → Actions → Variables* → add `VITE_GOOGLE_CLIENT_ID`.
3. Add `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
         - run: npm ci
         - run: npm run lint && npm test
         - run: npm run build
           env:
             VITE_BASE_PATH: /${{ github.event.repository.name }}/
             VITE_GOOGLE_CLIENT_ID: ${{ vars.VITE_GOOGLE_CLIENT_ID }}
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

   Check for newer major versions of the actions when you add the file. For a user or organization site
   (`<user>.github.io` repository), or a custom domain, set `VITE_BASE_PATH: /`.

GitHub Pages does not let you set caching headers. Its default short cache lifetime works with the update flow.

### Netlify / Cloudflare Pages

Build command `npm run build`, publish directory `dist`, and set the environment variables in the dashboard. Both
read a `_headers` file from the published folder. To use one, create `public/_headers`:

```
/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Vercel

Framework preset *Vite*, output directory `dist`, environment variables in project settings. Add the caching
headers above through `vercel.json` → `headers`.

### Any other web server (nginx, Caddy, S3 + CloudFront…)

Serve `dist/` as static files over HTTPS with the caching headers above. Serve `.webmanifest` as
`application/manifest+json`.

## 6. Verifying a deployment

1. Open the site over HTTPS. DevTools → *Application → Manifest*: no errors, icons shown, *Installability* OK.
2. *Application → Service workers*: `sw.js` is **activated and running**. Reload once so the page is controlled.
3. *Network* → set **Offline** → reload: the app still opens and shows its data.
4. Settings → Google Drive → sign in on the production origin (this confirms the OAuth origin is registered).
5. Install the app on a phone (Android: install prompt; iPhone: Safari → Share → *Add to Home Screen*) and
   check that it opens full-screen.
6. After the next deploy, an open app should show **"A new version is available"** within an hour, or on its next
   start.

## 7. Setting up sync across your devices

Each device keeps a full copy of the data in its browser. A tier connects that copy to one `finance_vault.json`. Two
devices stay in sync when they share a tier, and any device connected to *both* tiers bridges them: it merges the
folder file and the Drive file into its own copy and writes the result back to both.

Recommended setups:

| Your devices | Setup |
| --- | --- |
| Only Chrome/Edge computers and Android phones | **Tier 1** on every device: choose the same folder inside a cloud-synced directory (Dropbox, OneDrive, iCloud Drive for Windows/macOS, Google Drive for desktop…). |
| Any iPhone/iPad, Safari or Firefox involved | **Tier 2 (Google Drive)** on every device, signed in with the same Google account. This is the simplest option and works everywhere. |
| Both, and you want a local file on your computer | Google Drive everywhere, plus **Tier 1 on one computer you use regularly**. That computer bridges the local file and Drive. |

First-time setup on each additional device:

1. Install the app (see [Installing the app](../README.md#installing-the-app)).
2. Settings → connect the same tier (pick the same folder, or sign in to the same Google account).
3. The device merges: everything from the vault appears, and anything you had already entered on that device is
   added to the vault. Default categories never duplicate, because every device creates them with the same ids.

Tips and caveats:

- **Don't point Tier 1 at the app's own Drive folder** (`My Drive/Personal Finance Vault`) through Google Drive for
  desktop. The `drive.file` scope only lets the app see files it created through the API. If the desktop client
  uploads the rewritten file as a new file, the app on your other devices cannot see it and may create a second
  `finance_vault.json`. Use a different folder for Tier 1, or let a bridge device handle it.
- After a browser restart, Chrome may ask again for folder access. The card shows **Grant access**; one click
  restores it. Choosing *Allow on every visit*, where offered, avoids this.
- Google sessions last about an hour. **Reconnect** in Settings when prompted.
- On iPhone, install the app to the Home Screen and connect Google Drive. Safari may delete website data that has
  not been used for a while, and the Drive copy makes recovery a one-tap reconnect.
- Export a JSON backup now and then (Settings → Manual backup). It is independent of every sync tier.
