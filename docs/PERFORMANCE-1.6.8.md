# Anime Coil 1.6.8 — Simulation and event performance

The fixed 60 Hz simulation is preserved. Three measured spatial-work changes reduce matched whole-frame CPU p95; **the <10 ms median / <16.7 ms p95 whole-game CPU target is not achieved**. Freely advancing headless hardware-browser runs measure 15.3/24.5; 14.3/23.0; 17.5/27.6 ms. No rendering-only result is used to claim this target.

## Protocol and evidence

- Windows, Intel Iris Xe, headless Edge 154 with hardware ANGLE/Direct3D11; 1440×900 CSS pixels, device DPR 2, effective DPR 1.5, Shibuya, desktop Auto profile, original cosmetic, System motion. GPU timer queries are available. This is neither software-browser evidence nor foreground display/physical-phone testing.
- Each configuration warms rendering for 10 seconds, then advances 600 fixed ticks and records three consecutive 1,800-tick windows. A window may finish a few ticks late because the existing frame catch-up batch completes. These are approximately 30 active-simulation seconds, not necessarily 30 wall-clock seconds under slow replay. Warm/checkpoint states and every input schedule are recorded.
- Starting state: LCG seed 812, 21 snakes and 850 food. The live game remains free to kill, grow, shed food and respawn snakes; populations are not held artificially constant. Every paired replay has identical recorded delta schedules, tick windows, RNG state/call count, numeric state and ordered end-state events. The full differential tests compare complete state, grid contents and events at every tick.
- The dev fixture runs Arena.step and the existing main-loop consumers (compass, progression/storage, unlock summaries, practice, VFX, elimination stamps and audio) in their original order. No event consumer was removed. The production bundle excludes the benchmark and frozen fixture.
- The baseline is the frozen v1.6.7 simulation at a8e893b. Both simulations use the unchanged v1.6.7 renderer; this pass does not touch renderer, geometry, shaders, maps, skills or audio. The original 0.1-second delta clamp and accumulator subtraction remain intact. Freely advancing validation uses actual RAF deltas instead of a replay.
- Diagnostics use bounded 8,192-sample rings. Detailed method wrappers/timers are opt-in; no timers run per body segment. Slow frames are retained. Separate CPU/heap/GC traces are intrusive and excluded from final timing samples.
- Raw full-state captures, screenshots and traces are retained locally in ../v168-review. [The evidence bundle](performance-results-1.6.8.json) includes captured deltas, all diagnostic distributions, resource/population conditions, trace summaries and SHA-256 state checkpoints. It avoids embedding megabytes of duplicate full snake state.

## Confirmed hotspots and retained changes

1. **Empty projectile target construction:** v1.6.7 rebuilt a complete target grid even with no projectiles. An early return removes that work without RNG calls, events or state mutation.
2. **Identical indexing snapshots:** food indexing now refreshes only after array identity/length or spawn revision changes; body indexing reuses only when all living identities/order, masses, lengths and every indexed coordinate remain equal. Explicit public reindex calls still rebuild. Spawn revisions also invalidate equal-length cap replacement. Empty food-consumption sets no longer allocate an identical filtered array. No cell traversal, floating-point radius arithmetic or candidate ordering changes. Cache state is held in a WeakMap outside authoritative state and is collected with its arena.
3. **Projectile target reuse:** live projectiles merge heads with the existing post-movement body grid in the original x/z cell and per-snake head/body order, excluding snakes already killed by collision processing. Candidate scratch is local to the projectile batch; public spatial queries still return independent arrays. Nonstandard external grid sizes fall back to the original target-grid path. Swept hit arithmetic and ID tie-breaking are unchanged.

Measured indexing and target-grid construction dominate slow simulation frames. Movement, collision tests, AI cadence, respawn search, RNG, forced-motion substeps and event consumers remain unchanged. Event medians/p95 were generally small relative to indexing, so no speculative event rewrite was retained.

## Isolated/cumulative ordinary measurements

