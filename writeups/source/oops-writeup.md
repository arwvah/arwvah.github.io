# Oops — CTF Writeup

**Author:** bratxer  
**Category:** Forensics / Git history  
**Challenge file:** `oops.rar`

> Someone panicked and cleaned up. But Git didn't :)

## Overview

The archive contained a Python project and its `.git` directory. Someone had deleted a configuration file and an encrypted secret, but both files were still available in earlier commits. Recovering them revealed the password needed to decrypt the flag.

There was also an initial obstacle: although no archive password was supplied, the RAR file was encrypted. A dictionary attack recovered its password as `pepper`.

## 1. Inspect the archive

```bash
file /home/arwah/Downloads/oops.rar
bsdtar -tf /home/arwah/Downloads/oops.rar
```

The file was identified as a RAR v5 archive. Its contents included:

```text
oops/.git/
oops/.gitignore
oops/README.md
oops/requirements.txt
oops/scraper.py
```

The `.git` directory was the main lead. It contained commit objects, branch references, and reflogs, so the files visible in the latest version were only part of the evidence.

An extraction attempt with `bsdtar` returned:

```text
Reading encrypted data is not currently supported
```

Listing the filenames did not mean the file contents were unencrypted.

## 2. Recover the RAR password

John the Ripper's `rar2john` utility extracted RAR5 password-check records. The records shared the same salt and password check, so one record was enough for this attempt.

The following commands reproduce the recovery in a separate working directory. They assume `rar2john`, `john`, `unrar`, Git, and OpenSSL are available. The wordlist path is the one used on this machine.

```bash
mkdir -p ~/oops-solve
cd ~/oops-solve

rar2john /home/arwah/Downloads/oops.rar > rar-records.txt
head -n 1 rar-records.txt > oops.hash

OMP_NUM_THREADS=8 john \
  --format=rar5 \
  --wordlist=/usr/share/john/password.lst \
  --pot=./oops.pot \
  oops.hash
```

John recovered:

```text
pepper
```

Extract the archive using that password:

```bash
unrar x -ppepper /home/arwah/Downloads/oops.rar ./
cd oops
```

During the solve, extraction completed with `All OK`, confirming the password worked on the actual archive.

## 3. Inspect the Git history

```bash
git --no-pager log --all --oneline
git --no-pager log --all -p --no-ext-diff
git --no-pager reflog --all
```

The history contained five commits, shown here from newest to oldest:

| Commit | Message |
| --- | --- |
| `58ebcdc` | removed build artifacts |
| `13e35f3` | cleanup: removed old config file |
| `f32423e` | added build artifacts |
| `6e2b824` | added config |
| `4fa5670` | initial commit |

The cleanup commits deleted two interesting files:

- `config.bak`, which contained a plaintext password.
- `secret.enc`, which contained encrypted data.

The patch for the configuration deletion exposed the original line:

```diff
-Sup3r_M3g4_Ultr4_S3cr3t_P4ssw0rd!
```

The secret appeared as a binary file in the diff, so it needed to be recovered directly from its earlier commit.

## 4. Recover the deleted files

From inside the extracted `oops` repository:

```bash
git show 6e2b824:config.bak > ../config.bak
git show f32423e:secret.enc > ../secret.enc
```

`git show <commit>:<path>` reads a file as it existed in that commit. No checkout or history modification was needed.

The recovered configuration contained:

```text
Sup3r_M3g4_Ultr4_S3cr3t_P4ssw0rd!
```

Identify the encrypted file:

```bash
file ../secret.enc
od -Ax -tx1z ../secret.enc
```

The `file` result was:

```text
openssl enc'd data with salted password
```

Its first eight bytes were `Salted__`, the recognizable header used by salted OpenSSL `enc` output. This identified the format, but the header alone did not specify the cipher or key derivation settings.

## 5. Decrypt the secret

AES-256-CBC with PBKDF2 was tried using the recovered configuration as the password source:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in ../secret.enc \
  -pass file:../config.bak
```

This command succeeded and printed:

```text
CTF.UZ{Think_7_t1m3s_bef0re_u_pushh}
```

The readable flag and successful decryption confirmed these settings for this challenge. The RAR password (`pepper`) and the encrypted secret's password were separate credentials.

## Flag

```text
CTF.UZ{Think_7_t1m3s_bef0re_u_pushh}
```

## Why the cleanup failed

Deleting a tracked file in a later commit removes it from that version of the project. Earlier commits still preserve its contents. Here, both the encryption password and the ciphertext remained accessible through normal Git history.

The repository also included `*.enc` in `.gitignore`. That rule did not erase the committed secret or remove it from older snapshots. Ignore rules are not a way to purge sensitive data from Git.

The challenge was solved by recovering the deleted files and using the exposed password; it did not require breaking AES encryption. In a real incident, exposed credentials should be revoked or rotated, followed by coordinated removal of sensitive material from repository history and other retained copies.
