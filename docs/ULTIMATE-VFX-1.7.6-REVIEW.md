# Anime Coil 1.7.6 candidate — Catastrophic Ultimate VFX

The local candidate rebuilds the four finisher impacts around a shared, arena-scale blast kit. Each keeps a distinct shape and palette: Kitsu has golden claw arcs and offset chakra explosions around the approved violet tailed-beast projectile; Kairo has a compact unstable blue sphere, white-blue radial beams and a raised plasma shell; Shiro has a fractured purple-white burst, broken waves and long jagged cracks; Pomu has stronger elastic fist compression, cream/ink loops and rebounding pressure fronts. Smoke and residual fragments continue through a bounded aftermath instead of ending immediately after the hit.

## Review and release state

This is a **1.7.6 visual-review candidate**. Package and visible versions deliberately remain **1.7.5**. The existing public GPT Site remains **1.7.4**; neither the unfinished prior release nor this candidate was published during this work. The agreed combined visual approval precedes the 1.7.6 version bump and publication to that same Site. Kairo, Pomu and Shiro normal-head approvals remain separate.

Local gameplay: http://127.0.0.1:4175/. Interactive held comparison: http://127.0.0.1:4175/tests/ultimate-review.html. Choose candidate/baseline, profile, comfort flags and boundary/crowd options. `ultimateReview.select(false,'174')` selects the older frozen effect baseline for reproducible diagnostics.

- [Animated candidate preview](ultimate-catastrophe/animated-preview.webm)
- [Animated before/candidate comparison](ultimate-catastrophe/animated-comparison.webm)
- [Matched charge and expansion screenshots](ultimate-catastrophe/comparison.png)
- [Timeline](ultimate-catastrophe/timeline.png), [exact kill keyframes](ultimate-catastrophe/exact-keyframes.png), [phone-width application screenshots](ultimate-catastrophe/phone-review.png)

All media comes from actual browser rendering. Video captures are 25 fps; montages resample to 12 fps using recorded simulation/wall-time traces, so visual alignment is approximate. No blast imagery is painted or generated. Exact-keyframe screenshots hold browser scheduling immediately after the real application's first kill render. Ordinary live recordings and the fixed-step trace independently demonstrate the wipe and later restoration. Held comparison crowds intentionally remain alive for a matched 21-snake rendering load; live gameplay eliminates all 20 opponents.

## Runtime and gameplay

`UltimateVisualClock` returns one reused presentation frame consumed by the DOM artwork, effect owners, world blast, lighting response and camera punch. It latches the first authoritative detonated render, including a render arriving after the ideal timestamp. The manga keyframe and bright core therefore occur on the same rendered beat as the wipe. Reduced flashes removes the hard keyframe and suppresses the abrupt light response; reduced motion additionally removes the fast streaks, satellites, tail whip and camera movement while retaining subdued broad shapes. Camera disabled preserves gameplay framing.

The authoritative blast remains at 3.4 seconds and the cinematic completes at 5.6. Captured fixed-step traces cross the threshold at 3.4167 seconds (occasionally the next render at 3.4333), consistent with the existing fixed-step simulation. Normal heads restore at completion. Cooldowns, deterministic RNG, kills, collisions, trajectories, radius-based mouth clearance, body cosmetics, transformed heads and respawn behavior remain intact.

The simulation, head factory, Kitsu cache and latest eye fixes, Kurama cache and both approved profiles are byte-for-byte identical to the pre-candidate snapshot: eight verified SHA-256 hashes are recorded in `ultimate-catastrophe/preserved-before.json` and `preserved-after.json`. Renderer/effect updates are state-readonly in the all-stage checks. Shibuya remains the only arena.

## Bounded rendering kit

The renderer owns four immutable geometry batches and four cached materials: core/satellite billboards, warped ring fronts, segmented streaks/fragments/sparks, and smoke billboards. Seeded render-only events are written once per impact/kind and reused across profile changes; no arena randomness is consumed. Profile changes retain the common event prefix, pose and cinematic time. Per-frame work sets object transforms and shader uniforms/counts; it creates no blast geometry or materials. Shaders are warmed before the first impact. The existing bounded elastic-arm updates remain.