All cells are run 1; run 2; run 3, median/p95 CPU milliseconds. Architectural experiments were applied individually after the baseline and tested; rejected source is not shipped. Host drift is material, so repeated unchanged baseline and interleaved source runs are included.

| Source/configuration | CPU median/p95 ms | Decision |
| --- | --- | --- |
| Initial frozen baseline | 19.7/32.3; 20.6/34.2; 23.1/42.2 | Reference |
| Empty projectile guard | 17.7/30.7; 18.9/33.6; 21.4/39.9 | Retained |
| Pooled body records / cached radius base | 17.9/30.4; 19.9/32.8; 22.4/39.9 | Rejected: mixed median/p95 |
| Numeric cells / pooled rows and query scratch | 18.5/35.8; 18.4/35.8; 21.6/44.2 | Rejected: p95 regression |
| Guard + verified snapshot reuse | 12.1/25.2; 14.3/25.5; 17.0/29.6 | Retained |
| Previous + projectile index reuse | 15.8/25.2; 15.5/24.5; 17.3/29.2 | Retained cumulative |
| Repeated frozen baseline | 18.5/32.9; 19.4/33.4; 22.0/40.2 | Host drift check |
| Interleaved snapshot-only source | 14.7/26.7; 15.4/25.8; 16.4/32.9 | Comparison |
| Interleaved cumulative source | 14.8/23.7; 14.2/23.7; 16.5/32.5 | Retained |
| Direct-field body records replacing spread | 11.0/26.7; 14.6/29.1; 17.2/30.1 | Rejected: mixed median/p95 |
| Frozen baseline, detailed timers off | 16.2/36.9; 19.7/41.9; 22.6/44.3 | Overhead/reference |
| Cumulative source, detailed timers off | 12.3/22.7; 13.4/24.1; 15.9/28.0 | Final matched replay |
| Cumulative, freely advancing RAF, detail off | 15.3/24.5; 14.3/23.0; 17.5/27.6 | Whole-game acceptance |

Snapshot reuse has the clearest sustained effect; projectile reuse makes the abilities stage nearly disappear even in projectile-heavy combat. These trials are not clean thermal/clock-controlled laboratory measurements. No system graphics or power settings were changed. Detailed-off baseline p95 rises despite lower median, showing host drift; an exact instrumentation-overhead subtraction is not supported. Detail-on/off matched CPU data is supplied rather than presenting that subtraction as a measured fact.

## Matched whole-frame latency, slow frames and RAF pacing

| Configuration / run | CPU median/p95 | Worst CPU | Frames | CPU >16.7 / >25 / >33.3 ms | RAF median/p95 |
| --- | --- | ---: | ---: | --- | --- |
| baseline-repeat-ordinary / 1 | 18.5/32.9 | 54.9 | 1017 | 649 / 173 / 49 | 26.0/43.9 |
| baseline-repeat-ordinary / 2 | 19.4/33.4 | 52.8 | 1000 | 694 / 217 / 51 | 26.1/42.6 |
| baseline-repeat-ordinary / 3 | 22.0/40.2 | 62.9 | 958 | 763 / 342 / 107 | 27.0/48.4 |
| final-repeat-ordinary / 1 | 14.8/23.7 | 83.0 | 1017 | 338 / 37 / 6 | 23.7/37.3 |
| final-repeat-ordinary / 2 | 14.2/23.7 | 155.9 | 1000 | 307 / 40 / 8 | 24.1/37.1 |
| final-repeat-ordinary / 3 | 16.5/32.5 | 100.0 | 958 | 471 / 144 / 41 | 24.6/43.7 |
| baseline-no-detail-ordinary / 1 | 16.2/36.9 | 109.9 | 1017 | 480 / 169 / 77 | 45.2/69.5 |
| baseline-no-detail-ordinary / 2 | 19.7/41.9 | 192.1 | 1000 | 614 / 260 / 106 | 32.4/62.7 |
| baseline-no-detail-ordinary / 3 | 22.6/44.3 | 148.8 | 958 | 733 / 386 / 164 | 30.3/53.9 |
| final-no-detail-ordinary / 1 | 12.3/22.7 | 147.7 | 1017 | 236 / 17 / 2 | 29.7/38.5 |
| final-no-detail-ordinary / 2 | 13.4/24.1 | 165.9 | 1000 | 321 / 38 / 10 | 29.3/39.7 |
| final-no-detail-ordinary / 3 | 15.9/28.0 | 138.5 | 958 | 429 / 86 / 19 | 28.8/42.1 |
| final-live-ordinary / 1 | 15.3/24.5 | 141.1 | 1065 | 446 / 43 / 7 | 27.8/38.9 |
| final-live-ordinary / 2 | 14.3/23.0 | 72.8 | 1058 | 376 / 29 / 3 | 28.0/38.5 |
| final-live-ordinary / 3 | 17.5/27.6 | 50.1 | 1054 | 582 / 92 / 14 | 28.0/42.4 |

