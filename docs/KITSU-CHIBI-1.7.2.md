# Approved chibi Kitsu integration — Anime Coil 1.7.2

The user approved the Balanced Chibi Naruto sculpture and deployment to GPT Sites. The live normal head is now the approved candidate in menu, portraits, player and bot instances. The existing transformed head, fox summon, body cosmetics, IDs and gameplay contracts remain intact.

## Assets and compatibility

The editable source is [the dedicated Blender model](../assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend). Desktop/mobile runtime GLBs contain 5,507 / 3,597 triangles, or **5,859 / 3,949 including the original 352-triangle coil**. Eleven mesh/material batches plus the coil give twelve normal-head draws, with the existing separate restrained silhouette outline. The blue iris is the fourth eye batch; every clone owns its eye transforms while sharing immutable geometry and cached Lambert materials. No skeleton, reflection or glow pass was added.

Y-up, +Z forward, the 0.12 Y sculpt mount and 1.28 Y blink pivot are unchanged. Promotion preserves the entire approved geometry binary and only updates release/approval metadata. Selected-profile preload, accessible loading feedback, synchronous creation, failed-load fallback and profile caches remain in place.

## Review and checks

Actual menu and gameplay screenshots cover all four maps at 1440x900 and 390x844, reduced motion, large 21-Kitsu crowds, Fox Rush, ultimate transformation/recovery, death/respawn, restart and quit. Each context downloaded one initial profile and only two profiles across twelve switches. Geometry/material sharing and independent blink transforms pass; no owned head resources were disposed during removals, map switches or restarts. Forced network failure still initialized procedural menu and gameplay. Browser review reported no page errors. Raw evidence is in [kitsu-chibi-review](kitsu-chibi-review/).

Concurrent local work advanced the app to 1.7.2 and removed the light-theme control. Those edits were preserved; review used the current dark-only UI. The initial sequential timing run was affected by concurrent source changes and is retained only as diagnostic history. The repeated comparison below holds the renderer and fixture constant and substitutes the old head cache and GLBs through browser interception without changing runtime files.

**336 tests pass**, with zero failures, and `npm run build` succeeds. `git diff --check` passes. The existing Three.js bundle-size warning remains. The simulation, simulation profiler, ultimate definitions, coil cosmetics and head-creation source hashes are unchanged by this integration. GPU median timings in the repeat sample increased from 10.2–10.9 ms to 11.0–11.3 ms; timing windows are short and shared-host conditions limit attribution.

## Matched 21-snake rendering samples

| Measurement | Previous normal head | Approved chibi |
| --- | --- | --- |
| Rendered triangles | 65920 | 66002 |
| Draw calls | 63 | 64 |
| GPU geometry resources | 49 | 50 |
| Textures / programs | 3 / 23 | 3 / 23 |
| CPU median / p95 ms, run 1 | 8.2 / 17.3 | 7.8 / 17.0 |
| CPU median / p95 ms, run 2 | 8.2 / 23.4 | 7.7 / 16.7 |
| CPU median / p95 ms, run 3 | 8.7 / 26.1 | 7.6 / 19.7 |

Three nine-second samples follow a three-second warmup on hardware-accelerated headless Edge / Intel Iris Xe, seed 812, 987 body segments, 850 food, Shibuya, DPR 1. Timing variation and any measured regressions are retained in [the comparison JSON](kitsu-chibi-review/performance-comparison.json); no zero-regression or sustained FPS claim is made. The extra iris adds one geometry resource and one visible draw in this camera sample; normal-head geometry remains within both profile budgets. Physical-phone touch, thermal behavior and prolonged real-device rendering remain unverified. Side and rear anatomy are inferred from the supplied references.

## Delivery and publication

The existing user-owned preview remains at http://127.0.0.1:4175/. The refreshed source archive includes the editable model, exports, comparison sheets and game screenshots. GPT Sites receives the verified production build in its own source checkout, preserving the original dirty Git checkout. Publication follows the user's explicit approval; the new Site retains its default private audience.