| Pool | Desktop | Mobile |
| --- | ---: | ---: |
| Main core plus satellites | 9 | 4 |
| Warped fronts | 3 | 2 |
| Long streaks | 32 | 16 |
| Fragments | 32 | 16 |
| Sparks | 64 | 32 |
| Smoke lobes | 24 | 10 |
| Submitted new blast triangles | 2,690 | 1,436 |
| New blast draws / materials | 4 / 4 | 4 / 4 |

Reduced motion uses one core, one fixed front, eight subdued sparks and four smoke lobes. The far front scales from impact position to pass the opposite arena boundary. It is excluded from camera-fit bounds. The recoil/FOV pulse settles within 300 ms; portrait framing uses a higher angle to reduce foreground-building obstruction and blends back during recovery. Aftermath duration from the hit is 1.5 seconds for Fox/Purple, 1.4 for Spirit and 1.2 for Skybreaker.

The managed blast replaces overlapping legacy impact layers; their hidden instance counts are zero before any old update loop. Production owners no longer create four separate two-material pressure kits. The shared kit is disposed once at renderer teardown, and cleared on completion, death, restart, quit and map reset. Approved asset caches survive individual snake removals and map rebuilds. There is no new glow/reflection pass, skeleton or light.

Peak submitted effect draws across the audited held stages:

- desktop: Kitsu 12, Kairo 12, Shiro 15, Pomu 10 (budget 24 each).
- mobile: Kitsu 12, Kairo 10, Shiro 15, Pomu 10 (budget 16 each).

## Validation

`npm test`: **329 passed**, including preserved authoritative regressions, asset schema/orientation/bounds/profile budgets, cache/fallback/disposal contracts, independent blinking, finite geometry, seeded profile reuse, skipped-render kill presentation and comfort flags. `npm run build` passes; Vite retains the existing Three.js chunk-size advisory. Diff checks pass.

The application validation records **53 checks** at 1440×900 and 390×844: normal menu assets, selected-only initial profile requests, subsequent caching, no candidate-head downloads, state-readonly held updates, profile switching during a detonated 3.65-second impact without reset, normal-head restoration, death/respawn, restart/quit, stable repeated Shibuya rebuild resources, actual reduced-motion/flash/camera controls and failed-load fallback. Eight live casts additionally prove the 20-opponent wipe and restored normal head; eight exact-keyframe stills show the synchronized impact. The held review produces 112 before/candidate stage captures, plus comfort, camera-disabled, large same-character crowd and boundary-cast screenshots. All captures report no page/shader errors.

## Matched performance measurements

The seeded held scene has 21 living snakes of mass 48 and 850 food on Shibuya. Hardware is headless Edge on Intel Iris Xe, ANGLE D3D11, DPR 1. Frozen effect sources use the same current renderer/caches to isolate effect implementations; full previous-version application videos additionally verify the prior presentation. The shared warmed shader kit is present in the diagnostic renderer for both variants, so resource totals are not cold-start release-footprint measurements. Camera differences can reveal different scene objects, especially in portrait mode; supplementary camera-disabled pairs isolate that variable.

All pairs use ABBA order. Initial windows use 2 seconds warmup and 3.5 seconds measurement; every initial CPU/GPU mean-of-runs regression above 10% gets a 4-second warmup / 6-second repeat. The tables average two run medians and two p95s; they do not pool frame quantiles. G/T/P means uploaded geometries/textures/programs. GPU timing is sparse and asynchronous (one query every 30 renders), with raw sample counts retained. Whole-scene counts include ordinary scene/head draws. Timing is not a physical-phone FPS guarantee.

### Initial 1.7.5 comparison