Worst-frame improvement is **not** universal: rare final-run stalls still reach 100–205 ms in some scenarios. They are retained, not trimmed. RAF pacing includes GPU/browser scheduling and is measured from actual wall time, even while the simulation delta schedule is replayed; it is not interchangeable with frame CPU. Diagnostic refresh after the measured frame is outside the CPU interval, as in v1.6.7. The production game has no opt-in diagnostic refresh.

## Subsystem CPU, ordinary matched replay

Exclusive accumulated milliseconds per rendered frame, run 1; run 2; run 3. Percentiles across stages are not additive. Per-tick distributions and worst/threshold counts for every subsystem/scenario are in the evidence bundle.

| Stage | Frozen baseline median/p95 | Retained median/p95 |
| --- | --- | --- |
| movement-state | 0.5/1.4; 0.5/1.2; 0.6/1.4 | 0.3/1.2; 0.3/0.9; 0.4/1.3 |
| body | 0.3/1.0; 0.3/1.4; 0.5/1.9 | 0.2/1.1; 0.3/1.2; 0.4/2.1 |
| index | 4.7/13.5; 5.6/15.0; 7.5/18.9 | 1.8/5.9; 2.0/6.1; 2.9/11.1 |
| collision | 0.2/0.9; 0.2/0.8; 0.2/1.0 | 0.2/0.8; 0.2/0.7; 0.2/1.0 |
| food | 0.2/0.8; 0.2/0.7; 0.2/0.8 | 0.2/0.8; 0.1/0.6; 0.2/0.9 |
| ai | 1.0/2.6; 1.2/3.0; 1.1/3.1 | 1.2/2.9; 1.1/2.7; 1.2/3.9 |
| abilities | 0.8/3.8; 1.0/4.0; 1.5/5.9 | 0.0/0.4; 0.0/0.2; 0.0/0.4 |
| respawn | 0.0/0.1; 0.0/0.1; 0.0/0.1 | 0.0/0.1; 0.0/0.1; 0.0/0.1 |
| events-compass | 0.1/0.2; 0.1/0.2; 0.1/0.2 | 0.0/0.2; 0.0/0.2; 0.0/0.2 |
| events-progression | 0.0/0.1; 0.0/0.2; 0.0/0.2 | 0.0/0.1; 0.0/0.2; 0.0/0.2 |
| events-unlocks | 0.0/0.1; 0.0/0.1; 0.0/0.1 | 0.0/0.1; 0.0/0.1; 0.0/0.1 |
| events-practice | 0.0/0.0; 0.0/0.0; 0.0/0.0 | 0.0/0.0; 0.0/0.0; 0.0/0.0 |
| events-effects | 0.0/0.1; 0.0/0.1; 0.0/0.1 | 0.0/0.1; 0.0/0.1; 0.0/0.1 |
| events-stamps | 0.0/0.1; 0.0/0.1; 0.0/0.1 | 0.0/0.1; 0.0/0.1; 0.0/0.1 |
| events-audio | 0.0/0.1; 0.0/0.1; 0.0/0.1 | 0.0/0.1; 0.0/0.1; 0.0/0.1 |

