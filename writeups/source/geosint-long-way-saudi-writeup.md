# GeoSINT CTF — Long Way

**Challenge:** `https://geosint.ctf.uz/2807ffe8-e563-4972-9c94-087e9adf67ca`  
**Hint:** “On the way to Black Hat MEA”  
**Status:** Solved and verified

## Objective

Identify the exact road position from a desert photograph containing power lines and almost no conventional landmarks.

## Step 1 — Extracting metadata

Unlike many GeoINT images, the original file retained useful EXIF data even though GPS was absent:

```text
Camera:           iPhone 15
DateTimeOriginal: 2025:12:03 10:47:37
Time zone:        +03:00
iOS:              18.3.2
GPS:              absent
```

The timestamp was crucial. Black Hat MEA 2025 was held from **2–4 December 2025** at the Riyadh Exhibition & Convention Center in Malham, Saudi Arabia. The photograph was therefore taken during the event window and in the local Saudi time zone.

## Step 2 — Interpreting “on the way”

The hint described a journey rather than the venue itself. Event transport information indicated shuttle departures from the **SAB Metro station** area toward the Malham venue. A route between those points runs north from Riyadh along the King Fahd / Al Qassim highway corridor.

This matched the photograph:

- arid, open terrain;
- a divided high-speed road;
- a yellow edge line viewed through a vehicle window;
- repeated guyed utility poles and multiple parallel distribution lines;
- no dense urban development.

## Step 3 — Matching the utility corridor

The road route alone was too long to guess safely. OpenStreetMap geometry was used to compare the route with nearby power infrastructure. The useful discriminator was a tight cluster of **three minor power lines** crossing or running immediately beside the highway.

Projecting that cluster onto the driving route isolated a point near:

```text
25.086832, 46.481893
```

This is on **King Fahd Road / Highway 65** in Huraymila Governorate, Riyadh Province, north of Riyadh and south of the Malham event venue.

## Verification

The narrowed candidate was submitted to the task-specific verifier and was accepted:

```json
{
  "status": "correct",
  "flag": "CTF.UZ{y3s_it_w4s_a_v3ry_l0ng_w4y}"
}
```

## Result

- **Location:** King Fahd Road / Highway 65, Huraymila Governorate, Riyadh Province, Saudi Arabia
- **Coordinates:** `25.086832, 46.481893`
- **Verifier result:** `status: correct`
- **Flag:** `CTF.UZ{y3s_it_w4s_a_v3ry_l0ng_w4y}`

Map: `https://www.openstreetmap.org/?mlat=25.086832&mlon=46.481893#map=17/25.086832/46.481893`

## References

- Black Hat upcoming-events page: `https://www.blackhat.com/upcoming.html?meevents=`
- Black Hat MEA FAQ: `https://blackhatmea.com/faq`
- Event transport document: `https://www.linkedin.com/posts/blackhatmea_how-to-get-to-black-hat-mea-2025pdf-activity-7401500550854410241-2NNM`

## Lessons learned

1. Always inspect EXIF before beginning visual research; a timestamp can be as valuable as GPS.
2. Interpret travel hints as a route problem, not merely a destination clue.
3. When the scene lacks landmarks, combine road geometry with secondary infrastructure such as power-line crossings.
4. Submit only after independent clues converge, then preserve the verifier response as proof.

