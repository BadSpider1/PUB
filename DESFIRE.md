Good, this confirms the landscape. Here's a realistic phased roadmap — with a note up front: there's no plug-and-play "DESFire EV3 for ESP32" library, so a chunk of this project is building your own DESFire command layer on top of raw APDUs. That's normal for this space and very doable, just budget time for it.
Phase 0 — Hardware & plumbing (few days)

Wire PN532 to ESP32 over SPI (most reliable, fastest, avoids the UART baud-rate headaches people hit with HSU on ESP32).
Get the Adafruit PN532 Arduino library working: nfc.begin(), nfc.SAMConfig(), read UID with readPassiveTargetID.
Known gotcha for later phases: the default PN532_PACKBUFFSIZ (64 bytes) is too small for DESFire APDUs/CMAC frames, and the default inDataExchange timeout (1000ms) is too short for crypto operations on the card. You'll need to bump the buffer to ~255 bytes and the timeout to ~5000ms in the library source. Good to know now rather than debugging mystery failures later.
Milestone: reliably detect a card and print its UID every time, including 7-byte UIDs (DESFire cards use 7-byte UIDs).

Phase 1 — Basics: NDEF read/write (a week or so)
Do this on cheap NTAG213/215/216 tags or Mifare Ultralight first — it's a much gentler intro to tag memory models than DESFire.

Understand the NDEF message format (TLV structure, record header, type/payload).
Write a URI record (the "writing links" use case) — NDEF has a compact URI record type with prefix abbreviation codes (e.g. 0x03 = "https://").
Read back and parse NDEF from a tag.
Milestone: your ESP32 can write a URL to a blank NTAG and a phone can tap it and open the link.

Phase 2 — DESFire fundamentals, no security yet (1–2 weeks)
This is where you switch from "canned tag library" to "raw APDU exchange" via inDataExchange.

Learn the DESFire object model: PICC → Applications → Files (standard data, backup data, value, linear record, cyclic record files).
Implement the basic native command set wrapped in ISO 7816 APDUs: GetVersion, SelectApplication, CreateApplication, CreateStdDataFile, WriteData, ReadData, GetApplicationIDs, FormatPICC.
Do all of this against the default factory key (all-zero DES key) with no authentication enforced — i.e., plaintext communication mode. This mirrors the "beginner tutorial" approach and lets you validate your APDU framing/parsing before crypto enters the picture.
Milestone: create an application and file on a blank DESFire EV3 card, write bytes to it, read them back, and successfully wipe (format) the card.

Phase 3 — Authentication (2–3 weeks)
This is the real fork in the road, since DESFire's crypto scheme changed across generations:

Legacy authentication (AuthenticateLegacy, DES/3DES) — simpler ISO/IEC 9798 challenge-response, good for understanding the concept.
EV1-style AES authentication (AuthenticateAES) — session key derivation from card + reader random numbers.
EV2/EV3 authentication (AuthenticateEV2First / AuthenticateEV2NonFirst) — adds transaction identifiers and a more robust session key derivation; this is what you actually want for EV3 since it also unlocks the newer secure messaging.
Implement AES-128 (ECB/CBC) crypto — ESP32 has hardware AES acceleration you can use via mbedTLS, which is already bundled with the Arduino-ESP32 core.
Milestone: successfully authenticate against a key you set yourself (not the default), and confirm you can distinguish an auth failure from a communication failure.

Phase 4 — Secure messaging & permissions (2–3 weeks)

Implement the three DESFire communication modes: Plain, MACed, Full enciphered (encrypted + CMAC).
Implement CMAC calculation (AES-CMAC) for command/response integrity — this is what most of the buffer-size/timeout pain in existing implementations comes from.
Learn access rights: each file has separate key slots/permissions for Read, Write, ReadWrite, and ChangeAccessRights — this is your actual "lock" mechanism at the file level.
Implement ChangeKey properly, including the required key-versioning and diversification math (XOR-diffing old/new key when changing a key other than the one you're authenticated with).
Milestone: a file that can only be read/written after AES authentication, with all traffic MACed or encrypted, and you can rotate its key without bricking it.

Phase 5 — Lock / unlock / wipe workflows (your explicit ask)
Bring together what's above into concrete operations:

Read/Write: standard/backup data file operations, authenticated + enciphered.
Wipe: FormatPICC (needs PICC master key auth) vs. deleting a single application (DeleteApplication) — decide which granularity you actually want.
Lock: set restrictive access rights on a file (e.g., write key ≠ read key ≠ change-rights key), or freeze configuration changes.
Unlock: reserved to whoever holds the correct key — this is really just "successful authentication," there's no separate unlock primitive; the security model is auth-gated access, not a physical lock state.
Milestone: a card that a normal reader can't touch without your key, and your firmware can move it between "locked" (restrictive rights) and "open" (permissive rights) states.

Phase 6 — EV3-specific top-end features (open-ended, do as needed)

Originality check: EV3 cards carry an NXP-signed ECC certificate you can verify to detect cloned/counterfeit chips (Read_Sig command + ECDSA verification against NXP's public key).
Transaction MAC / Secure Dynamic Messaging (SDM): lets a tag produce a per-tap authenticated URL for tap-to-verify use cases — relevant if "writing links" evolves into "writing tamper-evident links."
Delegated application management, proximity check (relay-attack mitigation), and larger free-memory features are the deepest EV3-only additions — nice to have, only worth it if your threat model needs them.

Practical notes that'll save you pain

Key storage on the ESP32 itself matters — if the whole point is "high security," don't hardcode keys in flash. Look at ESP32's NVS encryption/Flash Encryption + Secure Boot, or an external secure element (e.g., ATECC608), so a stolen device doesn't leak your master keys.
You'll likely end up writing (or heavily adapting) your own DESFire class rather than finding one that "just works" — the two most complete open references worth studying are the ESP32/PN532 tutorial series by AndroidCrypto and the Elmü/esup-nfc-tag DESFire.cpp implementation; both wrap inDataExchange the same way and are useful to read even if you write your own from scratch.
Test with cheap blank/test cards first and keep at least one "known good" reference card you never lock, so a mistake in phase 3–5 doesn't leave you with zero working hardware to debug against.

Want me to start you off with actual working code for Phase 0/1 (SPI init + UID read + NDEF URI write), or would you rather I sketch the APDU command set for Phase 2 first?