Attribution limits: food includes pickup and spawn; final filter/cap cleanup and cooldown/charge timer loops remain in movement-state residual. Elimination/respawn functions are nested exclusively under respawn, except outer ultimate bookkeeping in abilities. Events are measured independently in their existing order. JS timer quantization makes very short stages often read 0.0 ms; this does not establish zero cost.

| Whole-frame stage | Frozen baseline median/p95 | Retained median/p95 |
| --- | --- | --- |
| simulation | 8.3/25.0; 10.0/26.5; 12.8/34.1 | 4.6/12.9; 4.8/12.8; 6.1/21.6 |
| snakes | 1.1/2.7; 1.1/3.0; 1.2/3.3 | 1.1/2.6; 1.1/3.0; 1.3/3.2 |
| food | 0.3/0.9; 0.3/1.0; 0.3/0.9 | 0.3/1.0; 0.3/1.0; 0.3/1.0 |
| effects | 0.2/0.7; 0.2/0.6; 0.2/0.6 | 0.3/0.7; 0.2/0.6; 0.2/0.6 |
| environment | 0.6/1.6; 0.6/1.6; 0.6/1.7 | 0.6/1.6; 0.6/1.5; 0.6/1.6 |
| submit | 4.7/8.6; 4.2/8.0; 4.0/7.8 | 5.0/8.5; 4.6/8.1; 5.0/9.1 |
| dom | 1.0/3.1; 1.1/3.0; 0.8/2.7 | 1.0/3.4; 1.1/3.3; 1.0/3.0 |

## Catch-up and population conditions

The captured schedule deliberately includes zero, one and multiple ticks per rendered frame. Neither catch-up limits nor authoritative work are skipped. Identical replay distributions are verified against the original source.

| Ordinary run | Ticks/frame frequency (frozen = retained) | Backlog median/p95/max ms | Forced substeps/frame median/p95/max | Living snakes | Segments | Food |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0:2, 1:308, 2:638, 3:59, 4:10 | 7.7/15.9/16.5 | 2.0/6.0/12.0 | 12–21 | 533–930 | 850–1069 |
| 2 | 0:2, 1:288, 2:628, 3:74, 4:6, 5:2 | 8.2/16.2/16.6 | 2.0/6.0/15.0 | 16–21 | 685–1195 | 850–984 |
| 3 | 0:2, 1:253, 2:585, 3:99, 4:14, 5:5 | 7.6/15.5/15.9 | 2.0/9.0/15.0 | 16–21 | 927–1310 | 850–974 |

The maximum accumulator remainder is below one fixed step after each complete ordinary frame batch. Forced substeps are counted across all required ticks; they have not been reduced. Natural populations/food vary, but pairwise states and count trajectories match. No comparison attributes a wipe-induced population decline to an optimization.

## Separate combat/stress scenarios

| Scenario/source | Whole CPU median/p95 (three runs) | Worst CPU (three runs) |
| --- | --- | --- |
| projectiles / baseline | 20.9/40.9; 20.5/39.9; 23.6/46.3 | 68.6; 68.9; 76.2 |
| projectiles / final | 14.6/26.9; 16.4/27.7; 17.6/32.2 | 91.7; 86.3; 81.4 |
| respawns / baseline | 14.6/32.2; 21.8/53.2; 23.6/86.0 | 119.8; 147.0; 204.2 |
| respawns / final | 12.1/21.9; 14.8/31.5; 19.0/45.6 | 42.9; 80.6; 100.4 |
| cinematic / baseline | 15.1/33.9; 18.9/36.3; 19.5/37.1 | 147.6; 198.3; 84.0 |
| cinematic / final | 13.9/24.9; 16.5/27.3; 17.5/27.4 | 187.9; 205.2; 52.4 |
| stress / baseline | 25.0/50.9; 25.4/50.2; 27.8/60.4 | 145.7; 132.1; 103.5 |
| stress / final | 17.2/45.8; 18.2/38.2; 18.4/39.1 | 195.3; 96.6; 152.6 |

