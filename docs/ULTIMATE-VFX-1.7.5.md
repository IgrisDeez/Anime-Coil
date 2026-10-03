# Anime Coil 1.7.5 — Ultimate VFX polish and Blender roster review

All four ultimates now have stronger visual separation between charge, launch and impact. Kitsu keeps the approved Kurama sculpture and mouth-launched purple-black bomb; violet channel/rim contrast and an outward burst improve the hit. Kairo's focal orb has deeper cyan-blue flow and restrained white compression veins; decorative debris uses a low-detail shared mesh. Pomu's elastic fist compresses through windup before release, with a cream/ink pressure burst. Shiro's merged purple core has darker depth, visible flow and a narrow rim; its mobile profile uses one simpler directional wave.

## Gameplay and resource boundaries

The simulation, Kitsu normal-head cache, procedural head factory, approved Kitsu/Kurama GLBs and Kurama asset cache are byte-for-byte identical to the saved 1.7.4 baseline; verified hashes are in `ultimate-polish/preserved-before.json` and `preserved-after.json`. Character IDs, body cosmetics, transformed heads, summon/muzzle anchors, trajectories, ground clearance, staging and the existing 5.6-second timelines are preserved. Rendering-only updates never change arena state in the all-stage tests or application captures.

Each ultimate adds one short pressure-front mesh and one bounded instanced batch of tapered impact strokes. Those meshes are constructed once and disposed once by the cinematic owner. Desktop/mobile stroke counts are 18/10; reduced motion removes strokes and uses one subdued fixed-radius front. No new light, bloom pass, reflection, skeleton or frame-time mesh construction is introduced. Existing flash settings and reduced-motion/cinematic-camera controls remain. Purple now clears and disposes its owned resources consistently on lifecycle transitions and respects the camera-disabled option.

The front adds 64 triangles; strokes add 108 desktop / 60 mobile triangles. Kairo's decorative petals/motes switch from the focal orb's 1,472-triangle sphere to a shared 20-triangle icosahedron, retaining pool limits and preserving the smooth focal orb. Shiro's outer shell is reserved for impact; charge uses its existing core draw. Two impact draws remain the deliberate visual cost. Peak audited fox calls remain within 24 desktop / 16 mobile.

## Validation and visual review

`npm test` passes **326 tests**, including preserved simulation regressions and new checks for all six actual head exports, selected-profile caching, shared resources, independent blink transforms, malformed/failed/late loads, once-only disposal, finite bounded effect geometry, all-stage arena-state parity and camera-disabled behavior. `npm run build` and diff checks pass. Two existing visual tests now identify the named Spirit Bomb surface rather than treating the last shader mesh as the orb; their original detail/height assertions remain.

The actual application check records 53 results across desktop 1440×900 and phone-width 390×844, with no page errors. Each initial context loads one Kitsu and one Kurama GLB for the selected profile, caches the other profile on demand, and downloads no candidate roster head. All four effects are captured at charge, release, hit, shockwave and recovery. Normal-head restoration, death/respawn, restart, quit, profile switching without cinematic-time reset, reduced motion/flash settings, camera disabled, repeated Shibuya rebuilds and failed asset loads pass. Settled resource counts remain stable across repeated rebuilds.

The held review additionally includes large coils, same-character crowds and arena-boundary casts. Its scene intentionally retains 21 snakes at each held stage so rendering comparisons have the same population; it does not replace the authoritative wipe or simulate live eliminations. The production game retains its original authoritative outcomes. Actual comparison/timeline sheets and individual screenshots are in `ultimate-polish/`; real-application screenshots and validation are in `ultimate-polish/application/`.

## Matched rendering measurements

Measurements use the same current GameRenderer and frozen 1.7.4 effect files in `src/ultimate-baseline/`, seed 812, 21 snakes of mass 48 and 850 food, Shibuya, DPR 1. ABBA samples isolate ordinary rendering and held charge/impact stages. CPU columns report the arithmetic mean of two medians and two p95s; these are not pooled quantiles. Counts are whole-scene submissions, and resources are uploaded geometry/texture/program counts at the end of each sample. Frustum culling explains different visible populations between cinematic cameras.

Initial windows are 2 seconds warmup / 3.5 seconds measurement. Above-10% exploratory differences were investigated through targeted 4/6-second repeats, removal of the extra Shiro charge shell, cheaper shader arithmetic and the mobile core variant. Quiet repeats isolate host activity. The table selects final-source runs by variant; all earlier runs, flags and GPU samples remain in `ultimate-polish/performance-comparison.json` and the raw folders.

