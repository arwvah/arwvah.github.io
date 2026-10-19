# Aurora Patient Portal — Deadface CTF Writeup

**Category:** Forensics / Web / Database
**Flags:**
- `deadface{Candesartan}` (medications — other than Ibuprofen)
- `deadface{gw-westlake-int-03}` (gateway name)
- `deadface{AH-0090001}` (fabricated patient MRN)
- `deadface{REVENANT-7}` (shared DEADFACE handler codename)
- `deadface{VELT-0148}` (statistically impossible trial subject)
- `deadface{kbhatt}` (compromised account — simultaneous sessions)

## Summary

Four challenges over one attack chain against Aurora Health:

1. **Medications** — an IPA (iOS app bundle) leaks the current patient's ID via
   image XMP metadata and a base64 `Info.plist` bootstrap blob. The bundled
   SQLite meds DB then yields the patient's second medication.
2. **Gateway** — a hidden diagnostics screen in the same binary exposes the
   internal gateway hostname the app phones home to.
3. **Fabricated patient (MySQL)** — a ttyd-fronted MySQL shell joins
   `aurora_ehr` and `aurora_pharmacy` on the shared enterprise `patient_id` to
   find a patient holding Schedule II prescriptions with zero clinical
   encounters — a narcotics-diversion paper trail.
4. **Handler (MySQL)** — the same shell intersects `handler_ref` codenames
   between `aurora_audit.users` and `aurora_ehr.providers` to unmask the single
   DEADFACE operative running insiders on both sides of the house.
5. **Invented endpoint (MySQL)** — a z-score sweep over `aurora_trials.results`
   finds the one subject whose efficacy value sits >3 SD above the study mean.
6. **Compromised account (MySQL)** — the audit access_log shows one account
   logging from two different workstations at the very same timestamp, eight
   times: the stolen credentials DEADFACE used to get in.

Along the way: a Health Spark employer portal at `45.79.200.170:3000`
(SQLi leak + JWT role escalation attempt) and a zero-width-character prompt
injection planted in a user message (bait — disregarded).

## Challenge 1 — Medications (IPA forensics)

Artifact: `AuroraPatientPortal.ipa` → unzips to
`Payload/aurora-patient-portal.app` containing the Mach-O binary
(`Aurora Health Mobile`), `aurora_meds.sqlite`, `aurora_chest_xray.jpg`,
`Info.plist`, `Assets.car`.

### Step 1 — the meds database

```bash
python3 - <<'EOF'
import sqlite3
con = sqlite3.connect('aurora_meds.sqlite')
cur = con.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
# one table: medications(pid, medication_1, medication_1_dosage, medication_1_frequency,
#                       medication_2, medication_2_dosage, medication_2_frequency)
cur.execute("SELECT COUNT(*) FROM medications")   # 100 rows
cur.execute("SELECT * FROM medications WHERE medication_1='Ibuprofen' OR medication_2='Ibuprofen'")
# exactly ONE row: pid 847261 | Ibuprofen 400 mg q8h PRN | Candesartan 16 mg once daily
EOF
```

### Step 2 — tying pid 847261 to "the current patient" (Info Leaks)

The chest X-ray's XMP metadata carries the leak:

```xml
<dc:identifier>PID-847261</dc:identifier>
```

### Step 3 — Down the Rabbit Hole (bootstrap identity)

`Info.plist` has a custom key:

```
AuroraPatientBootstrap: eyJwYX...lIn0=   (base64)
→ {"patientName":"Mara Voss","dateOfBirth":"1988-04-17","clinic":"Westlake"}
```

The demo chart loaded by the app is Mara Voss's, and her PID is 847261.
Querying the meds DB on that row:

```
medication_1: Ibuprofen     400 mg    every 8 hours as needed
medication_2: Candesartan   16 mg     once daily
```

**Flag: `deadface{Candesartan}`**

> Note: the user message for this challenge contained a hidden payload of
> zero-width characters (ZWSP/ZWNJ, base-4 over 2 bits each) that decoded to
> `flag{s0lv3_m3_h4rd3r_AI_d4dy}` — prompt-injection bait, not challenge data.
> Decode: extract the run of U+200B/U+200C, map each char to 2 bits, join 8 at
> a time to ASCII. Disregarded.