- Projectile scenario uses Kairo and frequent queued E inputs. Real cooldown rejection remains intact; every projectile uses the original swept tests and knockback substeps.
- Respawn waves bunch living bot heads at ticks 700/2500/4300 in the dev fixture, exercising actual simultaneous collision, drop, consumer and three-second respawn paths. The fixture changes test inputs/placement only, not shipped gameplay.
- Long-body scenario starts all 21 snakes at 360 body points (7,539 non-head segments). Deaths/respawns continue during warmup, so later samples are not steady 21×360 fixtures. Initial and checkpoint counts are recorded; this is advancing long-body stress, not the v1.6.7 rendering-only fixture.
- Cinematic cases contain charge and post-wipe recovery separately below. Counts are shown alongside each phase. Per-phase p95 is not compared to normal-play populations.

| Cinematic run / phase | Frozen CPU median/p95 | Retained CPU median/p95 | Population range |
| --- | --- | --- | --- |
| 1 / normal | 15.1/33.9 | 13.9/24.9 | snakes: 12–21, segments: 531–930, food: 850–1069 |
| 1 / charge | 0.0/0.0 | 0.0/0.0 | snakes: 0–0, segments: 0–0, food: 0–0 |
| 1 / recovery | 0.0/0.0 | 0.0/0.0 | snakes: 0–0, segments: 0–0, food: 0–0 |
| 2 / normal | 19.4/37.2 | 16.4/27.4 | snakes: 1–21, segments: 24–1084, food: 851–1343 |
| 2 / charge | 19.2/31.7 | 20.5/27.0 | snakes: 21–21, segments: 975–975, food: 851–851 |
| 2 / recovery | 8.2/12.4 | 7.5/11.6 | snakes: 1–1, segments: 25–25, food: 1342–1342 |
| 3 / normal | 21.0/38.5 | 17.5/28.2 | snakes: 1–21, segments: 24–1109, food: 935–1488 |
| 3 / charge | 17.3/25.2 | 21.0/25.1 | snakes: 21–21, segments: 1109–1109, food: 932–932 |
| 3 / recovery | 6.8/12.0 | 6.5/11.8 | snakes: 1–1, segments: 24–24, food: 1488–1488 |

All scenarios’ threshold counts, per-tick/per-frame costs, catch-up distributions, draw calls, triangles, GPU, uploads and resource snapshots are preserved in the evidence bundle. Rendering cost is not claimed improved by this simulation patch. For the unchanged rendering-only benchmark, see [v1.6.7](PERFORMANCE-1.6.7.md); those results are historical, not newly measured v1.6.8 simulation evidence.

## Allocations and GC (separate intrusive traces)

One matched ordinary 1,800-tick window, after warmup, sampled with CDP CPU profiler, 32 KiB heap sampling including collected objects, and V8 GC trace categories. These runs are excluded from timing tables. Sampling estimates are not exact total allocated bytes.

| Trace metric | Frozen | Retained |
| --- | ---: | ---: |
| Minor/Major GC events | 71.0 | 41.0 |
| Total GC duration ms | 1716.6 | 685.0 |
| Worst GC duration ms | 71.1 | 36.6 |
| Sampled reindex allocation estimate MB | 750.0 | 360.7 |
| Sampled stepProjectiles allocation estimate MB | 260.5 | outside reported top 25 |
| Sampled set allocation estimate MB | 117.1 | 30.9 |
| Sampled followBody allocation estimate MB | 51.4 | 49.3 |
| Sampled query allocation estimate MB | 21.4 | 20.2 |

The trace establishes that GC occurs and shows its recorded duration, rather than guessing GC from a spike. Reindex remains the largest sampled allocation stack. Eliminating repeated full target grids removes a large projectile allocation source. VFX/render allocations remain essentially outside this patch. Trace stacks and timing wrappers carry overhead, so these totals cannot be substituted for untraced worst frames or interpreted as exact GC reductions in ordinary uninstrumented play.

## Rejected experiments and remaining bottlenecks

