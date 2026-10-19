# GeoINT CTF — Reflection

**Challenge:** `https://geoint.ctf.uz/d64a540f-9539-457e-ae1e-632bdcd32267`  
**Status:** Solved and verified

## Objective

Geolocate a photograph showing swans and gulls beside a broad river, then identify the precise point accepted by the challenge verifier.

## Visual observations

The image showed:

- a wide, controlled urban river;
- many mute swans and black-headed gulls;
- an engineered bank made from riprap and sloping precast concrete steps;
- a low bridge in the background;
- leafless vegetation, suggesting a cool-season European scene.

These clues suggested a managed section of a major Central European river rather than a natural lake shore.

## Finding the matching riverbank

Reverse-image and landmark research led to the Danube beside **Handelskai** and **Millennium City / Millennium Tower** in Vienna. A Wikimedia Commons photo sequence from the same bank was especially useful:

`Wien Donau 2014-12-03 088 Höckerschwäne Cygnus olor Lachmöwen Larus ridibundus Stockenten Anas platyrhynchos.jpg`

The sequence showed the same combination of birds, river engineering and shoreline geometry. Its embedded/map position was approximately:

```text
48.241017, 16.388147
```

Submitting that point returned `close`, proving that the correct location was within a very small radius.

## Final refinement

Small offsets were tested around the source-photo coordinate. Moving the latitude north by `0.0001°` produced the accepted result:

```text
48.241117, 16.388147 -> correct
```

The accepted area is the Danube riverbank/treppelweg beside Handelskai, below the Millennium City complex in Vienna.

## Result

- **Location:** Danube riverbank beside Handelskai, Vienna, Austria
- **Coordinates:** `48.241117, 16.388147`
- **Verifier result:** `status: correct`
- **Flag:** `CTF.UZ{v3ry_be4u71ful_vi3w}`

Map: `https://www.openstreetmap.org/?mlat=48.241117&mlon=16.388147#map=19/48.241117/16.388147`

## Reference

- Wikimedia Commons match: `https://commons.wikimedia.org/wiki/File:Wien_Donau_2014-12-03_088_H%C3%B6ckerschw%C3%A4ne_Cygnus_olor_Lachm%C3%B6wen_Larus_ridibundus_Stockenten_Anas_platyrhynchos.jpg`

## Lessons learned

1. Shore construction can be more discriminating than the wildlife itself.
2. A matching geotagged photo is a strong lead, but the CTF may use a nearby target rather than exactly the public photo coordinate.
3. Once the verifier reports `close`, use very small cardinal offsets and record every response.

