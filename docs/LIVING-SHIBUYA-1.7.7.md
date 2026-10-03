# Anime Coil 1.7.7 — Living Shibuya and Gear 5

This release replaces the repetitive Shibuya architecture with a six-family Blender kit and rebuilds Pomu's ultimate as a chibi Gear 5 giant punch with cartoon expression, elastic staging and a rubber street. The approved normal roster and its textured hair remain unchanged. Shibuya is the only arena.

## Design and editable assets

Shibuya's crossing, shopping streets, station landmarks and meeting area informed the architecture and district layout. The seated dog is an original stylized meeting-area sculpture. [Official Tokyo guide](https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html).

Rubber elasticity, gigantification and comic fighting are grounded in [official episode 1072](https://one-piece.com/anime/62948/index.html); the giant finishing punch is inspired by [episode 1075's Bajrang Gun](https://one-piece.com/anime/63686/index.html). The combined eye-pop, balloon windup and flattened recovery are original game choreography. Models, sign art and synthesized effects sounds are authored for the game.

Blender MCP connectivity and the active scene were inspected before authoring. Separate named scenes and collections preserve unrelated objects and previous assets. Applied mesh transforms, finite normalized normals, vertex colors, Y up and +Z facing exports were verified in both profiles. No cameras, lights, skeletons or live modifiers are exported. The task-owned localhost connection was stopped after saving.

- [Editable city master](../assets/shibuya/v177/living-shibuya-editable.blend), [desktop GLB](../assets/shibuya/v177/city-kit-desktop.glb), [mobile GLB](../assets/shibuya/v177/city-kit-mobile.glb), [asset notes](../assets/shibuya/v177/README.md).
- [Editable Gear 5 master](../assets/pomu-gear5/v177/pomu-gear5-editable.blend), [desktop GLB](../assets/pomu-gear5/v177/pomu-ultimate-desktop.glb), [mobile GLB](../assets/pomu-gear5/v177/pomu-ultimate-mobile.glb), [asset notes](../assets/pomu-gear5/v177/README.md).
- [Actual city four views](living-shibuya-1.7.7/city-four-views.png), [kit overview](../assets/shibuya/v177/renders/city-kit-overview.png), [Gear 5 four views](living-shibuya-1.7.7/gear5-four-views.png), [fist four views](living-shibuya-1.7.7/fist-four-views.png), [matching-scale coil attachment](living-shibuya-1.7.7/coil-attachment.png).
- [Matched before/after game captures](living-shibuya-1.7.7/matched-comparison.png), [eight-stage timeline](living-shibuya-1.7.7/gear5-timeline.png), [phone-width captures](living-shibuya-1.7.7/phone-review.png).
- [Complete desktop cinematic](living-shibuya-1.7.7/cinematic/desktop-gear5-complete.webm), [complete phone-width cinematic](living-shibuya-1.7.7/cinematic/phone-gear5-complete.webm). Browser video captures are silent; the game uses original synthesized Effects-channel cues.

## Runtime behavior and budgets

Seven selected-profile GLBs preload before renderer initialization: the four approved normal heads, Kurama, the city kit and Pomu's head/fist. Accessible loading feedback remains visible; a failed or invalid new asset uses the procedural fallback. Later profile loads are cached. Synchronous environment and transformed-head factories are preserved. Geometry and source materials are immutable; expression/blink transforms are independent. Whole-world rebuilds dispose only owned clones and merged district buffers. Shared caches are disposed once at application teardown, including late-load handling.

The city has four culling districts, varied heights, setbacks and rooftops; all raised architecture remains outside the unchanged arena radius plus six-unit clearance. Navy architecture, cyan/magenta signs, warm interiors, painted wet puddles, distance fog and rain retain character/orb contrast. Umbrellas, waiting groups, taxis, traffic signals, billboard crossfades and restaurant steam use bounded pools. Reduced motion freezes decoration; pause and hidden tabs retain the existing frozen visual clock. Lighting is retained without new reflection, bloom or glow passes.

| Asset / assembled environment | Desktop | Mobile | Required limit |
| --- | ---: | ---: | --- |
| City prototypes | 4,800 triangles / 14 mesh batches | 3,728 / 14 | Selected-profile kit |
| Full environment triangles | 92,022 | 53,662 | 150,000 / 75,000 |
| Full environment draws | 70 | 70 | 120 / 80 |
| Full environment materials | 25 | 25 | 32 each |
| Full environment textures | 5 | 5 | Shared textures/atlases |
| Pedestrians / vehicles | 64 / 8 | 20 / 4 | 64 / 8 and 20 / 4 |
| Rain particles | 220 | 72 | Existing bounded rain pool |
| Gear 5 head including original coil | 5,644 triangles | 3,812 | 6,000 / 4,000 |
| Head draws including coil, plus outline | 7 + 1 | 7 + 1 | 12 + 1 |
| Haki fist triangles / draws including contour | 2,444 / 3 | 1,544 / 3 | Coherent optimized sculpt |
| Peak held Pomu draws including form head/outline | 18 | 16 | 24 / 16 |

The head retains the 0.12 Y mount and 1.28 Y eye pivot. White curls, spiral brows, a broad grin and cloud scarf accompany bounded bounce, ballooning, eye-pop and flattened recovery. The Haki fist uses front-face culling on its closed skin and a restrained contour. Its wrist anchor, actual bounds and expression controls extend the existing staging contract. The fixed arm buffer deforms through shader uniforms. Tessellated asphalt, crossings, paint and puddles share one world-space displacement formula; collision surfaces and snake positions remain authoritative and unchanged. Unaffected vertices skip deformation math, and stationary billboard phases avoid a redundant atlas sample.

| Time | Presentation |
| --- | --- |
| 0–0.9 s | Laughing white-haired transformation and compact bounce |
| 0.9–2.5 s | Balloon windup, brief eye-pop, charcoal Haki fist and red-black accents |
| 2.5–3.4 s | Anticipation hold, elastic arm and descending punch |
| 3.4 s | Shared kill-frame impact, compressed street, manga accent and pressure wave |
| 3.4–4.3 s | Coherent rubber rebound, curled smoke and cartoon fragments |
| 4.3–5.6 s | Wobbling retraction, flattened pose and restoration of approved normal head |

Original synthesized spring, inflation, drum and punch sounds use existing channels/cues. Reduced motion neutralizes expression wobble and terrain displacement; reduced flashes suppress fast lightning and pressure flash. Disabled cinematic camera retains gameplay framing. Profile changes keep cinematic time, pose and gameplay state, including a paused rubber-street pose. Completion, death, respawn, restart and quit restore the approved normal head and clear transient pools.

## Validation

**342 tests pass**, `npm run build` succeeds and `git diff --check` passes. The build retains the existing Three.js chunk-size advisory. The full suite includes simulation/ultimate regressions, exact differential stepping, fixed 3.4-second elimination and 5.6-second completion, scoring/cooldowns and respawns. New checks cover actual GLB schemas, geometry and orientation, head/fist bounds, budgets, finite normals, shared ownership, independent eyes, invalid/failed/late preload, profile changes, pause, clearance, static arm buffers, coherent floor/paint shaders and teardown.

The hardware-browser review passed **93 recorded cases with no page or shader errors**, at 1440×900 and 390×844. It covers the menu/portraits and 21-member same-character crowds for all four characters, all held Pomu stages, other finishers, large/boundary casts, comfort settings, disabled cinematic camera, cached profile switching, lifecycle restoration, eight world rebuilds, and forced city/Pomu load failures. Startup requests only the chosen profile; switching loads the other profile once, then reuses all fourteen cached downloads. Continuous desktop and phone-width recordings verify the actual kill-frame wipe and cleanup. The first observed detonation frame is subject to fixed-step/RAF quantization; simulation retains the exact 3.4-second threshold.

Nineteen preserved files/exports are verified against the 1.7.6 source, with canonical LF hashing for text and exact bytes for GLBs. This includes simulation, the other three cinematic modules, approved head/cache modules, their normal exports and Kurama. [Preservation evidence](living-shibuya-1.7.7/preserved-files.json), [asset manifest](living-shibuya-1.7.7/asset-manifest.json), [browser evidence](living-shibuya-1.7.7/after/validation.json), [live cinematic trace](living-shibuya-1.7.7/cinematic/live-validation.json).

## Matched rendering measurements

The baseline is commit `1a9eb4335bc3f1d099fe1ef05f3cc3f4d4aa2a40` (1.7.6). Both versions use the identical seeded 21-living-snake / 850-orb fixture. Native RAF drives the real renderer and visual cadence while authoritative simulation remains frozen. Each final ABBA run warms for three seconds then samples five seconds; there are two runs per version per stage. CPU includes renderer update and submission, excluding simulation and DOM. Tables average the two per-run medians/p95 values; they are not pooled percentiles. Cinematic cameras intentionally reflect each version's staging, so cinematic scene totals include different visibility.

| Profile / held stage | CPU median / p95 before → after (ms) | Median change | Draws before → after | Triangles before → after |
| --- | --- | ---: | ---: | ---: |
| Desktop / normal | 7.50 / 9.65 → 7.95 / 10.35 | +6.0% | 77 → 82 | 77,649 → 110,605 |
| Desktop / charge | 11.90 / 14.65 → 11.50 / 14.35 | -3.4% | 307 → 298 | 308,655 → 308,329 |
| Desktop / impact | 13.70 / 16.95 → 12.20 / 15.60 | -10.9% | 323 → 301 | 319,680 → 319,659 |
| Desktop / recovery | 13.65 / 16.85 → 11.65 / 14.75 | -14.7% | 310 → 296 | 309,464 → 307,858 |
| Mobile / normal | 4.95 / 6.20 → 5.40 / 6.55 | +9.1% | 83 → 88 | 72,409 → 83,869 |
| Mobile / charge | 6.70 / 8.05 → 5.80 / 7.45 | -13.4% | 221 → 198 | 189,925 → 158,386 |
| Mobile / impact | 6.15 / 7.80 → 6.35 / 7.80 | +3.3% | 218 → 215 | 189,768 → 187,500 |
| Mobile / recovery | 6.90 / 8.25 → 6.75 / 8.20 | -2.2% | 247 → 242 | 208,960 → 205,364 |

GPU values come from available asynchronous disjoint timer queries. G / T / P are live geometries / textures / compiled programs. GPU percentiles use much smaller sample counts than CPU and share this computer with its other applications; they are observations rather than sustained device guarantees.

| Profile / held stage | GPU median / p95 before → after (ms) | Query samples before / after | Resources G / T / P before → after |
| --- | --- | ---: | --- |
| Desktop / normal | 6.508 / 7.257 → 3.766 / 4.744 | 24 / 28 | 67 / 7 / 34 → 72 / 6 / 35 |
| Desktop / charge | 9.500 / 11.192 → 7.478 / 8.496 | 20 / 22 | 115 / 9 / 40 → 110 / 9 / 47 |
| Desktop / impact | 9.495 / 12.726 → 7.532 / 10.669 | 21 / 25 | 121 / 9 / 41 → 114 / 9 / 47 |
| Desktop / recovery | 9.491 / 12.761 → 7.703 / 10.388 | 21 / 26 | 120 / 9 / 41 → 113 / 9 / 47 |
| Mobile / normal | 1.046 / 1.161 → 0.859 / 1.747 | 42 / 42 | 69 / 7 / 34 → 74 / 6 / 35 |
| Mobile / charge | 3.390 / 4.882 → 2.537 / 5.052 | 40 / 41 | 110 / 9 / 40 → 102 / 9 / 46 |
| Mobile / impact | 2.407 / 4.137 → 3.146 / 4.023 | 42 / 42 | 115 / 9 / 41 → 107 / 9 / 46 |
| Mobile / recovery | 4.059 / 5.999 → 3.276 / 4.839 | 41 / 41 | 116 / 9 / 41 → 108 / 9 / 46 |

The initial mobile sample exposed opposing-district culling/batching overhead: normal CPU rose 12.6% and recovery 19.6%. Four tight districts and compatible surface merging reduced mobile normal scene draws from 122 to 88 and recovery from 258 to 242. The intermediate repeat measured recovery CPU unchanged. A longer GPU follow-up also exposed unstable timings: unchanged desktop baseline CPU medians ranged from 6.8 to 11.6 ms, and unchanged mobile baseline GPU medians varied widely between runs. Its aggregate desktop CPU increase was 38.6%, while the adjacent later pair differed by about 2.6%. These observations remain in the report instead of being discarded.

The shader optimization culls closed fist back faces, skips street displacement outside its radius/inactive state, and avoids a second billboard sample during stationary ads. Its repeat still showed a 20.8% desktop normal CPU increase, so compatible surface merging was extended to desktop. The final repeat measures normal CPU increases of 6.0% desktop / 9.1% mobile; desktop submission medians are similar to baseline while environmental update medians rise roughly 0.3–0.4 ms for the larger city-life pool. Charge/impact/recovery remain mostly faster. This retains the richer architecture and population while keeping both assembled worlds to 70 draws.

Final observed GPU timing increases above the investigation threshold: **mobile normal: GPU p95 +50.5%; mobile impact: GPU median +30.7%** These were inspected across the retained follow-ups and per-stage timings. Added rubber deformation and the diffuse sculpt can cost GPU time during impact; sparse asynchronous samples also vary substantially on the unchanged baseline. Remaining higher values are reported as costs/measurement uncertainty, not a claim of universal improvement. All original, intermediate, shader-repeat, follow-up and final measurements remain in [the combined JSON](living-shibuya-1.7.7/performance-comparison.json); [final raw samples](living-shibuya-1.7.7/performance-final/raw-abba.json) include per-stage timing and state assertions.

## Release and practical limits

The release is version **1.7.7**, including package/lockfile, browser title and visible branding/credits. The local preview is `http://127.0.0.1:4175/`; release targets are the existing [GitHub main repository](https://github.com/IgrisDeez/Anime-Coil/tree/main) and the existing public [Anime Coil Site](https://animecoil.igrisdeez.chatgpt.site), preserving its audience. The editable-asset and source archives are refreshed locally; generated archive receipts are intentionally excluded from Git. User-state backups and setup credentials are excluded from commits, copies and archives.

Review was performed in headless Edge WebGL on this Windows computer, including phone-sized layouts. Physical-phone thermal behavior, touch feel and sustained battery/GPU performance remain untested. Browser recordings have no captured audio. Side/rear character anatomy and stylized city details are authored interpretations; the supplied approved normal roster is preserved.
