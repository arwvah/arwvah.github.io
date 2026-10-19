# GeoINT CTF Write-ups

This index covers the four photo-geolocation challenges investigated in the current task. Every coordinate marked **verified** produced `status: correct` on the challenge platform.

| Challenge | Exact location | Verified coordinates | Flag | Write-up |
|---|---|---:|---|---|
| First Capital | Parella / Pozzo Strada, Turin, Italy | `45.081, 7.619` | `ONECTF{Tur1n_w4s_First_c4p1tal_0f_th3_K1ngd0m_0f_Italy}` | [First Capital](geosint-first-capital-writeup.md) |
| Never | Road northeast of RZD Arena, Moscow, Russia | `55.80938, 37.74755` | `CTF.UZ{h4ha_st4d1um_is_v1s1bl3}` | [Never](geoint-never-rzd-arena-writeup.md) |
| Reflection | Danube riverbank by Handelskai, Vienna, Austria | `48.241117, 16.388147` | `CTF.UZ{v3ry_be4u71ful_vi3w}` | [Reflection](geoint-reflection-vienna-writeup.md) |
| Long Way | King Fahd Road / Highway 65, Riyadh Province, Saudi Arabia | `25.086832, 46.481893` | `CTF.UZ{y3s_it_w4s_a_v3ry_l0ng_w4y}` | [Long Way](geosint-long-way-saudi-writeup.md) |

An older, separate solved challenge is also already present in this directory: [We Have](geosint_writeup.md).

## Verification standard

Visual similarity was used to generate candidates, not to declare success. The final answer for each challenge was the coordinate pair accepted by its supplied `verify_location` endpoint.