| Profile / character / stage | Triangles before → candidate | Calls | G/T/P resources | CPU median / p95 ms | CPU change | GPU median / p95 ms |
| --- | ---: | ---: | --- | --- | --- | --- |
| desktop · Kitsu · aftermath | 513,215 → 509,569 | 438 → 432 | 165/5/53 → 155/5/46 | 6.90 / 12.90 → 7.60 / 12.45 | +10.1% / -3.5% | 10.89 / 12.38 → 9.87 / 11.27 |
| desktop · Kitsu · charge | 478,369 → 480,417 | 389 → 390 | 133/5/39 → 133/5/39 | 6.80 / 9.85 → 6.75 / 9.35 | -0.7% / -5.1% | 8.43 / 10.09 → 8.72 / 9.61 |
| desktop · Kitsu · impact | 513,323 → 509,569 | 439 → 432 | 144/5/42 → 133/5/34 | 7.40 / 10.25 → 7.50 / 11.45 | +1.4% / +11.7% | 9.47 / 10.70 → 9.77 / 10.24 |
| desktop · Kitsu · ordinary-21 | 171,302 → 171,302 | 116 → 116 | 118/5/31 → 118/5/31 | 4.20 / 6.40 → 4.20 / 6.70 | -0.0% / +4.7% | 8.16 / 9.48 → 8.42 / 9.80 |
| desktop · Shiro · aftermath | 456,268 → 451,918 | 392 → 389 | 163/5/48 → 156/5/46 | 5.95 / 8.40 → 6.10 / 10.40 | +2.5% / +23.8% | 10.68 / 11.47 → 10.46 / 12.98 |
| desktop · Shiro · charge | 270,228 → 272,276 | 218 → 219 | 157/5/47 → 157/5/47 | 4.80 / 7.45 → 4.40 / 7.05 | -8.3% / -5.4% | 8.99 / 9.96 → 8.80 / 10.32 |
| desktop · Shiro · impact | 429,428 → 420,540 | 365 → 339 | 164/5/53 → 155/5/46 | 6.90 / 9.65 → 8.05 / 13.20 | +16.7% / +36.8% | 9.40 / 10.67 → 9.38 / 11.14 |
| desktop · Pomu · aftermath | 468,674 → 465,748 | 393 → 390 | 162/5/47 → 155/5/44 | 6.80 / 9.35 → 7.95 / 12.55 | +16.9% / +34.2% | 10.84 / 12.38 → 10.09 / 11.20 |
| desktop · Pomu · charge | 416,324 → 418,372 | 344 → 345 | 158/5/35 → 158/5/35 | 7.50 / 11.30 → 7.90 / 14.75 | +5.3% / +30.5% | 9.23 / 10.90 → 10.00 / 11.37 |
| desktop · Pomu · impact | 484,936 → 469,014 | 408 → 403 | 162/5/36 → 155/5/32 | 6.50 / 9.95 → 8.35 / 12.75 | +28.5% / +28.1% | 10.25 / 10.89 → 10.25 / 11.41 |
| desktop · Kairo · aftermath | 466,944 → 447,986 | 381 → 377 | 161/5/46 → 154/5/43 | 6.40 / 8.30 → 7.65 / 11.85 | +19.5% / +42.8% | 13.09 / 15.21 → 9.82 / 10.38 |
| desktop · Kairo · charge | 413,620 → 415,668 | 346 → 347 | 138/5/33 → 138/5/33 | 6.60 / 9.55 → 7.10 / 11.75 | +7.6% / +23.0% | 9.45 / 11.12 → 9.18 / 10.83 |
| desktop · Kairo · impact | 461,852 → 441,730 | 371 → 364 | 140/5/35 → 132/5/31 | 6.55 / 9.85 → 7.85 / 11.90 | +19.8% / +20.8% | 9.29 / 10.54 → 10.55 / 11.05 |
| mobile · Kitsu · aftermath | 456,891 → 454,147 | 422 → 420 | 164/5/52 → 155/5/45 | 3.30 / 4.70 → 3.55 / 4.85 | +7.6% / +3.2% | 2.38 / 3.23 → 2.47 / 3.33 |
| mobile · Kitsu · charge | 363,001 → 366,001 | 329 → 335 | 128/5/39 → 128/5/39 | 3.10 / 4.60 → 3.05 / 4.30 | -1.6% / -6.5% | 2.22 / 2.77 → 2.60 / 3.02 |
| mobile · Kitsu · impact | 413,543 → 410,703 | 379 → 372 | 141/5/42 → 131/5/34 | 3.25 / 4.55 → 3.05 / 4.45 | -6.2% / -2.2% | 2.79 / 3.45 → 2.48 / 3.45 |
| mobile · Kitsu · ordinary-21 | 139,992 → 139,992 | 110 → 110 | 115/5/31 → 115/5/31 | 2.15 / 3.35 → 2.35 / 3.60 | +9.3% / +7.5% | 1.12 / 1.65 → 1.30 / 1.73 |
| mobile · Shiro · aftermath | 262,420 → 269,992 | 245 → 245 | 154/5/47 → 148/5/45 | 3.25 / 4.60 → 3.15 / 4.40 | -3.1% / -4.3% | 2.17 / 2.62 → 2.16 / 3.51 |
| mobile · Shiro · charge | 171,268 → 172,292 | 144 → 145 | 153/5/46 → 153/5/46 | 1.65 / 2.65 → 2.50 / 3.70 | +51.5% / +39.6% | 2.02 / 2.39 → 1.84 / 2.09 |
| mobile · Shiro · impact | 250,235 → 245,188 | 224 → 215 | 156/5/52 → 147/5/45 | 3.10 / 4.45 → 2.45 / 3.60 | -21.0% / -19.1% | 2.44 / 3.01 → 2.22 / 2.65 |
| mobile · Pomu · aftermath | 329,556 → 324,668 | 283 → 276 | 155/5/46 → 150/5/43 | 2.95 / 4.30 → 2.80 / 4.15 | -5.1% / -3.5% | 2.53 / 2.94 → 2.26 / 2.68 |
| mobile · Pomu · charge | 303,952 → 304,976 | 260 → 261 | 154/5/35 → 154/5/35 | 3.05 / 4.30 → 2.70 / 3.75 | -11.5% / -12.8% | 2.45 / 2.93 → 2.12 / 2.98 |
| mobile · Pomu · impact | 313,012 → 306,380 | 275 → 260 | 155/5/36 → 149/5/32 | 2.95 / 4.30 → 3.05 / 4.30 | +3.4% / +0.0% | 2.08 / 2.70 → 2.15 / 2.72 |
| mobile · Kairo · aftermath | 333,962 → 321,222 | 292 → 290 | 154/5/44 → 149/5/42 | 3.00 / 4.35 → 3.10 / 4.35 | +3.3% / +0.0% | 2.60 / 3.72 → 2.28 / 2.76 |
| mobile · Kairo · charge | 309,614 → 310,638 | 257 → 258 | 134/5/33 → 134/5/33 | 2.50 / 3.55 → 2.70 / 3.95 | +8.0% / +11.3% | 2.27 / 2.59 → 2.38 / 2.61 |
| mobile · Kairo · impact | 314,894 → 295,316 | 278 → 255 | 132/5/34 → 126/5/31 | 2.75 / 4.05 → 2.65 / 3.85 | -3.6% / -4.9% | 1.97 / 2.58 → 1.90 / 2.55 |

