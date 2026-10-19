# GeoSINT CTF — First Capital

**Challenge link:** https://geosint.ctf.uz/cf1229b8-659c-4094-aa9d-42061a2e4f01

**Flag:** `ONECTF{Tur1n_w4s_First_c4p1tal_0f_th3_K1ngd0m_0f_Italy}`

## Objective

Given a photo of a residential street, identify the exact location where it was taken and submit precise coordinates on the challenge's Leaflet map. The platform's `/api/verify_location` endpoint returns one of:

- `correct` — flag granted
- `close` — "You are close!"
- `incorrect` — wrong spot

Too many attempts in a short window triggers a **1-minute ban**.

## Step 1 — Reading the hint and the photo

The challenge is named **"First Capital"**. The first capital of the Kingdom of Italy was **Turin (Torino)**, capital from 1861 to 1865 before the seat moved to Florence and then Rome.

The photo itself is consistent with Turin:

- dense 4–6 story apartment blocks with **terracotta tile roofs**;
- **brick-faced facades** with external shutters and small metal balconies (pink/green railings typical of mid-century Turin residential quarters);
- European no-stopping sign, rooftop TV antennas and satellite dishes.

So the search area is Turin — but Turin is ~130 km², and the challenge wants an *exact* point. Visual pinpointing from rooftops alone isn't feasible.

## Step 2 — Recon on the verification API

Fetching the challenge page reveals the client-side logic:

```js
fetch('/api/verify_location/' + taskId, {
    method: 'POST',
    body: JSON.stringify({ latitude: selectedLat, longitude: selectedLng })
})
```

The API differentiates `incorrect` from `close`, which turns the challenge into a **search problem with feedback**. The ban is only 1 minute, so a patient automated grid search is viable.

### Session handling

POSTing directly returns `204 No Content`. The endpoint requires:

1. a session (cookies are set by visiting the challenge page first);
2. a CSRF token (the `csrf_token` cookie value sent as `X-CSRFToken` header).

```python
def verify(lat, lng, csrf):
    body = json.dumps({"latitude": lat, "longitude": lng}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/verify_location/{TASK}", data=body, method="POST",
        headers={"User-Agent": UA, "Content-Type": "application/json",
                 "X-CSRFToken": csrf, "Referer": f"{BASE}/{TASK}",
                 "X-Requested-With": "XMLHttpRequest"})
    ...
```

Sanity check — Turin city center (45.0703, 7.6869) → `incorrect`. Good, the API works.

## Step 3 — Coarse grid over Turin

Swept the metro area from **lat 44.98–45.12, lon 7.58–7.80** in 0.02° steps (~2.2 km), sleeping ~1.2 s between requests and waiting out bans (they hit roughly every 25 attempts):

```
62: 45.08,7.62 -> You are close!   status=close
```

Single `close` hit: **45.08, 7.62** — northwest Turin, near the Collegno border.

## Step 4 — Estimating the "close" radius

A finer 0.005° (~550 m) grid around the hit produced **only one** `close` point — the original one. All neighbors at ~550 m were `incorrect`, so the close radius is smaller than ~550 m.

## Step 5 — Fine grid and the flag

Final sweep at **0.001° (~110 m)** resolution over 45.076–45.084, 7.616–7.624 (with resume-from-log and DNS-retry logic added along the way):

```
40: 45.080,7.620 -> close
41: 45.081,7.621 -> close
46: 45.081,7.617 -> close
47: 45.081,7.618 -> close
48: 45.081,7.619 -> correct
```

The `close` cluster brackets the target, and **45.081, 7.619** returned:

```json
{"flag": "ONECTF{Tur1n_w4s_First_c4p1tal_0f_th3_K1ngd0m_0f_Italy}",
 "message": "Congratulations! You found the correct location!",
 "status": "correct"}
```

## Result

- **Location:** 45.081, 7.619 — Parella / Pozzo Strada district, NW Turin, Italy
- **Flag:** `ONECTF{Tur1n_w4s_First_c4p1tal_0f_th3_K1ngd0m_0f_Italy}`

## Takeaways

- When a geolocation platform gives *graded* feedback (`close` vs `incorrect`), treat it as an oracle: coarse grid → measure the close radius → refine → bracket the target.
- The hint alone (city-level) is cheap; the feedback loop does the pinpointing — no Street View matching needed.
- Practical hygiene: persist sessions/CSRF, add network-error retries, and make scripts resumable — long automated sweeps *will* hit bans and transient DNS failures.

## Scripts

- `/tmp/opencode/hunt.py` — coarse grid searcher
- `/tmp/opencode/refine.py` — resumable fine-grid refiner with ban/backoff handling
