# Anime Coil 1.6.7 — measured performance report

The rendering pass reduces redundant uploads, CPU transform work and offscreen submissions without changing geometry, visual identity or the authoritative 60 Hz simulation. **The whole-game CPU target is not achieved in the final live validation.** Rendering-only replay results pass the CPU target; they cannot establish live-game or display-frame performance.

## Measurement conditions and limits

- Windows, Intel Core i7-11370H, Intel Iris Xe, Edge 154.0.4258.37, hardware-accelerated headless ANGLE/Direct3D11. GPU timer queries were available; disjoint results are rejected. These are hardware-browser measurements, not SwiftShader results, physical-phone tests or foreground display FPS.
- Analytic rendering replay: seed 812, Shibuya, 1440×900 CSS pixels, Auto/desktop detail, original cosmetic, System motion, 21 living snakes and 850 food throughout. Ordinary bodies contain 987 rendered segments; the 360-point-per-snake stress case contains 7,539. Camera/input path and state replay match across stages. Ordinary/stress results are never combined.
- Every timed configuration warms for 10 seconds and records three 30-second samples. Slow frames are retained. Lightweight CPU/GPU diagnostic overhead is included; intrusive GL upload hooks and subsystem submission hooks run separately. GPU samples occur every 30 rendered frames and use bounded asynchronous queries, without blocking waits.
- The fixture advances an analytical body path on a 60 Hz presentation token; it does **not** call Arena.step. Its simulation column means fixture preparation. Separate live validation advances the real simulation at its unchanged fixed 60 Hz.
- There was substantial host scheduling/performance drift. Re-running unchanged baseline source reduced its CPU median from 8.3–9.0 ms to 4.0–4.2 ms. Use the repeated baseline for the conservative ordinary comparison. Raw original and later runs are retained, including regressions; no thermal/clock or unrelated system settings were changed. Sequential stage timings are evidence, not proof that every individual optimization caused a CPU improvement.
- DPR is 1 for the stage tables below. The resolution experiment uses device DPR 2 and effective caps 1.75/1.5. The mobile cap remains 1.35.

## What changed

1. Food slot colors are cached, including replacement/reorder/restart. Snake color caching remains intact; changed colors and matrices use merged active-component ranges rather than unused capacity. Pending offscreen changes remain bounded and are uploaded before the mesh is drawn again.
2. Snake body, outline, shadow and ownership transforms use reusable direct matrix writes and independent dirty dependencies. Radius values update on mass/count changes; static shadows do not follow breathing updates. Growth, freezing, elasticity, boosting and presentation-motion changes invalidate their relevant caches. Heads/player retain render cadence and the existing collision-aligned head policy.
3. Food bob/yaw moves to a cached vertex shader with stable instance phase and pause-aware time. Placement/scale/color update only on data changes; geometry, palette, 0.12-unit bob, 0.6-radian/second yaw and pickup positions are unchanged. Bounds include maximum displacement.
4. Secondary CPU actors use 30 Hz presentation-clock buckets. Camera-sensitive scenery clearance, lighting and sky uniforms remain full rate. Shibuya rain and splash motion uses equivalent shader formulas and static buffers. Pause/hidden tabs freeze the existing clock; reduced motion preserves the existing static treatment.
5. Conservative cached bounds enable culling for body/outline/shadow/ownership, food, weather and bounded background actors. No geometry was removed: submitted triangle reductions are offscreen culling. Camera-centered sky remains an explicit exception; short-lived arbitrary-position skill/cinematic pools retain culling exceptions rather than risk missing effects. Fox model geometry uses its cached local bounds. Bounds honor parent scaling.
6. Desktop DPR is capped at 1.5 at startup and resize. DOM text/class/attribute/visibility/style writes are deduplicated while preserving external dialog writers, focus, one-shot animation restarts and repeated accessibility announcements.
7. Empty shared E-effect pools are hidden. Active pools upload only used matrices and changed instance colors. All six existing geometries and active skill effects are retained. This removes avoidable bytes, not the six additional transparent passes described below.
8. Opt-in diagnostics expose CPU/RAF distributions, FPS, stage costs, GPU timer results, population/body/food counts, visible body segments, DPR, resources, matrix/instance/range counters and a separate subsystem submission audit. Samples are bounded to 8,192 frames and display refresh is once per second; no telemetry is sent.