### Longer repeats of all flagged initial windows

| Profile / character / stage | Triangles before → candidate | Calls | G/T/P resources | CPU median / p95 ms | CPU change | GPU median / p95 ms |
| --- | ---: | ---: | --- | --- | --- | --- |
| desktop · Kitsu · aftermath | 513,215 → 509,569 | 438 → 432 | 143/5/41 → 133/5/34 | 7.00 / 12.15 → 7.45 / 10.55 | +6.4% / -13.2% | 11.57 / 13.61 → 9.86 / 11.23 |
| desktop · Kitsu · impact | 513,323 → 509,569 | 439 → 432 | 144/5/42 → 133/5/34 | 7.05 / 10.10 → 7.00 / 9.90 | -0.7% / -2.0% | 9.30 / 11.19 → 9.50 / 11.26 |
| desktop · Shiro · aftermath | 456,268 → 451,918 | 392 → 389 | 141/5/51 → 134/5/49 | 6.00 / 8.90 → 5.80 / 8.65 | -3.3% / -2.8% | 11.01 / 11.87 → 9.89 / 11.43 |
| desktop · Shiro · impact | 429,428 → 420,540 | 365 → 339 | 142/5/56 → 133/5/49 | 6.85 / 10.85 → 6.70 / 10.00 | -2.2% / -7.8% | 9.78 / 11.50 → 9.89 / 11.33 |
| desktop · Pomu · aftermath | 468,674 → 465,748 | 393 → 390 | 162/5/35 → 155/5/32 | 6.85 / 10.10 → 8.45 / 12.90 | +23.4% / +27.7% | 11.30 / 12.36 → 9.84 / 11.26 |
| desktop · Pomu · charge | 416,324 → 418,372 | 344 → 345 | 155/5/35 → 155/5/35 | 7.65 / 11.25 → 7.10 / 11.40 | -7.2% / +1.3% | 9.77 / 10.89 → 9.71 / 11.43 |
| desktop · Pomu · impact | 484,936 → 469,014 | 408 → 403 | 162/5/36 → 155/5/32 | 7.00 / 10.45 → 9.70 / 14.60 | +38.6% / +39.7% | 10.43 / 11.91 → 10.73 / 12.05 |
| desktop · Kairo · aftermath | 466,944 → 447,986 | 381 → 377 | 139/5/34 → 132/5/31 | 6.55 / 8.55 → 8.30 / 12.65 | +26.7% / +48.0% | 13.39 / 14.39 → 9.72 / 11.33 |
| desktop · Kairo · charge | 413,620 → 415,668 | 346 → 347 | 135/5/33 → 135/5/33 | 7.35 / 10.75 → 6.55 / 9.85 | -10.9% / -8.4% | 9.52 / 10.57 → 9.55 / 10.46 |
| desktop · Kairo · impact | 461,852 → 441,730 | 371 → 364 | 140/5/35 → 132/5/31 | 6.70 / 9.75 → 8.20 / 12.25 | +22.4% / +25.6% | 9.58 / 11.60 → 10.42 / 11.76 |
| mobile · Kitsu · charge | 363,001 → 366,001 | 329 → 335 | 128/5/39 → 128/5/39 | 3.30 / 4.60 → 3.45 / 4.80 | +4.5% / +4.3% | 2.16 / 2.68 → 2.56 / 2.76 |
| mobile · Kitsu · ordinary-21 | 139,992 → 139,992 | 110 → 110 | 115/5/31 → 115/5/31 | 2.05 / 3.20 → 1.90 / 3.10 | -7.3% / -3.1% | 1.64 / 1.81 → 1.64 / 1.71 |
| mobile · Shiro · aftermath | 262,420 → 269,992 | 245 → 245 | 131/5/50 → 125/5/48 | 2.55 / 3.75 → 3.00 / 4.30 | +17.6% / +14.7% | 2.32 / 2.89 → 2.07 / 2.62 |
| mobile · Shiro · charge | 171,268 → 172,292 | 144 → 145 | 127/5/44 → 127/5/44 | 1.80 / 2.75 → 2.95 / 4.20 | +63.9% / +52.7% | 1.71 / 2.14 → 1.88 / 2.17 |
| mobile · Kairo · charge | 309,614 → 310,638 | 257 → 258 | 130/5/33 → 130/5/33 | 2.65 / 4.05 → 2.75 / 4.00 | +3.8% / -1.2% | 2.17 / 2.59 → 2.22 / 2.51 |