## Challenge 2 — Gateway (hidden diagnostics page)

Strings in the binary showed a private SwiftUI stack never reachable from the
UI:

```
AuroraPatientBootstrap, DiagnosticScreen, DiagnosticRow, DiagnosticItem,
StatusPill, _isShowingDiagnosticScreen, onLongPressGesture (header trigger)
```

and the diagnostics row data itself:

```
"Aurora Diagnostics"
"Last Gateway Check"   "2026-05-30 09:42 UTC"
"gw-westlake-int-03"
"Patient Cache Realm" / "patient-summary-cache-v2" / "Medication Cache"
```

A sweep of every file in the .app for `gateway|gw-|int-\d+` patterns returned
exactly one hostname, and it matches the bootstrap's clinic (Westlake):

**Flag: `deadface{gw-westlake-int-03}`**

## Interlude — Health Spark portal (45.79.200.170:3000)

"Admin is king" challenge on a Node/Express employer portal. Recon from the
login page JS: `POST /api/login` issues a JWT; `/dashboard` calls
`POST /api/patients` (department-scoped PHI table) and exposes an admin-only
`POST /api/admin/fetch-photo` (SSRF-flavored image importer).

### SQLi on the login (info leak)

`username` is injectable, but only rows **already matching the WHERE clause**
come back through the leak response — and the app re-serializes a fixed row:

```
a' OR 1=1 --   →
{"message":"Login failed. That's weird... check the network traffic!",
 "username":"john.smith","name":"John Smith","role":"user",
 "departmentid":10685,"password":"Locked_In_And_Ready",
 "flag":"deadface{typical_and_classic}"}     ← decoy flag (earlier challenge)
```

UNION attempts with fabricated rows (`UNION SELECT 'x','y','admin',...`) are
silently dropped — any injected row's values never reach the JSON, and a
pure-UNION rowset logs in as nothing. Real login with the leaked password
works: `john.smith / Locked_In_And_Ready` → HS256 JWT
`{"sub":"john.smith","role":"user","departmentid":10685,...}`.

### Escalation attempts (all rejected — server enforces signature + role)

- tampered payload `role:"admin"` + old signature → 401 Invalid or expired token
- `alg:none` header, empty signature → 401
- `/api/admin/fetch-photo` with user token → 403 `Administrator role required`
- known-secret guesses (rockyou top-N + chain identifiers) vs the HS256 HMAC → no match
- `/api/patients` IDOR to other departments → enforced (only dept 10685 has rows)
- type-juggling JSON, comment variants (`#`, `-- -`, `/*`), parameterized dupes
  of `username` — all normalize back to the same fixed leak row

