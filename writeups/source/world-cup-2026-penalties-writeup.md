# World Cup 2026 Final — Penalty Shootout

## Challenge information

- **Category:** Miscellaneous / Scripting
- **Service:** `task.ctf.uz:13001`
- **Connection:** `nc task.ctf.uz 13001`
- **Goal:** Win the penalty shootout while controlling only Uzbekistan's shots.

## Challenge description

The service presents a World Cup final that finished 0–0. The winner is decided by a penalty shootout. For every Uzbekistan penalty, the player must choose one of three directions:

```text
LEFT
CENTER
RIGHT
```

The goalkeeper also chooses one of these directions. If the shot and goalkeeper directions are equal, the penalty is missed. Otherwise, Uzbekistan scores.

## Initial observation

I first sent `LEFT` for every penalty. This eventually caused a miss whenever the goalkeeper also jumped left. After losing, the service offered a restart:

```text
try again [y/n]:
```

The important clue appeared after choosing `y`:

```text
The shootout restarts. Same opponent. Same night. Same goalkeeper.
```

Testing the same shots again showed that the goalkeeper repeated exactly the same directions for the same penalty numbers. The sequence was deterministic and remained unchanged across restarts within the same connection.

## Vulnerability

The service reused the goalkeeper's complete direction sequence after a retry. It also revealed the goalkeeper's direction after every shot, even when Uzbekistan lost.

This creates a learn-and-replay attack:

1. Use a default shot for every unknown penalty.
2. Read the goalkeeper's direction from the result.
3. Store a different direction for that penalty number.
4. When a miss ends the shootout, restart it.
5. Replay all previously learned safe directions.
6. Continue until every required direction has been learned.

Only two shot directions are needed to avoid all three goalkeeper choices:

```python
def safe_shot(keeper_direction):
    return "CENTER" if keeper_direction == "LEFT" else "LEFT"
```

If the goalkeeper jumps left, shoot center. If the goalkeeper jumps center or right, shoot left.

## Automated solution

The following Python script keeps one TCP connection open, learns the sequence, and automatically retries after each loss:

```python
import re
import socket

HOST = "task.ctf.uz"
PORT = 13001
SHOT_PROMPT = b"Choose your shot [LEFT, CENTER, RIGHT]: "
RESTART_PROMPT = b"try again [y/n]: "


def safe_shot(keeper_direction):
    return "CENTER" if keeper_direction == "LEFT" else "LEFT"


sock = socket.create_connection((HOST, PORT), timeout=15)
sock.settimeout(30)

buffer = b""
learned = []
penalty = 0

while True:
    while SHOT_PROMPT not in buffer and RESTART_PROMPT not in buffer:
        block = sock.recv(65536)
        if not block:
            flag = re.search(rb"[A-Za-z0-9_.]+\{[^\r\n}]+\}", buffer)
            if flag:
                print(flag.group().decode())
            raise SystemExit
        buffer += block

        flag = re.search(rb"[A-Za-z0-9_.]+\{[^\r\n}]+\}", buffer)
        if flag:
            print(flag.group().decode())
            raise SystemExit

    shot_at = buffer.find(SHOT_PROMPT)
    restart_at = buffer.find(RESTART_PROMPT)
    is_shot_prompt = shot_at >= 0 and (restart_at < 0 or shot_at < restart_at)

    marker = SHOT_PROMPT if is_shot_prompt else RESTART_PROMPT
    event_at = shot_at if is_shot_prompt else restart_at
    event = buffer[:event_at]
    buffer = buffer[event_at + len(marker):]

    # The event contains the outcome of the preceding Uzbekistan penalty.
    directions = re.findall(rb"jumps (LEFT|CENTER|RIGHT)\.", event)
    if directions and penalty:
        replay_shot = safe_shot(directions[-1].decode())
        if len(learned) < penalty:
            learned.append(replay_shot)
        else:
            learned[penalty - 1] = replay_shot

    if is_shot_prompt:
        penalty += 1
        shot = learned[penalty - 1] if penalty <= len(learned) else "LEFT"
        sock.sendall((shot + "\n").encode())
    else:
        penalty = 0
        sock.sendall(b"y\n")
```

## Result

The solver progressively learned the deterministic sequence. On the successful run, Uzbekistan converted penalty 100 by shooting center while the goalkeeper jumped left. Argentina then missed:

```text
Penalty 100
Score: Uzbekistan 99 - 99 Argentina

Abbosbek Fayzullaev shoots CENTER.
Emiliano Martinez jumps LEFT.
[+] GOAL

Lionel Messi shoots.
[-] MISSED

Score after penalty 100:
Uzbekistan 100 - 99 Argentina

============================================================
            UZBEKISTAN WINS THE WORLD CUP 2026!
============================================================
```

## Flag

```text
CTF.UZ{W3_4r3_7h3_Ch4mp10n5_my_fr13nd!}
```

## Conclusion

The weakness was deterministic state reuse across retries. Because the service disclosed every goalkeeper decision and did not regenerate the sequence after a loss, each attempt leaked more of the correct solution. Recording the moves and replaying safe directions converted the shootout into a predictable sequence and produced the flag.