### Frozen 1.7.4 ordinary/impact comparison

| Profile / character / stage | Triangles before → candidate | Calls | G/T/P resources | CPU median / p95 ms | CPU change | GPU median / p95 ms |
| --- | ---: | ---: | --- | --- | --- | --- |
| desktop · Kitsu · impact | 513,151 → 509,569 | 437 → 432 | 142/5/40 → 133/5/34 | 7.20 / 10.80 → 7.70 / 12.35 | +6.9% / +14.4% | 9.34 / 11.02 → 9.16 / 10.65 |
| desktop · Kitsu · ordinary-21 | 171,302 → 171,302 | 116 → 116 | 118/5/31 → 118/5/31 | 4.70 / 7.80 → 4.90 / 8.70 | +4.3% / +11.5% | 8.29 / 9.92 → 8.64 / 10.58 |
| desktop · Shiro · impact | 429,304 → 420,540 | 364 → 339 | 162/5/50 → 155/5/46 | 6.65 / 9.60 → 6.55 / 9.65 | -1.5% / +0.5% | 9.57 / 10.71 → 9.14 / 10.32 |
| desktop · Pomu · impact | 484,764 → 469,014 | 406 → 403 | 160/5/34 → 155/5/32 | 6.65 / 9.55 → 8.75 / 12.75 | +31.6% / +33.5% | 9.27 / 10.65 → 10.05 / 10.83 |
| desktop · Kairo · impact | 676,576 → 441,730 | 369 → 364 | 138/5/33 → 132/5/31 | 6.40 / 9.55 → 8.00 / 12.15 | +25.0% / +27.2% | 9.59 / 10.32 → 10.06 / 11.55 |
| mobile · Kitsu · impact | 413,419 → 410,703 | 377 → 372 | 139/5/40 → 131/5/34 | 3.20 / 4.60 → 3.05 / 4.20 | -4.7% / -8.7% | 2.63 / 3.36 → 2.44 / 3.12 |
| mobile · Kitsu · ordinary-21 | 139,992 → 139,992 | 110 → 110 | 115/5/31 → 115/5/31 | 1.60 / 2.70 → 2.00 / 3.25 | +25.0% / +20.4% | 1.42 / 1.69 → 1.53 / 1.78 |
| mobile · Shiro · impact | 250,135 → 245,188 | 223 → 215 | 154/5/49 → 147/5/45 | 2.80 / 4.10 → 2.60 / 4.05 | -7.1% / -1.2% | 2.37 / 2.59 → 2.27 / 2.68 |
| mobile · Pomu · impact | 312,888 → 306,380 | 273 → 260 | 153/5/34 → 149/5/32 | 2.75 / 3.95 → 3.00 / 4.15 | +9.1% / +5.1% | 2.54 / 3.14 → 2.25 / 2.64 |
| mobile · Kairo · impact | 436,738 → 295,316 | 276 → 255 | 130/5/32 → 126/5/31 | 2.65 / 4.05 → 2.50 / 3.65 | -5.7% / -9.9% | 1.97 / 2.68 → 2.46 / 3.19 |

