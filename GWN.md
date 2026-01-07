# GWN switch – Postup a routy

Důležité:
- `BASE = https://<HOST>`
- Vše je JSON (odpovědi), requesty jsou `application/x-www-form-urlencoded`.
- Po loginu dostanete `token`
  `Authorization: <token>`  


---

## 1) Login

**Request**
- `POST {BASE}/cgi/set.cgi?cmd=home_loginAuth`
- Headers: `Content-Type: application/x-www-form-urlencoded`
- Body:
  - `username=<USER>`
  - `password=<PASS>`

**Příklad (curl)**
```bash
curl -sk -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=admin" \
  --data-urlencode "password=secret" \
  "https://<HOST>/cgi/set.cgi?cmd=home_loginAuth"
```

**Úspěch (očekávání)**
- JSON: `.code == "0"`
- token v `.data.token`

---

## 2) Výpis existujících záloh



**Request**
- `GET {BASE}/cgi/get.cgi?cmd=file_backupinfo`
- Headers: `Authorization: <token>`

**Příklad**
```bash
curl -sk \
  -H "Authorization: <token>" \
  "https://<HOST>/cgi/get.cgi?cmd=file_backupinfo"
```

**Očekávání**
- JSON obsahuje seznam v `.data.files[]`
- každá položka typicky obsahuje `bakName` a čas (např. `bakTime`)

---

## 3) Vytvořit úlohu pro vytvoření zálohy

**Request**
- `POST {BASE}/cgi/set.cgi?cmd=file_cfgbackup`
- Headers:
  - `Authorization: <token>`
  - `Content-Type: application/x-www-form-urlencoded`
- Body:
  - `fileType=running`

**Příklad**
```bash
curl -sk -X POST \
  -H "Authorization: <token>" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'fileType=running' \
  "https://<HOST>/cgi/set.cgi?cmd=file_cfgbackup"
```

**Úspěch**
- JSON: `.code == "0"`

---

## 4) Čekačka

Opakuj **2** (file_backupinfo), dokud:
- uvidíte nový `bakName` 
- jde kontrolovat i podle timestampy

---

## 5) Vytvoření linku na stažení zálohy

**Request**
- `POST {BASE}/cgi/set.cgi?cmd=file_backupdown`
- Headers:
  - `Authorization: <token>`
  - `Content-Type: application/x-www-form-urlencoded`
- Body:
  - `bakName=<BAK_NAME>`

**Příklad**
```bash
curl -sk -X POST \
  -H "Authorization: <token>" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data "bakName=<BAK_NAME>" \
  "https://<HOST>/cgi/set.cgi?cmd=file_backupdown"
```

**Úspěch (očekávání)**
- JSON: `.code == "0"`
- JSON: `.data.status == "ok"` (case-insensitive)
- cesta k souboru v `.data.filename` (např. `/tmp/<něco>`)

Výsledná URL ke stažení:
- `CFG_URL = {BASE}{.data.filename}`

---

## 6) Stažení zálohy
**Request**
- `GET {CFG_URL}`
- někdy funguje bez auth, ale bezpečné je poslat i token:

**Příklad**
```bash
curl -sk \
  -H "Authorization: <token>" \
  "https://<HOST><x>"
```


---

## 7)  Smazání zálohy z zařízení

Aby nám ty switche nepřetékali zálohama

**Request**
- `POST {BASE}/cgi/set.cgi?cmd=file_cfgdel`
- Headers:
  - `Authorization: <token>`
  - `Content-Type: application/x-www-form-urlencoded`
- Body:
  - `dstFileName=<BAK_NAME>`

**Příklad**
```bash
curl -sk -X POST \
  -H "Authorization: <token>" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data "dstFileName=<BAK_NAME>" \
  "https://<HOST>/cgi/set.cgi?cmd=file_cfgdel"
```

---

## Routy

1. `POST /cgi/set.cgi?cmd=home_loginAuth` → získej `token`
2. `POST /cgi/set.cgi?cmd=file_cfgbackup` (`fileType=running`) → spustí tvorbu zálohy
3. `GET  /cgi/get.cgi?cmd=file_backupinfo` (poll) → zjisti `bakName`
4. `GET  {BASE}{filename}` → stáhni soubor
5. `POST /cgi/set.cgi?cmd=file_cfgdel` (`dstFileName=...`) → úklid

