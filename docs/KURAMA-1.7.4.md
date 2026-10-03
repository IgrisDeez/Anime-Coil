# Anime Coil 1.7.4 — approved Kurama and tailed beast bomb

Stage 1 was visually approved in chat and integrated into the default game. Kairo, Pomu and Shiro remain separate later review stages. Shibuya is the only selectable arena. Kitsu's approved head, latest eye-clearance fixes, transformed heads, character IDs, body cosmetics and authoritative gameplay are preserved.

## Visual and asset changes

The Blender MCP sculpture has a compact torso, moderately enlarged fox head, swept ears, angled eyes, an open jaw with readable fangs, broad clawed paws and coherent limb transitions. Dark cheek, shoulder, chest, abdominal and limb markings follow the gold/orange surfaces. Nine linked, individually arranged tapered tails form a varied fan. Toon shading avoids glossy plastic, reflection passes and extra glow passes.

The tailed beast bomb uses a purple-black core, subtle violet motion, narrow magenta-violet rim, converging pooled charge energy and a compact violet wake. Impact reuses the pressure shell, shockwaves, chakra fragments and fading smoke. Mouth-based origin, radius-dependent clearance, flight/ground clearance and the 0.9/2.5/3.4/4.3/5.6-second staging boundaries remain unchanged. Reduced-motion treatment and the existing reduced-flash presentation remain supported.

| Profile | Body triangles | Nine tails + contours | Model total | Model draws | Peak effect draws / budget |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | 8,519 | 9,000 | **17,519** | 6 | **15 / 24** |
| Mobile | 5,869 | 5,328 | **11,197** | 6 | **14 / 16** |

Model totals include all nine tails and contours, and are within 20,000/12,000. Bomb and pooled particles are included in the effect draw audit. Runtime GLBs are byte-identical to the visually approved exports.

Editable master and reference/studio views: `assets/kurama/candidates/chibi-review/`. Runtime exports: `public/assets/kurama/kurama-desktop.glb` and `kurama-mobile.glb`. Actual front, three-quarter, side and rear renders, reference comparison, original coil/roster scale study and initial before/after captures are in `docs/kurama-review/`. Integrated main-game captures are in `docs/kurama-1.7.4/`.

## Runtime ownership and compatibility

One selected-profile Kurama preload runs alongside the existing Kitsu preload before renderer initialization. Accessible status feedback covers loading and failure. Promise caches deduplicate subsequent profile requests, and the original procedural fox remains the fallback. Kitsu's cache and synchronous `createHead`/`createHeadOutline` contracts are unchanged. `createFoxSummon(profile)` synchronously selects registered cached assets or the original procedural factory.

The four articulated body batches and shared tail geometry retain the existing head/paw pivots, muzzle anchor and `FoxStaging`. Clones share immutable geometry while owning transforms and fade materials. Cache geometry is disposed once at application teardown, never during a snake removal or graphics-profile change. MSAA alpha coverage handles fading where supported; stable single-pass alpha hashing is the fallback.

Graphics changes rebuild the same arena's detail without clearing cinematic snapshots. Kurama swaps cached profile meshes while retaining cast time, captured origin, head/paw poses and fade state. Runtime frames use object/instance transforms and bounded existing effect buffers, with no mesh construction or retessellation.

## Verification and limitations

`npm test` passes all **321 tests**, including schema/finite geometry/outward winding/bounds, budgets, selected-profile load deduplication, fallback, resource ownership, independent transforms, mouth clearance, staging/camera fit, profile continuity and unchanged authoritative simulation outcomes. Existing Kitsu blinking and eye-clearance tests pass. `npm run build` succeeds; the existing large Three.js chunk advisory remains.

`scripts/kurama-integration-check.mjs` checks the actual application at 1440×900 and 390×844: selected-profile startup requests, main menu/portraits, all cinematic phases, repeated quality switching after moving the caster, completion/death/respawn normal-head restoration, actual restart/quit buttons and forced-load failure. No browser page errors. Preservation hashes confirm unchanged simulation, Kitsu source/GLBs, normal/transformed head models, cosmetics and Shibuya scene source. Checks and screenshots are in `docs/kurama-1.7.4/`.

Matched seed-812, 21-snake samples compare the frozen 1.7.3 procedural cinematic to the promoted implementation. CPU median/p95, whole-scene triangles/draws and geometry/texture/program counts are retained with raw samples; the initial review report remains in `docs/kurama-review/performance.md`. The final integrated measurements are in `docs/kurama-1.7.4/performance.md`. Charge/recovery confirmation pairs did not repeat >10% increases, but combined charge/recovery p95 remain +22.8%/+12.7% and is explicitly reported. Timing is desktop-browser render CPU on Intel Iris Xe, not physical-phone GPU/FPS or a complete live-match simulation benchmark. Model-bound camera differences can change culling despite identical fixture state.

Physical-phone input, thermals, GPU behavior and real-device readability remain untested. Non-MSAA alpha-hash fading may appear grainier than the inspected MSAA path. Rear/side anatomy is inferred from the two supplied references. Held rendering/lifecycle fixtures do not claim a full human play-through.

## Release

Package, visible brand, credits and HTML title are **1.7.4**. This stage is published to the existing Anime Coil GPT Site with its audience preserved, following successful validation. No new Site or GitHub publication. The refreshed source archive includes the editable master, optimized GLBs, renders, captures and validation evidence; Blender's task-owned MCP connection was stopped after authoring.