### Supplemental fixed-camera impact pairs

| Profile / character / stage | Triangles before → candidate | Calls | G/T/P resources | CPU median / p95 ms | CPU change | GPU median / p95 ms |
| --- | ---: | ---: | --- | --- | --- | --- |
| desktop · Kitsu · impact | 189,940 → 186,186 | 134 → 127 | 132/5/42 → 121/5/34 | 3.70 / 6.80 → 3.15 / 5.55 | -14.9% / -18.4% | 8.59 / 9.93 → 8.47 / 9.56 |
| desktop · Shiro · impact | 177,480 → 175,054 | 130 → 123 | 131/5/53 → 122/5/46 | 3.25 / 5.35 → 3.25 / 5.55 | -0.0% / +3.7% | 9.02 / 11.66 → 9.00 / 10.28 |
| desktop · Pomu · impact | 191,376 → 188,630 | 132 → 130 | 150/5/36 → 144/5/32 | 4.00 / 6.65 → 4.95 / 7.90 | +23.7% / +18.8% | 9.48 / 10.98 → 8.96 / 10.81 |
| desktop · Kairo · impact | 191,988 → 172,922 | 124 → 119 | 129/5/35 → 121/5/31 | 3.95 / 6.80 → 5.00 / 7.60 | +26.6% / +11.8% | 8.83 / 10.85 → 9.19 / 10.38 |

7 longer repeat windows still exceed 10% in at least one CPU/GPU summary. These are retained in `performance-comparison.json`; remaining costs and host variance are discussed in the review findings below. Ordinary-play geometry/draw counts are identical; impact draw reductions do not imply zero CPU cost.

## Review findings and limitations

See `ultimate-catastrophe/performance-findings.md` for the final interpretation of the original, repeated and fixed-camera runs. Physical-phone touch, sustained GPU/thermal performance and prolonged live-play review remain unverified. Side/rear anatomy of the separate Blender roster candidates remains inferred.

Kairo, Pomu and Shiro editable models, desktop/mobile GLBs, four actual studio views, comparisons and coil studies remain in `assets/roster/candidates/` and `docs/roster-review/`. Production head/outline factories stay unchanged; no candidate is silently promoted. See [roster review](ROSTER-POLISH.md).

The refreshed source/review archive receipt is `ultimate-catastrophe/local-archives.json`. Publication and visible/package version promotion are the next step after the agreed visual approval. No GitHub publication or additional Site is part of this candidate.