## Stage measurements

Cells list **run 1; run 2; run 3**, each as median/p95 milliseconds. Calls/triangles are Three.js actual submission counters, not authored map budget maxima.

### Ordinary replay: 21 snakes / 987 segments / 850 food / DPR 1

| Cumulative stage | CPU ms | RAF ms | GPU ms | Calls | Triangles |
| --- | --- | --- | --- | ---: | ---: |
| Original baseline | 8.3/12.1; 9.0/17.2; 8.6/11.0 | 13.7/28.5; 22.4/41.2; 13.3/15.6 | 7.7/10.7; 8.5/23.4; 6.9/8.3 | 125 | 315,016 |
| Repeated unchanged baseline | 4.2/6.3; 4.0/6.1; 4.0/5.9 | 10.3/12.6; 10.2/12.8; 10.1/12.9 | 6.5/7.6; 6.8/8.8; 6.7/8.4 | 125 | 315,016 |
| Color dirty ranges | 4.3/7.1; 4.1/6.8; 4.1/7.1 | 11.8/14.2; 11.9/14.3; 11.9/14.4 | 7.7/9.2; 7.8/9.6; 7.9/8.9 | 125 | 315,016 |
| Initial body cache trial (reworked) | 4.0/6.6; 5.4/10.7; 7.0/13.3 | 12.0/14.9; 13.1/20.8; 14.8/38.3 | 7.9/9.1; 8.2/14.2; 7.5/27.2 | 125 | 315,016 |
| Food shader + body cache | 3.8/6.1; 3.7/6.0; 3.6/5.6 | 9.5/12.0; 9.5/11.8; 9.5/11.9 | 5.9/7.3; 5.9/6.9; 5.8/7.7 | 125 | 315,016 |
| Radius cache + conservative culling | 2.9/5.2; 3.0/5.5; 2.9/5.0 | 8.3/10.7; 8.3/10.9; 8.3/10.8 | 5.3/6.4; 5.4/6.2; 5.3/6.5 | 68 | 64,672 |
| 30 Hz actors + shader weather | 2.7/4.3; 2.7/4.5; 2.6/4.5 | 8.8/11.1; 8.8/11.5; 8.8/11.1 | 5.7/6.8; 5.7/6.8; 5.7/6.7 | 68 | 64,672 |
| DPR cap + DOM cache | 2.9/4.7; 2.7/4.3; 2.7/4.5 | 8.9/11.4; 8.8/11.4; 8.8/11.4 | 6.0/7.0; 5.9/8.3; 5.8/7.2 | 68 | 64,672 |
| Final: empty skill pools + active ranges | 3.2/5.6; 3.1/5.2; 3.1/5.3 | 11.9/15.2; 11.7/14.7; 11.7/15.0 | 8.1/10.7; 7.8/9.6; 7.9/11.1 | 68 | 64,672 |

### Stress replay: 21 snakes / 7,539 segments / 850 food / DPR 1

