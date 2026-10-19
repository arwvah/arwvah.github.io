---
title: "Uninvited Guest — Writeup"
ctf: "DEADFACE CTF 2026"
category: forensics
difficulty: medium
flag_format: "deadface{...}"
author: "arwah"
---

# Uninvited Guest — Writeup

**Category:** Network Forensics (tshark)
**Artifact:** `demonne.pcap` (53,326 packets, 2026-09-28 01:05–01:24)
**Flags:**
`deadface{10.77.10.66}` · `deadface{nkessler}` · `deadface{annual_report.pdf}` ·
`deadface{167.172.132.224_4815}`

## Summary

The companion pcap to *Who Goes There?* captures the initial access: LLMNR
poisoning of the file-server name, the NTLMv2 credential leak it triggers, the
attacker relaying into the real file server, enumerating the executive share,
and finally zipping the loot out to a public IP on a nonstandard port.

## Protocol overview

```bash
tshark -r demonne.pcap -q -z io,phs
#   ssh 47634 frames, smb2 140, llmnr 160, mdns 280, nbns 2, dns 18, arp 1556
```

## Flag 1 — the poisoned answer: `10.77.10.66`

Filter the name-resolution chatter:

```bash
tshark -r demonne.pcap -Y "llmnr || nbns || mdns" \
  -T fields -e frame.number -e ip.src -e dns.qry.name -e dns.a
```

The workstation `10.77.10.20` (Nathan's box, MAC `52:54:00:77:20:01`) broadcasts
LLMNR queries for the file server `dmf-field-01`, and `10.77.10.66` (MAC
`52:54:00:77:66:01` — the rogue Kali device) answers every one of them in
~1–2 ms with the poisoned response:

```
1459  10.77.10.20  query  dmf-field-01
1463  (kali)       resp   dmf-field-01  A 10.77.10.66   <-- claiming to BE the file server
1468  10.77.10.66  resp   dmf-field-01  A 10.77.10.66   <-- ...and again, and again
```

Classic LLMNR poisoning — the "corporate" IPv4 supplying the suspicious answer:

```
deadface{10.77.10.66}
```

## Flag 2 — the leaked username: `nkessler`

The poisoned answer prompts an SMB authentication attempt straight into the
attacker's hands:

```bash
tshark -r demonne.pcap -Y "ntlmssp.auth.username" \
  -T fields -e frame.number -e eth.src -e eth.dst -e ntlmssp.auth.username -e ntlmssp.auth.domain
```

```
2326  52:54:00:77:20:01 -> 52:54:00:77:66:01  (TCP 445)  nkessler  dmf-field-01
```

Nathan's workstation sends an NTLMv2 AUTH for **nkessler** to the Kali box —
domain field helpfully set to the poisoned name `dmf-field-01`.

```
deadface{nkessler}
```

## Flag 3 — first PDF read: `annual_report.pdf`

The attacker relays to the real file server (`10.77.10.30`, DMF-FILE-01) and
enumerates the executive share; frame 6899's directory listing shows the loot
set, then files are read in sequence (SMB2 cmd 5 = Create, 16 = Query, 8 =
Read):

```
7405  01:07:31  Create  annual_report.pdf              <-- first PDF read
9088  01:07:47  Create  board_transition_timeline.pdf
9740  01:07:53  Create  succession_vote_draft.pdf
```

```
deadface{annual_report.pdf}
```

## Flag 4 — exfiltration destination: `167.172.132.224_4815`

Sum the outbound TCP from the Kali box, excluding LAN/SSH noise:

```bash
tshark -r demonne.pcap -Y "ip.src==10.77.10.66 && tcp" \
  -T fields -e ip.dst -e tcp.dstport -e tcp.len \
  | awk '$1!~/^10\./ {s[$1":"$2]+=$3} END {for (k in s) print s[k], k}' | sort -rn
#   710070  167.172.132.224:4815      <-- ~710 KB outbound, public IP
```

Confirm it really is the archive — the first data packet carries the ZIP magic:

```bash
tshark -r demonne.pcap -Y "ip.dst==167.172.132.224 && tcp.len>0" \
  -T fields -e tcp.payload | head -1
#   504b0304  ...  (PK\x03\x04)
```

```
deadface{167.172.132.224_4815}
```

## Attack chain (combined with memory evidence)

```
Kali 10.77.10.66  --LLMNR poison-->  DMF-WS11-042 (10.77.10.20)
        <-- NTLMv2 auth for nkessler --
Kali  --relay-->  DMF-FILE-01 (10.77.10.30) :445
        reads /executive: annual_report.pdf, board_transition_timeline.pdf,
        succession_vote_draft.pdf, executive_risk_register.xlsx,
        candidate_background_notes.docx
Kali  --ZIP exfil-->  167.172.132.224:4815 (710 KB)
```

The stolen document later surfaced in Ghost Town, confirming the breach —
exactly the story the two artifacts tell together.
