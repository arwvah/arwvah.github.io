# World Cup 2026 Penalty Shootout

**Category:** Misc / Scripting  
**Service:** `nc task.ctf.uz 13001`

## Challenge

Uzbekistan reaches the 2026 World Cup final. The match is tied and the user
controls Uzbekistan's penalty directions: `LEFT`, `CENTER`, or `RIGHT`.
Brazil (and, on a later connection, Argentina) automatically takes its shots.
The goal is to win the shootout.

## Observation

Choosing the same direction repeatedly eventually produces a miss, for
example:

```text
Abdukodir Khusanov shoots LEFT.
Alisson Becker jumps LEFT.
[-] MISSED
```

After choosing `y` to restart, the goalkeeper repeats exactly the same jump
sequence from penalty 1. The restart resets the score, but it does not reset
the sequence used for the goalkeeper's decisions.

This makes the service an oracle. A failed attempt reveals the goalkeeper's
direction for each penalty reached. On the next attempt, choose any other
direction for the known positions. If a new position is unknown, submit a
trial direction, record its result, and restart only if it is saved.

## Exploit strategy

1. Start with `LEFT` for unknown penalties.
2. Parse the line `<goalkeeper> jumps <DIRECTION>.`
3. Store a safe shot for that penalty:
   - if the keeper jumps `LEFT`, use `CENTER`;
   - otherwise use `LEFT`.
4. When Uzbekistan misses, answer `y` and replay every stored safe shot.
5. Repeat until all required penalties are known.

The solver intentionally uses only `LEFT` and `CENTER`; it only needs one
direction that differs from the keeper's choice.

## Solver

The following Python program speaks directly to the TCP service. It handles
TCP data in a buffer because a goalkeeper line may be split between network
reads.

```python
import re
import socket

HOST, PORT = "task.ctf.uz", 13001
PROMPT = b"Choose your shot [LEFT, CENTER, RIGHT]: "
RESTART = b"try again [y/n]: "

def safe_shot(keeper_direction):
    return "CENTER" if keeper_direction == "LEFT" else "LEFT"

with socket.create_connection((HOST, PORT), timeout=15) as sock:
    buf, learned = b"", []
    round_no, attempt = 0, 1

    while True:
        while PROMPT not in buf and RESTART not in buf:
            block = sock.recv(65536)
            if not block:
                raise SystemExit("server closed")
            buf += block

        prompt_at, restart_at = buf.find(PROMPT), buf.find(RESTART)
        is_prompt = prompt_at >= 0 and (restart_at < 0 or prompt_at < restart_at)
        marker = PROMPT if is_prompt else RESTART
        marker_at = prompt_at if is_prompt else restart_at
        event, buf = buf[:marker_at], buf[marker_at + len(marker):]

        jumps = re.findall(rb"jumps (LEFT|CENTER|RIGHT)\\.", event)
        if jumps and round_no:
            shot = safe_shot(jumps[-1].decode())
            if len(learned) < round_no:
                learned.append(shot)
            else:
                learned[round_no - 1] = shot

        flag = re.search(rb"[A-Za-z0-9_]+\\{[^\\r\\n}]+\\}", event)
        if flag:
            print(flag.group().decode())
            break

        if is_prompt:
            round_no += 1
            shot = learned[round_no - 1] if round_no <= len(learned) else "LEFT"
            sock.sendall((shot + "\\n").encode())
        else:
            attempt += 1
            round_no = 0
            sock.sendall(b"y\\n")
```

## Result

The final replay reached penalty 100 without an Uzbekistan miss. Emiliano
Martinez jumped left while Uzbekistan shot center, then Lionel Messi missed.

```text
Score after penalty 100:
Uzbekistan 100 - 99 Argentina

UZBEKISTAN WINS THE WORLD CUP 2026!
```

## Flag

```text
CTF.UZ{W3_4r3_7h3_Ch4mp10n5_my_fr13nd!}
```