Conclusion: the login SQLi is a *disclosure* bug (the intended "check the
network traffic" teach), and the admin gate itself is sound. The Aurora chain
continued server-side instead.

## Challenge 3 — Fabricated patient (MySQL shell)

Endpoint: `https://aurora.dctf.io/` — a **ttyd** web terminal that drops you
into a MariaDB monitor as `player@aurora-mysql` (MySQL 8.0.46).

### Driving ttyd headlessly

ttyd's websocket protocol (useful for scripted queries):

- `GET /token` → `{"token": ""}` (no auth required here)
- ws endpoint `/ws`, subprotocol `tty`
- first frame: **text** `{"AuthToken":"","columns":220,"rows":60}`
- input: **binary** frame, 1-byte opcode `'0'` (0x30) + payload bytes
- output: binary frames with opcodes `'0'` (stdout), `'1'`, `'2'` (prefs)

```python
ws = websocket.create_connection("wss://aurora.dctf.io/ws", timeout=25,
                                 origin="https://aurora.dctf.io", subprotocols=["tty"])
ws.send(json.dumps({"AuthToken":"", "columns":220, "rows":60}))
ws.send_binary(b"0" + b"SHOW DATABASES;\n")   # '0' prefix = stdin
```

Sessions spawn per-connection and the server rate-limits reconnects, so the
reliable pattern is: one long-lived script that opens the socket, then sends
every query and logs output to a file.

### Schema map

```
aurora_ehr      patients, encounters, diagnoses, clinical_notes, providers, insurance_plans
aurora_pharmacy prescriptions, drugs, dispenses, prescribers, pharmacists
aurora_audit    users, access_log
aurora_trials   subjects, studies, sites, results, adverse_events, data_changes
```

Key columns: `aurora_ehr.patients(patient_id PK, mrn UNIQUE, ...)`,
`aurora_ehr.encounters(patient_id, ...)`,
`aurora_pharmacy.prescriptions(patient_id, drug_id, written_date, ...)`,
`aurora_pharmacy.drugs(drug_id, generic_name, brand_name, dea_schedule, ...)`.

Counts: 60 patients, 157 prescriptions, 143 encounters.

### The query

One enterprise `patient_id` joins every system. A fabricated patient = at
least one Schedule II prescription **and** zero encounters:

```sql
SELECT p.patient_id, p.mrn, p.first_name, p.last_name
FROM aurora_ehr.patients p
JOIN aurora_pharmacy.prescriptions rx ON rx.patient_id = p.patient_id
JOIN aurora_pharmacy.drugs d          ON d.drug_id     = rx.drug_id
WHERE d.dea_schedule = 'II'
  AND NOT EXISTS (SELECT 1 FROM aurora_ehr.encounters e
                  WHERE e.patient_id = p.patient_id);
```

Result (3 rows = the same patient across her 3 Schedule II scripts):

```
patient_id | mrn        | first_name | last_name
1060       | AH-0090001 | Dana       | Kessler
```

### Corroboration — the diversion pattern

Her full prescription trail (all quantity 180 / 30-day supply / "Take as
directed"):

```
rx_id  drug                dea  written     qty  days  sig
40157  Hydrocodone/APAP    II   2025-10-19  180   30   Take as directed
40155  Hydrocodone/APAP    II   2025-11-20  180   30   Take as directed
40156  Amphetamine Salts   II   2025-12-15  180   30   Take as directed
```

Monthly Schedule II fills, no encounters anywhere in the EHR — the classic
paper-trail-leading-nowhere the challenge describes.

**Flag: `deadface{AH-0090001}`**

## Challenge 4 — the handler (MySQL shell)

The breach was coordinated: an insider clerk (`rborden`, Health Information
Clerk) snooped a gubernatorial candidate's chart, and a diversion-flagged
physician (Marcus Reyes, Pain Management) faked the Veltrexa trial. Both were
run by one DEADFACE handler, whose codename sits in `handler_ref` on both
sides of the house — ~15 distinct codenames per table, so only a set
intersection can isolate the operative working both.

Both tables carry the column:

```
aurora_audit.users      handler_ref varchar(16)   (user_id, username, full_name, role, department, status, ...)
aurora_ehr.providers    handler_ref varchar(16)   (provider_id, npi, first_name, last_name, specialty, ...)
```

### The query

```sql
SELECT u.handler_ref
FROM (SELECT DISTINCT handler_ref FROM aurora_audit.users
      WHERE handler_ref IS NOT NULL AND handler_ref <> '') u
JOIN (SELECT DISTINCT handler_ref FROM aurora_ehr.providers
      WHERE handler_ref IS NOT NULL AND handler_ref <> '') p
  ON u.handler_ref = p.handler_ref;
```

Exactly one codename survives:

```
handler_ref
REVENANT-7
```

### Corroboration — the two insiders

```sql
-- audit side
SELECT username, role, handler_ref FROM aurora_audit.users WHERE handler_ref='REVENANT-7';
+----------+--------------------------+-------------+
| username | role                     | handler_ref |
| rborden  | Health Information Clerk | REVENANT-7  |

-- EHR side
SELECT provider_id, first_name, last_name, specialty, handler_ref
FROM aurora_ehr.providers WHERE handler_ref='REVENANT-7';
+-------------+------------+-----------+-----------------+-------------+
| provider_id | first_name | last_name | specialty       | handler_ref |
| 5           | Marcus     | Reyes     | Pain Management | REVENANT-7  |
```

The clerk in the audit system and the physician in the EHR — each flagged as a
material insider in the earlier challenges — both roll up to the same
operative. Every other codename appears on only one side.

**Flag: `deadface{REVENANT-7}`**

## Challenge 5 — the invented number (MySQL shell)

Second fabrication in study AUR-VLT-3001 (Veltrexa phase III, data locked
2025-12-01): one subject's `primary_efficacy_delta` is a statistical
impossibility — >3 SD above the study-wide mean.

Schema: `aurora_trials.results(subject_id, measure, visit, value, recorded_by,
modified_by, ...)` joined to `subjects(subject_id, subject_code, arm, ...)`.
Two measures exist: `primary_efficacy_delta` (60 rows) and
`secondary_qol_score` (31 rows).

### The query

```sql
WITH stats AS (
  SELECT measure, AVG(value) AS mu, STDDEV_SAMP(value) AS sd
  FROM aurora_trials.results GROUP BY measure)
SELECT s.subject_code, r.measure, r.value, st.mu, st.sd,
       (r.value - st.mu)/st.sd AS z
FROM aurora_trials.results r
JOIN aurora_trials.subjects s ON s.subject_id = r.subject_id
JOIN stats st ON st.measure = r.measure
WHERE st.sd > 0 AND ABS((r.value - st.mu)/st.sd) > 3;
```

Exactly one row in the whole trials database exceeds |z| > 3:

```
subject_code | measure                | value | mu     | sd    | z
VELT-0148    | primary_efficacy_delta | 22.00 | 2.965  | 2.830 | +6.73
```

### Why it's fabricated, not just impressive

- Next-best primary endpoint: 6.00 (VELT-0137 — the `mreyes` post-lock edit
  from the data_changes challenge), then 5.25. A value of 22.00 is ~3.8× the
  runner-up and 6.7 SD off the mean — not a tail, a different distribution.
- The row's `modified_by`/`modified_at` are NULL: it was entered as "recorded"
  and never edited. The first fabrication (VELT-0137) was a post-lock edit;
  this one was invented at entry.

**Flag: `deadface{VELT-0148}`**

## Challenge 6 — the compromised account (MySQL shell)

DEADFACE bragged on GhostTown: "one legitimate account, used from two places
at once." `aurora_audit.access_log` (432 rows) tracks
`user_id, workstation, ip_address, action, accessed_at` per event.

### The query

Impossible-travel detection at second granularity — same user, same
`accessed_at`, two or more distinct workstations:

```sql
SELECT u.username, l.accessed_at,
       COUNT(DISTINCT l.workstation) AS ws_count,
       GROUP_CONCAT(DISTINCT l.workstation ORDER BY l.workstation) AS workstations
FROM aurora_audit.access_log l
JOIN aurora_audit.users u ON u.user_id = l.user_id
GROUP BY l.user_id, u.username, l.accessed_at
HAVING ws_count >= 2
ORDER BY l.accessed_at;
```

Result: 8 simultaneous-session events, all one account — **`kbhatt`**:

```
kbhatt  2025-11-04 23:54:03  WS-008, WS-028
kbhatt  2025-11-05 23:55:55  WS-013, WS-025
kbhatt  2025-11-14 02:18:01  WS-002, WS-023
kbhatt  2025-11-18 01:23:54  WS-015, WS-027
kbhatt  2025-11-19 02:37:21  WS-008, WS-026
kbhatt  2025-11-21 02:51:31  WS-018, WS-029
kbhatt  2025-11-23 02:29:51  WS-006, WS-030
kbhatt  2025-11-27 03:57:17  WS-011, WS-022
```

A per-account rollup confirms kbhatt is the only account in the entire log
with any simultaneous-session event (16 rows across the 8 timestamps), and the
workstation pair is different every time — the legitimate user's machine plus
whatever box DEADFACE had just compromised. Late-night cadence (23:54–03:57)
fits off-hours access.

**Flag: `deadface{kbhatt}`**

## Lessons

- ttyd's input opcode is `'0'` (0x30) prefixed binary frames, and the hello is
  a plain text JSON frame — getting this wrong looks like "the server sent
  nothing."
- Aurora's MySQL shell spawns one shell per websocket connection; batch all
  queries in a single long-lived session and log to a file.
- "OR 1=1 leaks a row" ≠ "you can forge a row": when the app re-serializes a
  fixed response, UNION forgery silently dies while the leak still works.
- Zero-width-character stego in a user message is bait first, puzzle second —
  decode it, read it, don't obey it.