| Cumulative stage | CPU ms | RAF ms | GPU ms | Calls | Triangles |
| --- | --- | --- | --- | ---: | ---: |
| Original baseline | 7.9/14.3; 7.4/11.0; 7.6/10.6 | 16.6/21.3; 16.6/20.5; 16.7/20.4 | 11.5/16.2; 11.6/16.7; 11.4/15.8 | 125 | 2,149,992 |
| Color dirty ranges | 8.1/13.2; 7.2/9.6; 7.1/11.1 | 17.0/22.0; 16.1/19.0; 16.0/20.1 | 12.0/16.7; 11.2/13.2; 11.0/14.2 | 125 | 2,149,992 |
| Initial body cache trial (reworked) | 8.9/17.4; 12.5/18.7; 13.4/19.1 | 17.3/23.6; 17.2/21.7; 16.8/21.1 | 12.0/16.2; 10.4/12.5; 10.4/12.4 | 125 | 2,149,992 |
| Food shader + body cache | 5.2/7.8; 5.4/7.9; 5.3/7.8 | 13.5/17.3; 13.4/17.2; 13.5/17.0 | 8.8/11.6; 9.1/12.4; 9.0/11.3 | 125 | 2,149,992 |
| Radius cache + conservative culling | 4.7/7.2; 4.6/7.1; 4.8/7.7 | 11.2/13.8; 11.3/14.2; 11.2/14.4 | 7.8/9.4; 7.6/9.2; 7.5/10.3 | 83 | 742,488 |
| 30 Hz actors + shader weather | 4.9/7.3; 4.7/6.7; 4.8/7.3 | 11.8/14.7; 11.7/14.3; 11.8/14.8 | 8.0/10.5; 8.0/10.4; 8.1/8.9 | 83 | 742,488 |
| DPR cap + DOM cache | 4.8/6.9; 5.1/7.7; 4.8/7.1 | 12.0/15.3; 12.2/15.4; 12.1/14.9 | 8.5/10.8; 8.4/10.4; 8.2/9.8 | 83 | 742,488 |
| Final: empty skill pools + active ranges | 6.0/9.0; 5.8/8.7; 5.9/9.1 | 15.8/19.8; 15.7/19.5; 15.8/19.6 | 10.7/15.0; 10.6/15.4; 11.0/14.4 | 83 | 742,488 |

The initial body-cache trial did not establish a gain and was reworked with cached radii before shipping. The final empty-pool stage was slower in elapsed timing than the preceding final stage as both GPU and RAF times rose; it is retained for directly verified unchanged-buffer/upload suppression, not claimed as a timing improvement. The larger original-to-final CPU percentage is not used because the repeated baseline exposed host drift.

## Instance/upload evidence

Separate GL-instrumented representative frames count whole-scene bufferData/bufferSubData calls and bytes. These are **single-frame checks, not timing-run medians**. CPU estimated dirty bytes count only authored snake/food ranges, include offscreen pending edits and therefore differ from actual uploaded bytes. Initial allocations and later visibility re-entry can upload more than these warm-frame checks.

| Stage / workload | Actual upload calls | Actual bytes | Matrix calculations | Changed instances | Dirty ranges | Estimated snake/food bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-repeat / ordinary | 81 | 1687248 | 3839 | 3839 | 66 | 1584560 |
| baseline / ordinary | 81 | 1687248 | 3839 | 3839 | 66 | 1584560 |
| baseline / stress | 81 | 1687248 | 23547 | 23547 | 66 | 1584560 |
| colors / ordinary | 80 | 348384 | 3839 | 3839 | 65 | 245696 |
| colors / stress | 80 | 1609696 | 23547 | 23547 | 65 | 1507008 |
| bodies / ordinary | 59 | 283872 | 2852 | 2831 | 44 | 181184 |
| bodies / stress | 59 | 1125856 | 16008 | 15987 | 44 | 1023168 |
| food / ordinary | 58 | 229472 | 2002 | 1981 | 43 | 126784 |
| food / stress | 58 | 1071456 | 15158 | 15137 | 43 | 968768 |
| cache-cull / ordinary | 20 | 115168 | 2002 | 1981 | 43 | 126784 |
| cache-cull / stress | 30 | 428128 | 15158 | 15137 | 43 | 968768 |
| environment / ordinary | 18 | 108736 | 2002 | 1981 | 43 | 126784 |
| environment / stress | 21 | 412480 | 15158 | 15137 | 43 | 968768 |
| final / ordinary | 18 | 108736 | 2002 | 1981 | 43 | 126784 |
| final / stress | 21 | 412480 | 15158 | 15137 | 43 | 968768 |
| submissions / ordinary | 12 | 21696 | 2002 | 1981 | 43 | 126784 |
| submissions / stress | 22 | 334656 | 15158 | 15137 | 43 | 968768 |

