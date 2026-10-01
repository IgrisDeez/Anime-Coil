# Anime Coil 1.6.9 — Corrected reference-sculpted Kitsu head

Kitsu's normal `ember` head now comes from a reference-specific Blender mesh in the menu, portraits and all player/bot instances. Its character ID, original coil attachment, equipped body cosmetics, size, breathing, boost pose, preview framing and effect anchors are preserved. The separate transformed head and fox summon remain unchanged. No simulation, audio, map, ability or cinematic-effect source was redesigned.

## Visual correction

The first delivery had eyes protruding from the curved face, low ears, oversized outline seams between overlapping hair pieces, and excessive overlap between the chin and coil. The correction conforms eyes and raised marks to the cheek surface, broadens the cheek/chin balance, raises and angles the recessed ears, reshapes the swept hair, restores layered nape coverage and connects the rear knot and ribbons without intersections.

`KitsuSculptMount_<profile>` lifts the sculpture by 0.12 while the exported head root and existing coil attachment remain at the original origin. The blink pivot remains independent at local Y=1.28 below that mount. Cached Lambert materials provide smoother shading with a restrained material color floor for dark maps; no glow, reflection or extra rendering pass is added. A narrow normal-offset outline excludes the forward hair layers so their overlaps do not become black seams.

The correction remains part of the requested 1.6.9 release. The before model and before image are retained locally. The supplied reference, four-view comparison and [correction sheet](../assets/kitsu/alignment-correction.png) make remaining visual differences reviewable.

## Model and exports

The saved [editable master](../assets/kitsu/kitsu-head-master.blend) contains individually editable face, ear bowls, oval eyes and highlights, swept hair sections, wrapped band, rounded plate, four rivets, diagonal emblem, rear knot and two fabric ribbons. A separate named studio scene/collection preserves the initial cube, camera and light in the original scene. Neutral four-angle master renders and optimized-profile inspections were produced and reviewed through Blender MCP. The setup-owned localhost connection was stopped afterward.

| Profile | GLB triangles | Retained coil | Total before outline | Draws before outline |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 5,341 | 352 | 5,693 | 11 |
| Mobile | 3,620 | 352 | 3,972 | 11 |

The outline is one existing-style back-face shell draw restricted to the crown and upper band. Exports contain ten material batches, finite position/normal buffers, identity mesh transforms and an internal 0.12 mount offset, no cameras/lights, textures, skeletons, animation clips or modifiers. They use Y up and +Z forward with the original attachment origin. `EyesPivot_<profile>` sits at local Y=1.28 beneath the mount and each cloned head owns its eye transforms. Hair uses deliberately shaped clumps rather than repeated cones. Uniform facial decimation was rejected because it damaged mobile eye and ear shapes; the final profiles regenerate controlled facial tessellation and reduce hair/cloth separately.

The [comparison sheet](../assets/kitsu/four-view-comparison.png) uses the supplied reference above the editable master at front, three-quarter, side and rear views. The reference is preserved with the assets. This is a stylized game interpretation: exact faceting, nape coverage and studio shading differ visibly from the reference, and mobile silhouette details are further simplified to meet the budget.

## Loading, switching and resource ownership

The selected graphics profile is preloaded before `GameRenderer` is constructed. An accessible polite status announces loading and fallback; the menu is inert while the initial asset loads. Only the selected profile downloads at startup. Each profile's promise and validated template are cached, including failures; later switching downloads the other profile at most once. HTTP/network/timeout or schema failure uses the original synchronous procedural head interface. Graphics switches refresh normal heads and portraits after preload while retaining transforms and visibility, including during a transformed cinematic.

Clones share immutable geometry and cached game-compatible Lambert materials. Blink transforms remain local to each head. Normal gameplay blinks have a per-snake phase and stop under reduced motion. Map switches, restart/death cleanup and individual clone removal detach heads without disposing asset resources. The cache owns and disposes each imported geometry/material once on module teardown or final page exit. There is no per-frame geometry construction or added glow/reflection/skeleton pass.

