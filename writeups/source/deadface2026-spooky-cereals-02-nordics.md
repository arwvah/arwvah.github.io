---
title: "Spooky Cereals 02 — Nordics"
ctf: "DEADFACE CTF 2026"
date: 2026-10-17
category: reverse
difficulty: medium
points: unknown
flag_format: "deadface{...}"
author: "arwah"
---

# Spooky Cereals 02 — Nordics

## Summary

An encrypted 7z (password `KlippyAI`) holds two sibling binaries (Linux x86 ELF + Windows x86 PE) that XOR a 256-byte "One Time Pad" against 256 bytes of data and search the output for the magic prefix `badff00d`. The shipped key is intentionally corrupted ("the key has been tampered with... TIME is REVERSIBLE, but the KEY is NOT"), and a bundled ConfuserEx-packed .NET helper (`KlippyAI`) leaks the repair: the Nordics hit Lytton Labs with Time-Reversal Rays while the key was captured — the key is byte-REVERSED. Reversing the key and re-XORing yields an ASCII banner containing the flag, written mirrored.

## Solution

### Step 1: Reverse the XOR logic in the Linux binary

`re03-lin-x86.bin` (`main` at `0x133b`) copies two `.rodata` blobs to the stack, XORs them byte-wise for 256 bytes, then calls `memmem(out, 0x100, "badff00d", 7)`. Disassembly of the check:

```asm
166d: mov DWORD PTR [ebp-0x325],0x66646162   ; "badf"
1677: mov WORD  PTR [ebp-0x321],0x3030       ; "00"
1680: mov BYTE  PTR [ebp-0x31f],0x64         ; "d"
1695: push 7 ; push 0x100 ; push out ; call memmem
16b1: jne WARNING_BRANCH                     ; found -> flag printed
```

Running it fails the check ("key has been tampered with"). The runtime buffers (dumped with gdb at the `memmem`-return, `base+0x16a1`) are the ground truth: `B1` = the 256-byte key, `B2` = the encrypted data, `B1 ^ B2` = garbage.

### Step 2: Extract the hidden hint from KlippyAI

`KlippyAI-trained-on-CK02.exe` is a ConfuserEx-packed .NET exe. Run it under Mono (user-space Arch package, plus stub symlinks for `libSystem.Native.so`), drive the menu over a pty, choose **[A] Analyze File** and give it the Linux binary. Klippy narrates:

> the Nordics were blasting Lytton Labs with time-reversal rays (TRRs)... the XOR key data is in REVERSE! If you can somehow manage to reverse the XOR key data, you should be able to recover the flag!

### Step 3: Reverse the key, XOR, read the mirrored banner

One script from buffers to flag:

```python
#!/usr/bin/env python3
"""Dump the runtime key/enc buffers with gdb, reverse the key, decode the flag."""
import subprocess

GDB = r"""
set confirm off
set pagination off
file /tmp/spooky/ck02/re03-lin-x86.bin
starti
python
import gdb
base = None
for line in gdb.execute('info proc mappings', to_string=True).splitlines():
    if 're03-lin-x86.bin' in line:
        base = int(line.split()[0], 16); break
gdb.execute('break *%d' % (base + 0x16a1))   # after memmem returns
gdb.execute('continue')
ebp = int(gdb.parse_and_eval('$ebp'))
inf = gdb.selected_inferior()
open('runtime_b1.bin','wb').write(bytes(inf.read_memory(ebp-0x21e, 0x101)))  # key
open('runtime_b2.bin','wb').write(bytes(inf.read_memory(ebp-0x31e, 0x100)))  # enc
print('dumped')
end
quit
"""
open('dbg.gdb', 'w').write(GDB)
subprocess.run(['gdb', '-q', '-x', 'dbg.gdb', '--batch'], capture_output=True)

key = open('runtime_b1.bin', 'rb').read()[:256]
enc = open('runtime_b2.bin', 'rb').read()[:256]

# The TRR tamper: the key is byte-REVERSED. Undo it.
plain = bytes(k ^ e for k, e in zip(key[::-1], enc))

# The plaintext is an ASCII banner, mirrored (box art read backwards).
s = plain.decode('latin1')
core = ''.join(c for c in s if c not in '*\n .')[::-1]
# core = feedfacedeadbeefdeadface{...}badf00dda7e4107
print(core)
print("deadface{" + core.split('{')[1].split('}')[0] + "}")
```

Output:

```
feedfacedeadbeefdeadface{N0rdics-R3ally-like-Frank3nb3rry-cuz-bro-is-tall-like-they-are!}badf00dda7e4107
deadface{N0rdics-R3ally-like-Frank3nb3rry-cuz-bro-is-tall-like-they-are!}
```

The Nordics' favorite spooky cereal is **Frank3nb3rry** (spelled with 3s — the flag contains no spaces, periods, or asterisks, per the challenge note).

## Flag

```
deadface{N0rdics-R3ally-like-Frank3nb3rry-cuz-bro-is-tall-like-they-are!}
```