Repeated ordinary baseline→final actual warm-frame uploads: **1,687,248→21,696 bytes**, 81→12 upload calls. Final rendering-replay matrix/instance distributions and stage medians/p95, geometry/texture/program counts, FPS, visible segments and sample counts are in the raw JSON; early instrumentation has representative counts instead of distributions. Shader-driven food has zero animation matrix/color uploads when food slots are unchanged.

## Submission audit and rejected cadence trial

Final ordinary object-submission hooks: heads 29, food 1, environment 24, body 2, outline 2, ownership 1, shadow 2, aura 1, ordinary-scene 2.

Final stress object-submission hooks: heads 29, food 1, environment 24, body 7, outline 7, ownership 1, aura 1, shadow 7, ordinary-scene 2.

Three.js reports 68 ordinary / 83 stress actual draw calls, while object hooks see 62 / 77. Transparent double-sided materials can submit two passes from one object callback; the six-call difference is not an empty-skill optimization or an accounting reduction. Heads and environment dominate object submissions; no global snake batching was introduced. Submission CPU, geometry submission, upload bytes and GPU timer cost are reported separately.

The 30 Hz distant-body trial was **not shipped**. The controlled >60-unit bot experiment retained smooth heads but produced up to 0.2467 units of first-body lag normally and 0.4193 while boosted, versus float32 error under 0.000004 at full rate. Updating only distant bodies would introduce objectionable head/body separation. Full-rate snake bodies remain; only independent background actors use the cadence gate.

## Resolution experiment

Same ordinary replay, viewport, device DPR 2, 21 snakes/987 segments/850 food.

| Effective DPR | CPU ms, three runs | RAF ms, three runs | GPU ms, three runs |
| --- | --- | --- | --- |
| 1.75 | 3.1/4.8; 3.1/4.9; 3.1/5.0 | 25.4/29.3; 25.6/29.7; 25.9/30.1 | 19.3/22.2; 19.0/23.2; 20.2/23.5 |
| 1.5 | 3.2/5.0; 3.0/4.6; 3.2/4.8 | 19.4/23.2; 19.1/23.0; 19.6/23.3 | 14.0/17.5; 13.4/17.7; 13.8/18.6 |

GPU time is resolution-sensitive on this hardware; reducing DPR helped GPU/RAF timing while CPU remained comparable. This supports a pixel-work cost, not a claim that all lag is GPU-bound or that 60 display FPS is verified. Lower-resolution canvas edges/rain/billboards were reviewed alongside unchanged HTML text; no visual design/geometry reduction was made.

## Matched cinematic charge and post-wipe recovery

Spirit Bomb is measured as a held authoritative-stage rendering replay, after advancing the unchanged simulation to 2.2167 seconds (charge) or 4.3167 seconds (recovery). Each stage warms 10 seconds and takes three 30-second samples; its geometry and particles are held at that stage for comparable preparation/submission work. These are not complete live cinematics or real-match FPS. Compare baseline to final **within a stage only**; charge has 21 living snakes/987 segments/850 food, while recovery has 1 living snake/47 segments/1,330 food after the normal wipe.