## Validation

- Asset tests cover both budgets, required roots/material batches, blink pivots, orientation/bounds, applied transforms, finite unit normals, promise deduplication, selected-profile caching, independent eye transforms, shared geometry/materials, one-time disposal, invalid schemas and network failure.
- The existing simulation regression suite is preserved. The recorded preexisting `simulation.ts` and `frame-profiler.ts` diffs compare byte-for-byte with the current diffs; `simulation-profiler.ts` was not edited. Rendering checks also compare serialized authoritative state before/after drawing.
- Hardware Edge integration review covered 1440×900 desktop and 390×844 phone widths, all four maps, light/dark menus, large 21-Kitsu crowds, reduced-motion rendering, Fox Rush and transformed-head recovery. Full ultimate stepping, death elimination and simulation respawn restore the imported normal head. Real UI play/quit controls and repeated renderer restarts were exercised.
- Per viewport: 12 graphics switches, 20 restarts and 20 map changes; both profile URLs downloaded exactly once, and no shared head resource disposal occurred. Warm geometry/program counts remained stable through the repeated restarts/maps. Scene texture totals vary normally by map.
- A forced network abort initializes menu/portraits and gameplay with the original procedural head. The final integration run reports no page errors.
- Final `npm test`, `npm run build` and `git diff --check` results are recorded below and in the release evidence. Build retains the existing Three.js chunk-size warning.

## Matched rendering measurement

The correction uses the same hardware Edge rendering fixture: Shibuya, 1440x900, DPR 1, seed 812, 21 present snakes, 987 segments and 850 food. The consecutive short comparison has 5 seconds warm-up and three 8-second windows per asset choice. Culling remains enabled. These are rendering samples, not an advancing match or physical-phone benchmark. Longer 10-second warm-up / three 30-second runs are also retained in the evidence; their CPU p95 varied from 5.7–7.4 ms for procedural heads to 11.9–14.9 ms for the corrected sculpt, while GPU p95 also rose. This large regression prompted the additional short comparison; it cannot be dismissed as a proven host-only effect.

| Metric | Original procedural head | Corrected sculpture |
| --- | ---: | ---: |
| Scene triangles | 64,672 | 65,920 |
| Scene draws | 68 | 63 |
| Geometries / textures / programs | 54 / 3 / 22 | 49 / 3 / 23 |
| CPU median / p95, window 1 | 6.80 / 15.00 ms | 6.70 / 15.90 ms |
| GPU median / p95, window 1 | 9.06 / 13.12 ms | 9.72 / 14.11 ms |
| CPU median / p95, window 2 | 6.40 / 10.90 ms | 6.40 / 12.10 ms |
| GPU median / p95, window 2 | 9.48 / 12.70 ms | 10.14 / 12.21 ms |
| CPU median / p95, window 3 | 6.30 / 11.70 ms | 6.40 / 10.30 ms |
| GPU median / p95, window 3 | 8.98 / 13.82 ms | 9.57 / 13.33 ms |

The table reports all windows, including regressions. Host scheduling and thermal state are not controlled; no sustained whole-game improvement is claimed. Existing simulation, upload cadence, culling, body cosmetics and cinematic effects remain unchanged.

**328 tests pass**; the final six asset checks also pass after export. The production build and diff checks pass. The existing Three.js chunk-size warning remains.

## Review limits

Phone review uses a desktop browser resized to 390×844, not a physical phone GPU or touch device. Automated rendering and lifecycle fixtures supplement foreground menu inspection; they do not certify sustained real-match feel, thermal behavior or physical touchscreen responsiveness. The performance sample is a rendering fixture with 21 present snakes, not a freely advancing whole-game CPU guarantee. The existing 1.6.8 whole-game performance limitation remains in force. No Git publishing or deployment was performed.