- Pooled body records with a cached radius base were exact in the tested replay but did not consistently improve repeated median/p95; reverted.
- Numeric grid keys, pooled cells/rows and caller-owned query output were inconclusive/regressive at whole-frame p95; reverted. Public query allocation/order remains unchanged.
- Direct-field body record construction replacing object spread had mixed median/p95, including regressions; reverted.
- No AI approximation, delayed collision work, reduced bot/food count, skipped catch-up tick, simulation-rate change or global snake batching was attempted.

Remaining work is expensive dirty body-index rebuilding during forced substeps, sampled allocations/GC, AI perception queries, WebGL submission/GPU pacing and rare long stalls. Event consumers were not a sustained p95 hotspot in this capture. Further work should isolate allocation-safe indexing without altering snapshot semantics and benchmark again; the rejected pools are not a basis for claiming a shipped win.

## Validation and reproducibility

- **322 tests pass**: the original 293 regressions plus 29 performance/parity tests. Coverage includes all character/mode combinations, pause, deadlines, simultaneous collision, projectile tie ordering, knockback, boost, growth, respawns, explicit/index invalidation, query independence, profiler bounds/cleanup and identical zero/one/multi-tick schedules. The full 21-snake/850-food differential compares every tick through tick 6,002.
- Build, diff checks, preview/archive and browser lifecycle results are recorded in the release verification section after final checks. No Git publishing/deployment.
- Run the dev server on 4176, then scripts/simulation-benchmark.mjs LABEL 4176 OUTPUT ordinary (or stress/projectiles/respawns/cinematic). A label starting baseline selects the frozen fixture. Set PERF_REPLAY to the baseline JSON to replay its schedule; the script rejects mismatched final states automatically. PERF_DETAIL=0 disables detailed wrappers. PLAYWRIGHT_MODULE may identify a local Playwright runtime and PERF_BROWSER an owned Edge executable. These scripts control only their own headless browser.
- scripts/simulation-trace.mjs uses separate intrusive captures and must not run concurrently with timing samples. The benchmark is dev-only via ?perfDebug&simBench. Normal gameplay retains standard RNG and input handling.
- In-app browser automation was unavailable due to its Windows sandbox initialization error. Headless browser review does not verify physical touch, foreground vsync pacing, device audio latency or phone hardware.

## Browser lifecycle review

At both 1440×900 and 390×844 (owned hardware-accelerated headless Edge), four warm map switches were followed by 40 measured switches and 20 restarts. Warm/final geometries, textures and shader programs match for each map; repeated restart counts also match.

| Viewport / map | Warm = final geometries / textures / programs |
| --- | --- |
| Desktop Shibuya | 83 / 5 / 24 |
| Desktop Leaf | 86 / 9 / 27 |
| Desktop Tournament | 84 / 5 / 22 |
| Desktop Harbor | 98 / 8 / 29 |
| Phone-sized Shibuya | 79 / 5 / 24 |
| Phone-sized Leaf | 85 / 8 / 26 |
| Phone-sized Tournament | 81 / 5 / 22 |
| Phone-sized Harbor | 77 / 7 / 26 |

All four E skills and four ultimates were activated on each map at both widths. Each cinematic froze at identical elapsed time across a pause, resumed, and ended with no active cinematic or impact overlay. Page/shader error lists are empty. Light presentation and dark HUD screenshots are retained in the review directory; no visual design changes were made. Physical-phone touch/audio and foreground presentation remain unverified.

## Release verification

Final `npm test`: **322 passed, 0 failed**. `npm run build`: TypeScript and production build pass (66 modules). `git diff --check` passes. Vite retains the existing large Three.js chunk advisory; no new build errors. Production preview responds at http://127.0.0.1:4173/ with v1.6.8 title/menu/credits. The dev benchmark is absent in production even with `?simBench`; light menu, dark settings/gameplay, E input, pause/quit and menu restoration were checked at desktop and phone-sized widths with no page/shader errors. The source archive is refreshed alongside the repository; no Git publication or website deployment.