| Renderer / stage | CPU ms, three runs | RAF ms, three runs | GPU ms, three runs | Actual calls | Triangles |
| --- | --- | --- | --- | ---: | ---: |
| baseline / charge | 13.0/20.4; 13.3/18.3; 13.5/18.5 | 14.4/24.0; 14.7/21.6; 14.7/21.1 | 8.7/12.7; 8.6/11.6; 8.7/11.3 | 206 | 521808 |
| final / charge | 10.4/16.2; 10.1/15.9; 11.7/18.3 | 13.0/18.9; 12.8/18.8; 13.9/21.5 | 8.2/9.5; 8.2/9.9; 9.0/10.6 | 164 | 337344 |
| baseline / recovery | 6.2/8.7; 6.1/8.2; 6.2/8.9 | 16.0/20.5; 15.7/20.2; 15.6/20.7 | 10.7/11.9; 10.6/11.9; 10.7/12.3 | 75 | 319516 |
| final / recovery | 6.4/8.2; 6.5/8.3; 6.4/8.1 | 17.4/21.3; 17.2/21.4; 17.3/21.5 | 12.1/15.8; 12.1/14.3; 12.1/14.9 | 75 | 319516 |

Charge preparation and offscreen submissions improve; recovery elapsed timing does not improve in these samples. The one-survivor recovery is never used to claim a normal-play improvement. Both stages retain their existing visual effects. Upload checks and resource/GPU/stage distributions are included in the raw evidence. Baseline instrumentation grouped effect preparation with the snake stage; final instrumentation separates it, so those individual columns are not directly comparable.

## Real advancing match validation

Actual game/main loop, seed 812, initial 21 snakes and 850 food, Shibuya, 1440×900, device DPR 2/effective 1.5, 60 Hz simulation, 10-second warmup and three 30-second samples. Natural deaths, respawns, growth and drops remain enabled. These runs are **not a before/after speedup comparison**: per-frame population/body/food ranges differ. Only the 21-living-snake subset is shown below; slower frames are retained. The pre-empty-pool live run is included in raw evidence but must not be treated as equivalent state replay.

| Final live run | 21-snake samples | CPU ms | RAF ms | Simulation/events ms | Render preparation: snakes ms | Submission ms | DOM ms | Body segments | Food |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 242 | 9.3/33.2 | 27.3/47.4 | 4.9/23.0 | 0.6/2.2 | 2.4/6.5 | 0.6/1.8 | 834–994 | 850–897 |
| 2 | 110 | 11.4/29.0 | 27.9/44.1 | 5.6/18.3 | 0.9/2.4 | 3.3/8.2 | 0.6/1.6 | 1009–1388 | 850–867 |
| 3 | 157 | 14.7/31.9 | 28.8/46.5 | 7.6/25.5 | 1.0/3.0 | 3.7/6.5 | 0.5/1.5 | 1376–1537 | 850–876 |

**Target assessment: not achieved for ordinary whole-game desktop CPU (<10 ms median, <16.7 ms p95).** The final live sample still has expensive simulation/event/catch-up frames and submission spikes; headless RAF pacing also exceeds 16.7 ms. This pass does not alter simulation or collision algorithms to force the target. A next pass should profile those authoritative costs with an identical recorded-input/state replay before changing simulation architecture. Hardware foreground-browser and physical-phone results remain unverified.

## Lifecycle, visual review and regression checks

- **293 tests pass**, preserving the 277-test baseline and adding 16 cache/range/shader/cadence/DOM/profiler/GPU/lifecycle tests. Rendering-cache use produces byte-identical authoritative outcomes under identical 60 Hz inputs for all four characters. Tests cover unchanged-buffer suppression, replacement/reordering, growth/bounds, independent shadows, pause/reduced motion, empty skill pools, disjoint GPU results and idempotent disposal.
- Production build and diff whitespace checks pass. Vite retains its existing advisory for the shared Three.js chunk over 500 kB; no package/library update is part of this pass.
- Desktop and phone-sized browser review includes all maps/ultimates, large coils, nine skin/trail combinations, boost, skills, pause, reduced motion, light/dark menus/dialogs, death/respawn during the live sample, and restart/map lifecycle. The rendering fixture omits DOM manga overlays, whose regressions remain in the existing suite. The in-app browser connection was unavailable; an owned headless Edge session supplied live WebGL review. Physical-phone touch/frame pacing is unverified.
- Forty measured map switches after priming and eight repeated cycles of each ultimate per viewport show stable warm/final resources. Lazy GPU allocation means counts differ from authored geometry and from the normal-only replay. No page/shader errors were observed in final live/resource runs.