| Profile / character / stage | Triangles before → after | Calls before → after | Geometry/texture/program resources before → after | CPU median / p95 ms before → after | Median / p95 change |
| --- | ---: | ---: | --- | --- | --- |
| desktop · Kitsu · ordinary-21 | 171,302 → 171,302 | 116 → 116 | 117/5/27 → 117/5/27 | 10.15 / 15.05 → 9.85 / 14.65 | -3.0% / -2.7% |
| desktop · Kitsu · charge | 478,369 → 478,369 | 389 → 389 | 132/5/35 → 132/5/35 | 12.75 / 23.60 → 12.80 / 20.70 | +0.4% / -12.3% |
| desktop · Kitsu · impact | 513,151 → 513,323 | 437 → 439 | 138/5/36 → 140/5/38 | 13.60 / 21.60 → 13.80 / 20.25 | +1.5% / -6.3% |
| desktop · Kairo · charge | 558,820 → 413,620 | 346 → 346 | 133/5/29 → 134/5/29 | 12.60 / 18.65 → 12.80 / 19.10 | +1.6% / +2.4% |
| desktop · Kairo · impact | 676,576 → 461,852 | 369 → 371 | 134/5/29 → 136/5/31 | 11.15 / 18.15 → 11.50 / 18.05 | +3.1% / -0.6% |
| desktop · Pomu · charge | 416,324 → 416,324 | 344 → 344 | 154/5/31 → 154/5/31 | 13.80 / 19.80 → 13.45 / 18.15 | -2.5% / -8.3% |
| desktop · Pomu · impact | 484,764 → 484,936 | 406 → 408 | 156/5/30 → 158/5/32 | 14.20 / 19.00 → 13.65 / 18.75 | -3.9% / -1.3% |
| desktop · Shiro · charge | 270,228 → 270,228 | 218 → 218 | 131/5/42 → 131/5/43 | 10.70 / 17.20 → 9.50 / 20.05 | -11.2% / +16.6% |
| desktop · Shiro · impact | 429,304 → 429,428 | 364 → 365 | 136/5/46 → 138/5/49 | 11.70 / 18.10 → 12.55 / 18.20 | +7.3% / +0.6% |
| mobile · Kitsu · ordinary-21 | 139,992 → 139,992 | 110 → 110 | 114/5/27 → 114/5/27 | 4.25 / 5.65 → 3.70 / 5.50 | -12.9% / -2.7% |
| mobile · Kitsu · charge | 363,001 → 363,001 | 329 → 329 | 127/5/35 → 127/5/35 | 5.75 / 7.55 → 6.20 / 8.20 | +7.8% / +8.6% |
| mobile · Kitsu · impact | 413,419 → 413,543 | 377 → 379 | 135/5/36 → 137/5/38 | 6.25 / 8.15 → 6.25 / 8.45 | +0.0% / +3.7% |
| mobile · Kairo · charge | 396,734 → 309,614 | 257 → 257 | 128/5/29 → 129/5/29 | 4.50 / 7.35 → 4.50 / 6.85 | +0.0% / -6.8% |
| mobile · Kairo · impact | 436,738 → 314,894 | 276 → 278 | 125/5/28 → 127/5/30 | 5.25 / 7.50 → 5.70 / 8.25 | +8.6% / +10.0% |
| mobile · Pomu · charge | 303,952 → 303,952 | 260 → 260 | 150/5/31 → 150/5/31 | 6.95 / 26.25 → 5.05 / 8.40 | -27.3% / -68.0% |
| mobile · Pomu · impact | 312,888 → 313,012 | 273 → 275 | 149/5/30 → 151/5/32 | 5.05 / 14.10 → 5.40 / 13.00 | +6.9% / -7.8% |
| mobile · Shiro · charge | 171,268 → 171,268 | 144 → 144 | 126/5/39 → 126/5/40 | 2.75 / 3.70 → 2.65 / 3.75 | -3.6% / +1.4% |
| mobile · Shiro · impact | 250,135 → 250,235 | 223 → 224 | 127/5/45 → 129/5/48 | 4.70 / 7.80 → 4.35 / 7.35 | -7.4% / -5.8% |

The longer quiet check did not reproduce the initial Kairo desktop-impact median regression. The final simplified mobile Shiro charge no longer shows the earlier median slowdown. Desktop Shiro charge still records a mean p95 increase above 10% in its final window, while its median and GPU p95 improve; the initial window did not show that p95 increase. This variation is retained, not presented as zero regression or sustained FPS. Kairo mobile impact has a small p95 cost from the two additional bounded impact draws. Shared-host scheduling/driver variation limits attribution, and physical-phone performance remains unverified.

## Separate Blender candidates

Kairo, Pomu and Shiro each have a dedicated editable `.blend`, applied-transform desktop/mobile GLBs, actual front/three-quarter/side/rear studio renders, current-head reference comparisons and original-coil attachment studies. Their game coordinates remain Y-up, +Z forward, origin zero, 0.12 Y mount and 1.28 Y blink pivot. Normals/geometry and bounds pass validation. Existing unrelated Blender objects and previous candidates were retained in separate scenes/collections; the task-owned localhost connection was stopped after saving.

| Head | Desktop/mobile triangles including original coil | Batches including coil |
| --- | ---: | ---: |
| Kairo | 4,494 / 3,058 | 10 |
| Pomu | 5,685 / 3,749 | 12 |
| Shiro | 4,120 / 2,874 | 7 |

One cached restrained outline draw is separate. Kairo/Pomu have four eye batches; Shiro retains a named empty blink pivot beneath the blindfold. All three stay within 6,000/4,000 triangles and twelve normal-head draws. `src/roster-head.ts` remains an isolated review cache, with production `createHead` and `createHeadOutline` unchanged. The staged real-renderer review demonstrates menu-coil, portrait and 21-snake gameplay attachment, selected profiles, independent resources/blinking, fallback, large crowds, reduced motion and lifecycle restoration.

See `assets/roster/README.md`, `docs/roster-review/` and `docs/ROSTER-POLISH.md`. These normal heads remain candidates pending one visual approval per character, starting with Kairo. The published VFX release retains the existing normal heads. Side and rear anatomy is inferred; physical-phone touch, thermal behavior and prolonged live play remain unreviewed.

## Release delivery

Package/visible versions and documentation are 1.7.5. The local preview is refreshed at http://127.0.0.1:4175/; interactive local review pages are `/tests/ultimate-review.html` and `/tests/roster-review.html`. The refreshed source archive includes editable models, exports and review evidence. Publication updates the existing Anime Coil GPT Site and preserves its public audience; no GitHub publication or new Site. The native deployment receipt is stored in `ultimate-polish/deployment.json` after publishing.
