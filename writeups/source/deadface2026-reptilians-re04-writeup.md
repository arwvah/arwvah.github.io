# DEADFACE CTF — Reptilians / Lizard People

**Category:** Reverse engineering  
**Artifact:** `re04-win-x64.exe`  
**Analyst:** bratxer  
**Analysis date:** 2026-10-18

## 1. Result

The password is:

```text
letmein
```

The flag is:

```text
deadface{Liz4rds_L0ve_Krampuffs_for_some_odd_reason...}
```

Their favorite cereal is **Krampuffs**.

The password and decoded flag both match the MD5 values embedded in the executable. This solution uses static analysis and a reconstruction of the decoder. The Windows executable was not run, and no challenge-platform submission was performed during this analysis.

## 2. Challenge idea

The challenge asks us to reverse engineer a Lytton Labs device used to communicate with the Reptilians. We need to recover its password and identify any additional tricks before learning their favorite spooky cereal.

There are two linked obstacles: an MD5 password check and a hardware-breakpoint trap. The trap sets a value needed for decryption, but also redirects execution away from the decoder. Bypassing the trap entirely therefore does not solve the challenge.

## 3. Identify the executable

```bash
file /home/arwah/Downloads/re04-win-x64.exe
sha256sum /home/arwah/Downloads/re04-win-x64.exe
strings -a -t x /home/arwah/Downloads/re04-win-x64.exe | rg -i 'password|deadface|cereal|lizard'
```

- `file` identifies the executable format and architecture.
- `sha256sum` records the exact artifact identity.
- `strings -a -t x` extracts printable strings and displays their hexadecimal file offsets.
- `rg -i` filters those strings without case sensitivity.

The file is a 64-bit Windows PE console executable, 148,992 bytes long, with six sections.

```text
SHA-256:
e92ec049af8451b6e293c388c8ef504b3a8fa0598bb078f1a678904332ae6a7b
```

The prompt `What is the password: ` appears at file offset `0x17790`, corresponding to virtual address `0x140018d90`. Ghidra's cross-reference to this string leads to `0x14000139b`, inside the main challenge function beginning at `0x140001120`.

File offsets locate bytes in the EXE on disk. Virtual addresses describe where those bytes are mapped in the program image; they are not interchangeable.

## 4. Recover the password

The main function reads input into a 128-byte buffer, removes the line terminator, and hashes the resulting password. The hash implementation uses the familiar MD5 initial state:

```text
67452301 efcdab89 98badcfe 10325476
```

After hashing, it compares the 16-byte digest as two 64-bit integers. In simplified pseudocode:

```c
if (digest_low  == 0x0ce4bbf5097d100d &&
    digest_high == 0xb7e9e9715cded3ad) {
    decode_flag(password);
} else {
    failure();
}
```

The second constant appears as `-0x4816168ea3211c53` in the decompiler's signed representation. Its unsigned 64-bit representation is `0xb7e9e9715cded3ad`.

Because x86-64 stores these integers in little-endian byte order, the actual MD5 digest is:

```text
0d107d09f5bbe40cade3de5c71e9e9b7
```

The candidate `letmein` matches it exactly:

```bash
printf letmein | md5sum
```

Expected output:

```text
0d107d09f5bbe40cade3de5c71e9e9b7  -
```

`printf` avoids adding a newline, so this hashes the same password bytes that the program checks. A large password-cracking run was unnecessary.

## 5. Understand the hardware-breakpoint trap

Before asking for the password, the main function registers a vectored exception handler and starts a helper thread. A vectored exception handler is a callback Windows can invoke when a process encounters an exception.

Important locations:

| Address | Role |
| --- | --- |
| `0x140001120` | Main challenge function and password check |
| `0x140001070` | Helper thread that installs the breakpoint |
| `0x140001000` | Vectored exception handler |
| `0x140001100` | Failure-message function |
| `0x140001ad0` | Flag decoder and plaintext hash check |
| `0x140024aa8` | Global containing the decoder address |
| `0x140024ab0` | Global salt used by the decoder |

The helper suspends the main thread and modifies its debug-register context:

```c
context.Dr0 = 0x140001ad0;
context.Dr7 = 1;
```

`DR0` holds a hardware-breakpoint address. Setting `DR7` to `1` enables the first breakpoint locally, with an execution-breakpoint configuration. The helper then resumes the main thread.

When a correct password causes execution to reach the decoder, the breakpoint can raise `EXCEPTION_SINGLE_STEP` (`0x80000004`). The handler checks that exception code, the first breakpoint status bit in `DR6`, and the saved instruction pointer.

When those conditions match, it performs these critical operations:

```c
salt = 0xd1cefa11badc0de5;
context.Rip = 0x140001100;  // Redirect to failure()
context.Dr6 = 0;
return EXCEPTION_CONTINUE_EXECUTION;
```

`RIP` is the instruction pointer: changing its saved value changes where execution resumes.

This explains the trick. The handler supplies the required salt, then sends execution to the failure function. If we simply disable the breakpoint before it triggers, the salt remains zero and the decoder produces incorrect bytes. The static solution preserves the handler's salt while reconstructing the decoder independently of that redirection.

## 6. Reconstruct the flag decoder

The function at `0x140001ad0` hashes the password again. It initializes a 64-bit state using the first eight digest bytes interpreted in little-endian order:

```text
state = 0x0ce4bbf5097d100d XOR 0xd1cefa11badc0de5
```

The executable also supplies a fallback state of `0x9e3779b97f4a7c15` if that XOR result is zero. That branch is not needed for this password and salt.

The ciphertext is 55 bytes long and begins at virtual address `0x1400185a0`. The PE section mapping gives its file offset:

```text
.rdata virtual address: 0x140018000
.rdata file offset:     0x16a00
ciphertext file offset: 0x16a00 + (0x1400185a0 - 0x140018000)
                      = 0x16fa0
```

For each ciphertext byte, the decoder updates its state using a xorshift generator:

```text
state ^= state << 13
state ^= state >> 7
state ^= state << 17
plaintext[i] = ciphertext[i] XOR (state & 0xff)
```

The left-shift operations must wrap to 64 bits. JavaScript BigInt does not overflow automatically, so the solver explicitly truncates them.

The final left shift does not change the low eight bits, which explains why the optimized decompilation sometimes uses the intermediate value for the XOR byte.

After decryption, the program hashes all 55 plaintext bytes and checks for:

```text
5d02e679a7bfae73f997e7d4ddfa8c12
```

Our decoded flag matches that embedded digest exactly. Decoding with a zero salt instead produces invalid text and a different digest, confirming why the handler's state change matters.

## 7. Reproducible solver

Save the following as `re04-solve.cjs`. It reads the original executable, checks its SHA-256, verifies the password, decodes the flag, and verifies the plaintext hash. It does not execute or modify the EXE.

```javascript
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const path = process.argv[2] || '/home/arwah/Downloads/re04-win-x64.exe';
const binary = fs.readFileSync(path);
const md5 = data => crypto.createHash('md5').update(data).digest('hex');

assert.equal(
  crypto.createHash('sha256').update(binary).digest('hex'),
  'e92ec049af8451b6e293c388c8ef504b3a8fa0598bb078f1a678904332ae6a7b'
);

const password = 'letmein';
assert.equal(md5(password), '0d107d09f5bbe40cade3de5c71e9e9b7');

let state = 0x0ce4bbf5097d100dn ^ 0xd1cefa11badc0de5n;
const output = Buffer.alloc(55);

for (let i = 0; i < output.length; i++) {
  state = BigInt.asUintN(64, state ^ (state << 13n));
  state ^= state >> 7n;
  state = BigInt.asUintN(64, state ^ (state << 17n));
  output[i] = binary[0x16fa0 + i] ^ Number(state & 255n);
}

assert.equal(md5(output), '5d02e679a7bfae73f997e7d4ddfa8c12');
console.log('Password:', password);
console.log('Flag:', output.toString('ascii'));
```

The solver created during analysis is available at `/home/arwah/Downloads/re04-solve.cjs`:

```bash
node /home/arwah/Downloads/re04-solve.cjs /home/arwah/Downloads/re04-win-x64.exe
```

Verified output:

```text
Password: letmein
Flag: deadface{Liz4rds_L0ve_Krampuffs_for_some_odd_reason...}
Both embedded MD5 checks passed. Original EXE was not executed.
```

## 8. Evidence and lessons

Ghidra 12.1.4, accessed through REA, supplied the main-function and decoder pseudocode. `objdump` independently exposed the exception handler's instructions, including the salt assignment and saved-RIP replacement. Node.js reconstructed the decoder and checked both hashes.

Key retained analysis identifiers from the analysis session:

- Main function: `ev_bf81cb21d1fbbdc634acaecaa92e48d00383ebac282078ae421b6adaa1bb61b1`
- Decoder: `ev_307e9a5866660360cd33977726d1d9ace71e66b51c7f19b06cf656c707c8467a`
- Breakpoint helper: `ev_2287d02e0ae882098e0e739b12f8b5474ee6d3b2199c8291752d8c7ee2a4a068`

These identifiers describe session observations; the self-contained reproduction is the original artifact plus the solver above.

The main lesson is to follow both control flow and data changes. An exception handler can block the success path while also providing information that path needs. Removing the diversion without understanding the salt would leave the puzzle unsolved.
