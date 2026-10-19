# GeoINT CTF — Never

**Challenge:** `https://geoint.ctf.uz/b772b701-a34a-4a08-874a-60259e3e5f5d`  
**Status:** Solved and verified

## Objective

Identify the exact camera position represented by the challenge photograph and submit its latitude and longitude to the platform.

## Avoiding a source-image mix-up

Several unrelated files were temporarily associated with this task, including a photograph of swans and a nearly featureless road-barrier image. Those images were not used for the final identification. The correct challenge photograph contained a distant stadium visible from a large roadway.

This matters because a plausible location for the wrong image must not be treated as a solution for the challenge UUID.

## Landmark identification

The decisive landmark was **RZD Arena**, formerly Lokomotiv Stadium, in Moscow. Its distinctive roof and surrounding structures matched the stadium visible beyond the roadway.

Reference imagery was compared from several directions:

- aerial views established the road and stadium geometry;
- oblique and ground-level views confirmed the roof silhouette;
- map imagery showed that the photograph had to be taken northeast of the arena rather than at the stadium entrance.

The likely camera area was therefore the major road corridor northeast of RZD Arena, looking back toward the stadium.

## Refining the camera position

The challenge verifier provides three useful states:

- `incorrect` — outside the useful radius;
- `close` — near the hidden target;
- `correct` — accepted coordinate and flag.

The first strong candidate, `55.8099, 37.74735`, returned `close`. The search was then narrowed around it:

```text
55.8115, 37.74735  -> incorrect
55.8080, 37.74735  -> incorrect
55.8097, 37.74735  -> close
55.8107, 37.74735  -> incorrect
55.80875,37.74735  -> close
55.8103, 37.74735  -> incorrect
55.808375,37.74735 -> incorrect
55.80938,37.74755  -> correct
```

The close/incorrect boundary constrained the latitude, after which a small longitude adjustment reached the accepted point.

## Result

- **Location:** roadway northeast of RZD Arena, Moscow, Russia
- **Coordinates:** `55.80938, 37.74755`
- **Verifier result:** `status: correct`
- **Flag:** `CTF.UZ{h4ha_st4d1um_is_v1s1bl3}`

Map: `https://www.openstreetmap.org/?mlat=55.80938&mlon=37.74755#map=18/55.80938/37.74755`

## Lessons learned

1. Confirm that the image belongs to the challenge UUID before researching it.
2. A landmark identifies the general area; road orientation and sightline identify the camera side.
3. Treat `close` as an oracle and bracket the target systematically rather than making random guesses.
4. Only `status: correct` proves the exact submission.