| Viewport | Map | Warm geometries/textures/programs | Final geometries/textures/programs |
| --- | --- | --- | --- |
| Desktop | shibuya | 53/3/22 | 53/3/22 |
| Desktop | leaf | 57/7/24 | 57/7/24 |
| Desktop | tournament | 54/5/21 | 54/5/21 |
| Desktop | harbor | 53/6/24 | 53/6/24 |
| Phone-sized | shibuya | 55/3/23 | 55/3/23 |
| Phone-sized | leaf | 59/7/25 | 59/7/25 |
| Phone-sized | tournament | 56/5/22 | 56/5/22 |
| Phone-sized | harbor | 56/7/26 | 56/7/26 |

The final production preview also checks all 16 character/map E-skill combinations at desktop and phone widths (32 captures), both themes, a 900×480 short window, and End run → recap → restart → quit. It shows 1.6.7, effective desktop DPR 1.5 and phone DPR approximately 1.35, and reports no page/shader errors. An existing brief leaderboard reorder animation can overlap rows during its 220 ms transition; this pass preserves it rather than redesigning the HUD. Simulation, audio and UI CSS match the saved pre-pass source byte-for-byte.

## Files and ownership

- Rendering/data helpers: src/renderer.ts, src/instance-updates.ts, src/food-instances.ts, src/frame-profiler.ts, src/visual-cadence.ts.
- DOM orchestration: src/main.ts and src/dom-presentation.ts.
- Bounds/cadence/weather/diagnostics: src/worlds/builder.ts, atmosphere.ts, life.ts, leaf.ts, shibuya-life.ts, shibuya-weather.ts, shibuya-sky.ts and diagnostics.ts; cached fox geometry culling in src/fox-model.ts. src/spirit.ts exposes its presentation group for the separate submission audit.
- Validation/reproduction: tests/performance.test.ts, tests/perf-harness.html/.ts and scripts/perf-benchmark.mjs / perf-cinematic-benchmark.mjs.
- Release metadata/report: package.json, package-lock.json, index.html, src/ui.ts, README.md and docs/PERFORMANCE-1.6.7.md / performance-results-1.6.7.json.
- Prior local map/cinematic/simulation/UI edits remain in the working tree and source archive. Their Git diff predates this performance pass; it is not a list of performance-only changes. No commit or push is performed.

## Reproduction and delivery

Use npm run dev and the development-only /tests/perf-harness.html?perfDebug fixture. Run scripts/perf-benchmark.mjs with PLAYWRIGHT_MODULE set to an installed Playwright module and PERF_BROWSER set to the local browser executable; arguments are stage label, Vite port, and output directory. PERF_DPR=2 runs the resolution case. Each invocation performs the specified warmup and three samples automatically. scripts/perf-cinematic-benchmark.mjs uses the same arguments for the two held Spirit Bomb stages. Do not run resource/screenshots or unrelated intensive jobs concurrently with timed samples. Use ?perfDebug in the real game for separate whole-frame validation; the diagnostic display refresh is intentionally outside the measured frame callback.

Raw stage distributions, GL checks, subsystem submissions, live population ranges, GPU availability and resource checks are bundled in [performance-results-1.6.7.json](performance-results-1.6.7.json). Representative screenshots remain in ../v167-review outside the source archive. Version 1.6.7 updates package metadata, page/menu/credits and this release documentation. The production preview and source archive are refreshed; Git publishing and website deployment remain excluded. Earlier local simulation/map/cinematic/UI edits are preserved.
