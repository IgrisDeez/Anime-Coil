# Anime Coil v1.6.7 — Profiling-Driven Performance Pass
A solo browser arena built with TypeScript, Three.js, and Vite. Pick one of four original anime-inspired chibi serpents and compete with 20 bots in Endless, three-minute Sprint, or Bounty Hunt. Guided Practice is available from Help.

## v1.6.7 — Profiling-Driven Performance Pass

This local patch caches snake transforms and food colors, animates food/rain in shaders, restricts changed instance ranges, culls conservatively bounded offscreen meshes, throttles background actors, caps desktop DPR at 1.5 and avoids redundant HUD writes. Geometry, art direction, saved preferences and the fixed 60 Hz simulation are preserved. The distant-body 30 Hz trial was rejected because it separated heads from their coils.

The matched ordinary replay retains 21 snakes, 987 body segments and 850 food: conservative repeated baseline CPU median/p95 was 4.0–4.2/5.9–6.3 ms; final was 3.1–3.2/5.2–5.6 ms. Calls fell from 125 to 68 through culling, and a separately instrumented warm frame uploaded 21,696 bytes instead of 1,687,248. These are hardware-accelerated headless Edge/Intel Iris Xe rendering samples, not live-match or physical-phone guarantees. Final live-game 21-snake samples still exceed the whole-game CPU target; expensive simulation/event/catch-up frames remain.

**293 tests**, npm run build and diff checks pass. Final resource checks include 40 map switches and repeated ultimate cycles on desktop/phone-sized layouts. See [the full performance report](docs/PERFORMANCE-1.6.7.md) and its raw evidence for all isolated/cumulative stages, stress bodies, GPU/DPR results, live population ranges, rejected trials and review limits. Local preview: http://127.0.0.1:4173/. Package/visible versions and source archive are 1.6.7; no Git publishing or deployment.

## v1.6.6 — Shibuya After Hours

Shibuya now uses four packed street-aligned districts instead of twelve scattered storefronts. All profiles retain 32 detailed frontages; desktop adds 24 middle-distance blocks and 24 skyline masses, while mobile uses 16 of each. Commercial screen towers, glass buildings, stepped terraces and stacked shops have distinct silhouettes, finished sides, entrances, roof equipment and grounded foundations. Two station entrances occupy the intentional street opening. Raised architecture, street furniture, trees and background actors remain outside the existing collision clearance.

The circular arena rules are unchanged, but the visible ground is now a joined scramble intersection: broad crossings, diagonal pedestrian stripes, lane dividers, turn arrows, stop lines, hatched paint, drains/manhole graphics, road patches and pavement seams. These are flat cosmetic surfaces. Centre paint is subdued to retain contrast for frozen opponents, collectibles and player ownership marks. Perimeter traffic retains 12 cars/12 pedestrians on desktop and 4 cars/6 pedestrians on mobile, with added wheels and tail lights.

A camera-centred procedural night sky adds a navy/indigo gradient, slow layered storm clouds, sparse cloud-veiled stars, a softly obscured moon and restrained horizon glow. It uses one cached background draw, no texture downloads, post-processing, new lights or reflection pass. Fully downward views skip that draw when opaque ground covers the sky. Clouds use the existing presentation clock; pause/hidden tabs freeze them and reduced motion holds them static. Shibuya menu and postcard framing are adjusted; a sky horizon is naturally visible in lower-angle sightlines and cinematics rather than being forced into the top-down gameplay camera.

Billboards use twelve original locally generated poster designs in padded landscape, square and portrait atlas regions, merged into one shared draw per district. Small banners reuse existing sign-atlas entries without changing other maps' sign behaviour. Shop identities remain stable. Puddle reflections now take colours and positions from actual storefront anchors. Atlas creation has a readable base-colour fallback without browser canvas support, and all resources belong to the existing map disposer.

The dense-city review exposed a phone boundary cinematic camera inside a building. A Shibuya-only, temporary dithered camera-to-focus corridor now clears intervening raised scenery; ground, snakes, food and boundary cues remain untouched. It complements the existing fox summon volume and resets on completion, restart, quit and map change. Camera paths and ultimate mechanics are unchanged, and the corridor uses cached vectors/uniforms without another animation loop.

| Environment maximum | v1.6.5 desktop | v1.6.6 desktop | v1.6.5 mobile | v1.6.6 mobile |
| --- | ---: | ---: | ---: | ---: |
| Draw calls, including sky | 29 | 68 | 29 | 64 |
| Triangles | 36,676 | 87,174 | 28,132 | 46,434 |
| Materials | 18 | 22 | 18 | 22 |
| Textures | 4 | 5 | 4 | 5 |
| Moving actors | 24 | 24 | 10 | 10 |

Both profiles remain below 120/80 environment calls, 150,000/75,000 triangles and 32 materials, retaining the 24/10 moving-actor limits. Static district batches retain tight instance bounds, so offscreen architecture can be culled during normal play. The fully visible city uses more bounded draws than the prior global batch, but avoids submitting the entire skyline under a top-down gameplay camera. Normal rendering can also omit the sky call; environment maxima include it. Total scene counts include shared character/effect resources and are not the environment budget.

Validation: **277 tests pass**, preserving all 267 baseline tests and adding ten checks for frontage packing/profile populations, finite district instance bounds/camera culling, rotationally aligned road markings, padded reusable atlas panels, sky pause/reduced-motion behaviour, camera-relative sky positioning, top-down sky culling, profile/cleanup limits, and cinematic scenery restoration. Existing tests cover finite geometry/UVs, fallback textures, 40 constructions/disposals and gameplay regressions. Simulation, gameplay orchestration, models, audio, E effects and the four ultimate renderer files remain byte-for-byte identical to the saved v1.6.5 source archive; earlier local edits are retained.

Matched rendering samples compare the saved v1.6.5 source with v1.6.6 using seed 812, Shibuya, 21 living snakes, Auto quality, DPR 1, 30 warmup frames and 60 sampled frames. Simulation positions were held constant to isolate rendering cost from bot turnover. These are headless Edge/SwiftShader software-browser measurements, not hardware GPU timing, sustained live-match FPS or physical-phone performance.

| Viewport | RAF median/p95 before → after (ms) | CPU submission median/p95 before → after (ms) | Scene calls before → after | Scene triangles before → after |
| --- | --- | --- | ---: | ---: |
| 1440×900 | 158.0/172.8 → 175.3/183.7 | 4.8/9.3 → 6.0/8.5 | 159 → 160 | 227,792 → 209,096 |
| 390×844 | 90.2/96.1 → 89.6/93.7 | 4.0/7.6 → 4.2/7.7 | 128 → 129 | 206,800 → 193,840 |

The richer city increased desktop software frame time by about 11%; the phone-sized sample was comparable. District box culling reduced submitted normal-play triangles despite the larger authored environment. This is a visual-density tradeoff, not a claimed performance improvement. Final raw measurements are in `../v166-review/controlled-profile.json`.

Resource checks first observed one late geometry upload on Hidden Leaf at phone width. After settling the gameplay camera for 90 frames and priming three four-map cycles, two consecutive 40-switch cycles returned every map to identical geometry, texture and shader-program counts. Shibuya returned to 97/3/23 on desktop and 83/3/22 on phone (GPU-uploaded geometries/textures/programs, including cached renderer assets). These counts differ from fully visible authored environment totals because offscreen assets upload lazily. Settled per-map results are retained in `../v166-review/resources-settled-*.json`; no continuing growth was observed.

Live review covered production menu, gameplay and pause in both UI themes at 1440×900, 900×480 and 390×844, plus all four ultimate renderers at summon, charge, launch, impact and recovery, large-coil boundary casts, reduced-motion fox staging, the generated postcard and a low-angle night-sky view. Final browser checks reported no application or shader errors. The in-app browser connection was unavailable, so review used an isolated owned headless browser. Renderer fixtures omit the DOM impact artwork; the existing overlay regressions remain intact. Physical-phone touch, hardware GPU timing and prolonged real-device play remain unverified.

`npm test`, `npm run build` and `git diff --check` pass. The build retains the existing advisory about the shared Three.js chunk size. Package, page title, menu and credits show **1.6.6**. The source archive and production preview at **http://127.0.0.1:4173/** are refreshed. Temporary review fixtures are excluded from delivery. No Git publishing or website deployment was performed.

## v1.6.5 — Shibuya Neon Revival

Shibuya is rebuilt as a rainy blue-purple anime city. Four facade families now distinguish glass offices, narrow neon shops, terraced blocks and commercial towers, with a prominent COIL 109 shopping tower and two supported station entrances. Front and side windows have dark wells, raised frames and varied warm/cool panes; roofs gain parapets, setbacks and equipment, while shops gain lanterns, projecting glyph signs and grounded forecourts. The skyline surrounds the district at two depths rather than appearing only behind one row of buildings. Shibuya's menu postcard is rendered from the finished environment with a lower preview angle.

The source/capture audit confirmed repeated flat facades, largely blank side walls, disconnected perimeter street composition, generic circular pedestrian routes, and traffic streaks unrelated to those roads. These were replaced rather than labelled as missing-face bugs: no missing-face or shader failure was reproduced in the review. Shared typed street anchors connect closed chamfered roads, inner/outer sidewalks, station approaches and crossings. A confirmed closed-ribbon seam in the shared path helper is fixed by using the same endpoint cross-section. Interior crossing paint remains flat, subdued and cosmetic; all raised landmarks and background inhabitants remain outside the existing playable clearance zone.

Deterministic, repeating wet-asphalt and facade textures retain base-color fallback. Irregular, soft neon puddle graphics suggest cyan/pink reflections without reflective passes. Bounded rain, splash rings and distant mist replace the old uniformly pulsing ellipses. Neon sign artwork has padded atlas cells and stable shop identities; other maps retain their original plain sign artwork. Lighting emphasizes warm shop interiors against darker upper facades and layered haze, without adding lights, bloom, shadows or postprocessing. Pause/hidden tabs freeze the existing presentation clock; Reduced motion hides animated rain/splashes and holds traffic and pedestrians static while keeping wet streets and signage readable.

Shibuya owns 12 pedestrians plus 12 vehicles on desktop, and 6 plus 4 on mobile. Five shared instanced actor draws follow the actual sidewalk/road routes; weather uses reusable bounded buffers. New resources belong to the existing environment disposer. Summon-clearance shader composition and cartoon/ultimate environment reactions remain supported. Simulation, main gameplay orchestration, audio, E effects, all four ultimate renderers and the other three map builders are byte-for-byte unchanged from the v1.6.4 archive; existing earlier local changes are preserved.

| Environment-only budget | Before desktop | Finished desktop | Before mobile | Finished mobile |
| --- | ---: | ---: | ---: | ---: |
| Draw calls | 19 | 29 | 19 | 29 |
| Triangles | 16,288 | 36,676 | 13,986 | 28,132 |
| Materials | 15 | 18 | 15 | 18 |
| Textures | 4 | 4 | 4 | 4 |
| Background actors | 8 | 24 | 4 | 10 |

Both profiles remain under 120/80 calls, 150,000/75,000 environment triangles, 32 materials and 32/12 background actors. Total gameplay scene counts include character geometry and are separate from environment budgets: matched 21-snake captures changed from 150 calls / 206,972 triangles to 159 / 227,792 on desktop, and 119 / 192,462 to 128 / 206,800 at phone width.

Controlled browser samples used seed 812, Shibuya, 21 living snakes, Auto quality, 50 warmup frames and 100 sampled frames. Simulation positions were held constant to compare rendering rather than bot turnover. Headless Edge used SwiftShader software rendering, not hardware GPU timing. At 1440×900, before/after RAF median/p95 were 159.7/179.2 ms and 166.6/180.1 ms; CPU submission median/p95 were 4.8/9.5 ms and 5.9/16.6 ms. At 390×844, RAF median/p95 were 90.3/180.6 ms and 97.1/116.8 ms; CPU submission median/p95 were 7.9/127.9 ms and 6.8/19.1 ms. Software-browser scheduling/outliers make these unsuitable for claiming a hardware speed improvement or playable-device FPS. Actual-device GPU timing and sustained live-match timing remain review limits.

Forty map switches at desktop, short-window and phone sizes returned each map to identical warm/final geometry, texture and program counts. After cycling, Shibuya returned to 109 geometries / 4 textures / 23 programs; cached renderer resources are included. No shader or page errors were reported. Screenshot review covered menu, normal play and street views at 1440×900, 900×480 and 390×844; production light/dark menus, Play/Pause/Quit, all four ultimate charge/launch/recovery stages, a boundary fox cast and Reduced motion were checked at desktop/phone sizes. Physical-phone touch, GPU-specific performance and extended subjective rain/contrast tuning remain unverified. Raw measurements and representative screenshots are retained outside the source tree in `outputs/v165-review`.

Validation: **267 tests passed**, preserving the 260-test baseline and adding seven Shibuya tests for closed paths, facade families/foundations, deterministic actor routes, profile limits, pause, reduced-motion weather, texture/shader composition and stable sign setup. Existing tests cover budgets, finite UVs, deterministic construction, repeated disposal, scenery restoration and gameplay regressions. `npm test`, `npm run build` and `git diff --check` pass. Package, title, menu and credits show 1.6.5. The production preview is hosted locally at **http://127.0.0.1:4173/**; the source archive is refreshed. No Git publishing or website deployment was performed.

## v1.6.4 — Player-Anchored Summon & Cinematic Polish

Kitsu's fox now appears exactly 30 units behind the captured activation position and facing (50 with Reduced motion or Cinematic Camera Off). Neither the clamped impact point nor arena-center recentering controls summon placement. The existing posed muzzle still supplies bomb growth and jaw clearance. On boundary-clamped casts, an elevated lateral arc exits forward before curving into the unchanged impact point, with a derivative-aligned wake and the existing 0.28-unit ground clearance. The golden model, nine tails, maximum bomb radius, and attack mechanics remain unchanged.

A world-owned uniform set softly dithers raised scenery in the summon bounds, including instanced buildings. Ground-height fragments, collectibles, snakes, and arena boundary graphics remain visible. It uses the existing material shaders with no additional render passes or per-activation materials; activation/recovery fade the clearance and explicit cleanup restores scenery, including pause-safe restart. Pomu's cosmetic terrain ripples build during wind-up and transfer to the captured impact on rebound.

Skybreaker Slam retains Pomu's white-haired transformation and giant-fist size. A reusable curved arm buffer replaces the straight cylinder; the fist compresses, follows an overhead curved strike, and gains knuckle creases, tension strokes and a tighter shadow. Shoulder smoke curls, varied scalloped smoke, stars and an animated radial ink dent/rebound replace the uniform disk presentation. Spirit Bomb has softer seamless Cartesian turbulence, broader tapered gathering ribbons, displayed-head shoulder anchors, a trajectory-aligned descending wake, and shaded overlapping cloud lobes that open and dissolve at staggered times. Both attacks now fit projected bounds and blend eye and focus through charge, release and recovery; Spirit Bomb's charge-to-throw camera cut is removed. Cinematic Camera Off, Reduced motion and Reduced flashes retain their existing precedence.

All three effects have explicit idempotent cleanup, snapshot reset and resource disposal. No simulation, cooldown, elimination, respawn, E-skill, audio or HUD rules were changed in this patch; local v1.6.2/v1.6.3 work is retained. Detonation stays at 3.4 seconds and completion at 5.6 seconds. Existing impact artwork, monochrome aftermath, Japanese callouts and audio are preserved.

Validation: **260 tests passed**, preserving the 250-test baseline and adding ten staging/resource/lifecycle tests. Tests cover captured placement across headings and arena boundaries, curved launch clearance, instanced shader composition, scenery restoration during pause-safe restart, displayed anchors, camera continuity and recovery visibility, comfort settings, tangent-aligned wakes and repeated cleanup. `npm test`, `npm run build` and `git diff --check` pass. Package, title, menu and credits show 1.6.4; the production preview and source archive were refreshed. This release is local: no Git publishing or website deployment.

Visual review used isolated headless Edge with software ANGLE because the in-app browser connection was unavailable. All five stages of the three cinematics were captured on every map at 1440 × 900, 390 × 844 and 900 × 480, with additional large-coil edge casts, Camera Off, Reduced motion and paused launch samples. The review caught and fixed smoke/star visibility after cleanup. Final shader/console checks reported no errors. Separate production checks cover both UI themes, actual keyboard activation, impact overlays, pause/resume and recovery. Screenshots and raw measurements are retained beside the repository in `../v164-review/`.

Isolated ultimate draws (ordinary scene hidden) peaked at **Fox 15/14**, **Skybreaker 9/9**, and **Spirit 11/9** for desktop/mobile across summon, charge, launch, impact and recovery, below 24/16. Environment budgets are unchanged and continue to pass tests. Total scene counts below include snakes, collectibles and environments and are not the environment-only budget.

Controlled before/after samples use the archived v1.6.3 source, seed 812, Hidden Leaf, the same viewport/profile, gameplay camera (Camera Off), 20 warm frames and 60 measured submissions. Normal/charge have 21 living snakes; recovery has one after the wipe. Times are CPU durations around `GameRenderer.render`, not GPU timings, sustained FPS, or physical-phone measurements. Software rendering and scheduling produce noisy p95 values; these results do not establish a hardware performance improvement.

| Layout / attack / phase | Snakes | CPU p50/p95 before → after (ms) | Scene calls before → after | Triangles before → after |
|---|---:|---|---|---|
| desktop / fox / normal | 21 | 2.7/7.3 → 1.7/2.8 | 166 → 166 | 214,280 → 214,280 |
| desktop / fox / charge | 21 | 1.8/3.2 → 1.8/2.6 | 177 → 177 | 269,676 → 269,676 |
| desktop / fox / recovery | 1 | 0.7/1.4 → 0.7/0.9 | 74 → 74 | 100,332 → 100,332 |
| desktop / skybreaker / normal | 21 | 1.4/2.3 → 1.6/2.4 | 165 → 165 | 214,612 → 214,612 |
| desktop / skybreaker / charge | 21 | 1.5/2.5 → 1.6/2.3 | 179 → 179 | 240,760 → 242,904 |
| desktop / skybreaker / recovery | 1 | 1.5/5.8 → 0.7/0.9 | 76 → 71 | 63,624 → 63,808 |
| desktop / spirit / normal | 21 | 1.4/2.2 → 1.5/8.7 | 161 → 161 | 214,540 → 214,540 |
| desktop / spirit / charge | 21 | 1.5/2.6 → 1.8/2.5 | 174 → 172 | 369,300 → 368,680 |
| desktop / spirit / recovery | 1 | 1.2/5.0 → 0.6/1.0 | 61 → 61 | 267,364 → 279,028 |
| phone / fox / normal | 21 | 1.8/3.6 → 2.2/7.3 | 134 → 134 | 193,944 → 193,944 |
| phone / fox / charge | 21 | 1.3/1.8 → 1.5/2.6 | 142 → 142 | 245,676 → 245,676 |
| phone / fox / recovery | 1 | 1.1/2.7 → 0.7/5.2 | 72 → 72 | 90,060 → 90,060 |
| phone / skybreaker / normal | 21 | 2.4/5.4 → 1.3/1.9 | 133 → 133 | 194,276 → 194,276 |
| phone / skybreaker / charge | 21 | 2.6/8.1 → 1.3/2.5 | 147 → 147 | 220,424 → 221,128 |
| phone / skybreaker / recovery | 1 | 0.6/1.8 → 0.9/2.4 | 71 → 68 | 52,936 → 52,960 |
| phone / spirit / normal | 21 | 2.2/7.1 → 1.3/2.5 | 129 → 129 | 194,204 → 194,204 |
| phone / spirit / charge | 21 | 1.3/2.0 → 2.8/10.2 | 138 → 137 | 287,648 → 287,462 |
| phone / spirit / recovery | 1 | 0.8/6.3 → 0.9/5.3 | 58 → 58 | 162,724 → 170,500 |

The 40-map-switch check returned to Harbor ten times with identical **189 geometries / 7 textures / 39 programs**. Twelve fresh activations per attack also stabilized: Fox **177/9/42**, Skybreaker **175/9/42**, Spirit **176/9/42** (geometries/textures/programs); different scene states account for the different totals. Physical-device GPU/thermal performance, real phone touch interaction, and subjective full-speed cinematic feel still require device review.

## v1.6.3 — Golden Fox Summon Redesign

Fox Spirit Bomb now summons a crouched, upright golden fox with broad shoulders, a narrower waist, bent hind legs, spread forearms and clawed feet. The longer angular muzzle has separate open jaws, fangs, narrow eyes, swept ears and pointed cheek tufts. Shoulder circles, chest and waist emblems, cheek stripes and wrist bands follow the supplied reference's visual language. Four cached vertex-color meshes provide the torso/legs, head and articulated arms; normal Kitsu character assets remain separate. Nine closed, curved flame-tail instances have rounded roots, hooked tips, dark inner stripes and distinct layered placements. Charge adds subtle staggered flex and claw tension; reduced motion holds the detailed fan and pose static.

A named anchor inside the posed head supplies the muzzle position and facing. A reusable readonly staging view supplies those coordinates, the bomb center, summon bounds and camera focus. The unchanged maximum 11.48-unit bomb radius has radius-based jaw clearance; its wake follows the actual launch trajectory, and its lower surface stays at least 0.28 units above ground. The summon stages inward near arena edges while the authoritative impact point stays unchanged. Low front three-quarter summon framing blends into side charge and oblique launch framing, then blends both camera position and focus back toward gameplay. Projected bounds guide desktop, short-window and portrait framing. Camera Off and reduced motion retain gameplay framing and move the visual summon farther back so the charged orb clears the player; the complete giant summon may extend beyond that unchanged gameplay view.

The existing 3.4-second detonation, 5.6-second duration, dark chakra shader, impact keyframes, monochrome aftermath, sound effects, Japanese callouts and combat rules remain intact. Cleanup resets poses, anchors, shaders and every transient layer on exit, death, match end and map change. Cached vectors, shared tail geometry and pooled effects avoid runtime geometry construction. Transparent graphic layers use a single render pass; mobile omits one secondary aftermath ring. The complete visible effect remains within 24 desktop / 16 mobile draws.

Validation: **250 tests passed** (the 246-test baseline plus four targeted tests), including finite geometry/normals, material isolation, tail placements, posed muzzle separation, wake direction, ground clearance, camera continuity and player visibility during recovery, comfort settings, frozen poses, repeated cleanup and idempotent disposal. `npm run build` and `git diff --check` passed. The production preview serves v1.6.3 with HTTP 200; a separate production-browser menu, activation and pause/resume smoke check reported no console errors. The source archive was refreshed with 92 entries, including `src/fox-model.ts`; this release remains local.

Isolated headless Edge with software ANGLE successfully captured front/three-quarter model views and all five cinematic stages on all four maps at 1440 × 900 and 390 × 844, plus arena-edge launch, 900 × 480, reduced-motion and Camera Off samples. These controlled renderer fixtures omit the HUD and CSS impact artwork; they are not physical-phone or full live-match review. No shader errors were reported. A 40-map-switch cycle returned Harbor to **166 geometries / 8 textures / 32 programs** at every four-map checkpoint. At 3.65 seconds after the wipe, with one snake, the measured effect used **15 desktop / 14 mobile draws**, separately from the ordinary scene.

For a matching seeded Hidden Leaf charge sample at 1.9 seconds with 21 snakes, the earlier and redesigned renderers were compared using retained gameplay framing, 40 warmup frames and 120 samples. Desktop CPU submission median/p95 was **3.6/6.2 ms before, 3.6/5.1 ms after**; phone-size Low was **2.9/4.8 ms before, 2.9/4.9 ms after**. Effect draws were **13 before / 11 after** in both profiles. Total triangles rose from **234,384 to 270,252 desktop** and **213,664 to 249,532 Low** for the more detailed sculpture. These software-browser CPU samples are illustrative, not GPU frame-time or performance-improvement claims; scenery visibility can change with staging. Physical-device speed, live camera motion, audio listening and the unchanged CSS keyframes remain manual review items. Screenshots and raw measurements are retained outside the source archive in `outputs/fox-review`.

## v1.6.2 — Menu Clarity and Safer Spawns

Changed the character-selection heading and its accessible group name to **Choose your character**. The redundant description beneath the match-mode buttons is gone; mode rules remain in Help.

Spawn placement now checks the entire starting coil, its forward corridor, the arena edge, and nearby living snakes with extra room for the first movement tick. Bot checks use the bot's actual starting mass. If a crowded arena has no safe candidate, that snake waits and retries after its three-second respawn countdown instead of spawning into an immediate collision. The pending bot slot remains queued until placement succeeds. Movement, collision rules, and spawn timers are unchanged.

Validation: **246 tests passed**, including safe initial placement and a forced no-space respawn for both player and bot; `npm run build` and `git diff --check` passed. The local production preview serves HTTP 200. Live desktop and physical-phone visual review remains open.

## v1.6.1 — UI Alignment and Clarity

Settings now opens on Controls in an accessible four-tab layout. The title, close control, and tab list stay visible while only the selected panel scrolls. Arrow, Home, and End keys move between tabs; closing restores focus to the opener. All saved setting keys, immediate updates, and section reset actions remain available.

Pause centers its tool buttons and places the two exit actions on separate rows below the primary resume action. Help leads with a compact control guide and Guided Practice, then keeps the full mode and character descriptions in expandable sections. The menu aligns its map cards and controls and gives mode descriptions a readable size. Results and Challenges share the new dialog header, width, spacing, and inner scrolling behavior. Phone and short-window layouts keep controls reachable without clipping.

This is a presentation-only patch. Match rules, saved preferences, maps, and audio content are unchanged. Validation: **245 tests passed**, `npm run build` passed, `git diff --check` found no whitespace errors, and the production preview serves HTTP 200 on port 4173. The added tests cover tab navigation, hidden-panel state, and returning focus to the opener. Live screenshots and manual desktop/phone layout tuning remain open: the in-app browser connection was unavailable, and isolated headless Edge could not initialize WebGL. No visual or performance measurement is claimed from that attempt. The v1.6.1 changes were later pushed to `origin/worlds-reborn` in commit `2fc6c812`; website deployment was not included.

## v1.6.0 — Everyday Polish

Settings now groups Controls, Appearance, Audio, and Accessibility. Touch players can choose left- or right-handed controls and standard or large buttons; the preview, joystick, abilities, and compass update immediately. Keyboard rebinding and existing audio and graphics settings remain available. Reduced flashes softens anime impact frames independently of camera motion; Cinematic camera Off keeps the normal gameplay framing while the attack continues. System or user reduced motion still applies the safest visual treatment. Older saved settings receive defaults for the new choices.

Guided Practice now counts pickups, boost time, and E activation only during their respective steps. Its E prompt names the selected character's skill and shows the rebound key or touch instruction. Menu mode descriptions explain the objective and ultimate availability. Session results include challenge gains and newly unlocked cosmetics, with a Challenges shortcut. Endless players can select **End run & recap** from Pause or return directly to the garden. Unlock notices use a bounded queue and pause-aware presentation time; results never auto-equip rewards.

The new session-summary helper compares immutable progress snapshots, while simulation remains authoritative for match statistics and challenge events. Input is cleared when changing touch layouts, rebinding, or opening/closing dialogs. The cinematic camera choice restores the gameplay camera after effect updates, keeping impact art projected through the final rendered camera. This local release does not publish to Git or deploy the website.

Validation: **241 tests passed**, `npm run build` passed, and `git diff --check` found no whitespace errors. The local production preview serves HTTP 200 with the 1.6.0 title, and the refreshed source archive contains the new session-summary module. Environment tests cover bounded resources and idempotent disposal on both quality profiles, including 40 consecutive map constructions. A controlled 21-snake browser frame comparison, live map-switch GPU counts, representative screenshots, and physical-phone touch review remain open because the in-app browser control connection was unavailable; no performance improvement is claimed for this patch.

## v1.5.7 — Impact Frame Alignment

Impact artwork now follows the actual center of each 3D effect. Hollow Purple's rupture is centered on Shiro at the core's height, rather than on the separate damage-coverage point. Skybreaker's ink dent is aligned at its drawn contact point instead of the center of its square artwork. Spirit and Fox keep their established blast anchors. The shared projection accepts a chosen world height and can place cinematic artwork beyond the viewport edge instead of reusing a stale on-screen coordinate. Gameplay, cinematic timing, and impact art are unchanged. The 235-test suite, production build, and diff check pass. This patch remains local; desktop and phone visual verification awaits a working in-app browser connection.

## v1.5.6 — Ultimate Impact Frames

Hollow Purple and Skybreaker Slam now have their own brief black-and-white manga keyframes at the existing 3.4-second detonation. Purple converges into a torn rupture and dark energy cavity; Skybreaker shows an overhead fist striking a flattened ground dent. Both graphics are anchored to the captured impact point, last one or two rendered frames through the existing low-FPS latch, and lead into short near-monochrome aftermath and smooth color restoration while their original world-space effects continue. Spirit Bomb and Fox Spirit Bomb retain their established impact artwork.

The new artwork is CSS geometry in the existing cinematic overlay, with no new WebGL draws, textures, audio, or gameplay changes. Reduced motion omits the graphic keyframe and uses a restrained contrast cue. The overlays and color filter reset on completion, restart, quit, and map changes. The 234-test suite, production build, and diff check pass. This is a local patch with no Git publishing or website deployment. Live desktop/phone visual tuning and frame-time comparison remain necessary where the in-app browser connection is unavailable.

## v1.5.5 — Fox Summon Visual Redesign

Kitsu's Fox Spirit Bomb now summons a more deliberate fox silhouette. A sculpted tapered muzzle, narrow eyes, stronger brow and cheek tufts, broad chest, and clawed forepaws replace the static rounded face and tube-like limbs. The head and paws have small charge-driven poses. Nine rounded, curved chakra tails use one instanced geometry with separate root positions, angles, and lengths; reduced motion holds their fan still.

The bomb is a dark maroon chakra core with seamless 3D turbulence, irregular orange-red channels, a thin broken shell, and pressure-fed charge ribbons. Its charge anchor sits forward and to one side of the muzzle so the face remains visible; a revised three-quarter camera composition frames the fox and orb together on desktop and portrait screens. The existing launch clearance, 3.4-second detonation, black-and-white impact frame, aftermath, 5.6-second recovery, and all gameplay rules remain unchanged. Summon and gathering cues add two quiet synthesized pressure layers through Effects, with no loop or new voice asset.

The sculpture, orb, and tail geometry are cached for the cinematic; the nine tails remain two instanced draws, and all owned resources use the existing idempotent disposal path. Mobile keeps the primary silhouette while trimming existing secondary effects. The 232-test suite, production build, and diff check pass. Live WebGL visual tuning, equal-population frame comparison, and physical-phone timing still require review when the browser connection is available. This local patch is not pushed to Git or deployed.

## v1.5.4 — Fox Spirit Bomb Impact Polish

Kitsu's Fox Spirit Bomb now has its own manga impact artwork: a white-hot core, dark fox-head silhouette, nine ink-tail shapes, and radial blast lines. A shared render-frame latch gives this attack one or two deliberate black-and-white keyframes without changing Spirit Bomb's sequence. Kitsu's aftermath stays near-monochrome for about 0.25 seconds, then regains color over 0.35 seconds as the blast continues moving. The launch orb stays above the ground until impact; a restrained camera punch lasts less than 0.12 seconds. Reduced motion removes the keyframe and punch while retaining a short high-contrast cue.

The world-space explosion gains staggered dark smoke, multicolor chakra fronts, orange-gold fragments, nine fading tail-like streaks, layered pressure rings, and a longer ember tail. Fox impact audio adds a quiet low rumble and two short crackles through the existing Effects channel, with no new clip or loop. Mobile trims secondary instances, all new pools are bounded and disposed with the cinematic, and map lighting returns to its base state at recovery. Simulation timing, damage, cooldown, eliminations, scoring, and other characters are unchanged. The 231-test suite, production build, and diff check pass. This is a local patch; Git publishing and deployment are excluded. Live WebGL visual tuning and physical-phone timing remain manual checks when the in-app browser connection is unavailable.

## v1.5.3 — Spirit Bomb Impact and Aftermath

Kairo's Spirit Bomb has a seam-free Cartesian energy shader, a tighter luminous rim, two batched tapered gathering-ribbon meshes, and a throw trajectory that keeps the orb above the ground until the captured impact point. The detonation at the unchanged 3.4-second mark adds a dedicated black-and-white manga keyframe with a white core, dark blast contour, and radial ink lines. A presentation latch guarantees at least one rendered keyframe after a slow frame, with at most two under ordinary rendering. The following 0.25-second near-monochrome aftermath gradually regains color over 0.35 seconds, while staggered cloud layers, arena pressure rings, smoke, and energy fragments dissolve through the existing 5.6-second recovery. A small camera punch is limited to the opening impact; reduced motion uses static framing and a restrained contrast cue.

The sequence uses the existing cinematic clock and reusable overlay/geometry, with no post-processing pass or new audio. Simulation, enemy positions, damage, scoring, cooldown, respawns, and the other ultimates are unchanged. Impact presentation resets on pause-safe completion, restart, quit, death, and map change. Targeted tests cover keyframe latching, low-FPS transitions, pause, reduced motion, orb clearance, alignment, draw budgets, and disposal. Live browser visual review remains necessary where the in-app browser connection is unavailable; this local patch is not published to Git or deployed.

## v1.5.2 — Signature E-Skill VFX

Every normal skill has a stronger character-specific visual identity. Fox Rush gives Kitsu a pointed fox flare and paired cream-and-orange flame ribbons along the actual coil path. Ki Cannon draws a narrow locked aim line, compressing muzzle rings, a pointed bolt around the unchanged collision core, and a directional impact burst. Elastic Twist adds a spring snap and head-clear side curls while keeping horizontal body positions fixed. Infinity Veil retains a complete, visible 12-unit ground boundary with restrained inner ripples and edge accents; it remains a slow field, not protection from collisions.

Player and AI use the same effects for skills AI can activate. Mobile keeps every essential cue with fewer secondary instances, while reduced motion removes fast trails and orbiting strokes but retains the Ki core/aim and Veil boundary. Six shared instanced meshes remain the complete E-effect renderer; profile switching changes only detail. Confirmed simulation events start activation, launch, and impact effects. Skill timing, damage, hitboxes, cooldowns, Japanese callouts, SFX, and UI layout are unchanged. The **224-test** suite and production build pass. Added tests cover signatures, anchor/direction alignment, projectile and field dimensions, player/bot parity, bounded crowded effects, profile detail, rejected activations, reduced motion, and cleanup.

The production preview and source archive are rebuilt locally. Live browser visual and frame-time review could not be completed because the in-app browser connection was unavailable; all-map contrast, physical-phone appearance, and GPU-specific performance remain manual checks. Git publishing and deployment are outside this patch.

## v1.5.1 — Hollow Purple Rupture

Shiro's Hollow Purple now detonates with a larger, layered violet rupture: a luminous irregular corona, a brief dark cavity, jagged rising energy sheets, branching lightning, ground fractures, fragments, and staggered shock rings that reach across the arena. The impact clears during recovery rather than leaving full-size transparent meshes on screen. Mobile uses fewer pooled instances; reduced motion keeps a restrained static rupture and ground warning without rapid fragments or lightning. The authoritative 3.4-second elimination, 5.6-second cinematic, cooldown, pull, scoring, and respawns are unchanged.

The effect uses cached geometry, one shader shell, and instanced ground scars, with no per-frame mesh creation. Renderer tests cover arena-scale growth, mobile bounds, reduced motion, cleanup, and the existing 24/16 draw-object limits. Browser visual review could not be completed in this workspace; contrast on each map and physical-phone performance still need manual inspection. This patch is local and is not published to Git or deployed.

## v1.5.0 — Bounty Hunt & Everyday Polish

Bounty Hunt is a three-minute match with one marked living rival at a time. The match card, compass, and small world marker identify the target. Naturally spawned orbs award one point and one ultimate charge; a credited collision elimination awards 100 points and 20 charge, plus 200 points and 15 charge when it defeats the target. Ultimate eliminations still count as kills and drop energy, but give no Bounty points or charge. The V cinematic requires 100 charge as well as its usual 30-second cooldown. Death retains points, halves unspent charge, and keeps the existing three-second respawn. Bounty records use a separate local key and compare points, bounties, then direct eliminations. Endless and Sprint retain their existing score and ultimate rules.

Settings now includes saved Boost, E-skill, and ultimate key bindings, Auto/Low/High graphics detail, and System/Reduced motion alongside sound and theme. Escape remains Pause. The death card names the rival when the collision identifies one. Starting coils and their forward paths are checked for safer spawn placement. Bounty bots use food-seeking, interception, and evasion styles with unchanged base movement stats; the existing modes retain their bot behavior. Practice remains excluded from challenges, and only Sprint advances the four-map Sprint challenge. All settings and the Bounty record tolerate unavailable browser storage.

Validation: **216 tests passed**, `npm run build` passed, and `git diff --check` found no whitespace errors. Targeted checks cover Bounty credit and exclusions, charge/cooldowns, timeout during an ultimate, death/respawn, record ties, settings fallback, and initial coil clearance. In the local in-app browser, the Bounty mode picker, match HUD, settings, rebinding, quality switching, and timed results were reviewed. A warm Tournament Bounty sample with a 21-snake starting population and at least 20 living snakes over 300 frames measured **11.5 ms median / 23.4 ms p95**, **103 median draw calls**, and **333,560 median triangles**. This is a browser measurement, not a controlled before/after GPU comparison. A 40-map-switch cycle returned geometry, texture, and program counts to identical per-map warm values. A physical phone, touch steering, and cross-browser hardware still need direct review.


## Run locally

Requires Node.js 22.12+ (or Node 24) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://127.0.0.1:5173. Keep the terminal running while you play. Do not open `index.html` directly as a local file.

```sh
npm test         # gameplay, maps, audio lifecycle and asset tests
npm run build   # TypeScript checking and production build
npm run preview # serve the production build locally
```

The npm scripts use Vite's runner config loader so they also work in the restricted Windows workspace used for this release.

## Controls

| Action | Desktop                         | Touch              |
| ------ | ------------------------------- | ------------------ |
| Steer  | Move mouse                      | Drag left joystick |
| Boost  | Hold Space or left mouse button (key can be changed in Settings) | Hold BOOST         |
| Power  | E or right mouse button (key can be changed) | Tap ability button |
| Cinematic ultimate | V (key can be changed) | Tap the V button |
| Pause  | Escape or pause button          | Pause button       |

Collect energy to grow. Boost spends mass and sheds energy behind you, unless Fox Rush is active. Boost becomes unavailable at the minimum length. Your head touching a rival's body or the arena edge ends your current life; your own coil is safe. A head-on collision eliminates both spirits. Defeated bots drop energy, then return after a three-second wait. The player also returns after three seconds, keeping the match, peak score, and eliminations; a returned coil starts at minimum size. Pause freezes all simulation; hiding the tab pauses automatically. Sprint runs to its three-minute active-match deadline, including through player respawns; an ultimate in progress finishes before the timer ends the run.

## Spirits

| Original character | Visual inspiration | Power                                                                                     |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------- |
| Kitsu          | Naruto             | Fox Rush: free boost for 3 seconds; 12-second cooldown                                    |
| Kairo          | Goku               | Ki Cannon: 0.3s charge, forward knockback shot; 10-second cooldown |
| Pomu      | Luffy              | Elastic Twist: 2× turning speed for 3 seconds; 10-second cooldown                          |
| Shiro       | Gojo               | Infinity Veil: 40% slow within 12 units for 3 seconds; 12-second cooldown; player only |

Infinity Veil follows Shiro and slows rivals whose heads are within 12 units; touching the ring with a tail does not slow a distant head. Movement, including boost, is reduced by 40%, but steering, ability timers, AI and knockback continue. The field does not grant immunity, erase rivals, or protect against the boundary. Bots cannot use Infinity Veil. All characters have equal base movement stats; bots use the other three E abilities. Ultimates remain player-only. Internal character IDs and storage keys are unchanged.

Ki Cannon locks direction when E is accepted and charges for 0.3 seconds while Kairo can steer normally. A 0.65-radius projectile travels 24 units from the muzzle at 40 units/second and stops at its first rival or the boundary. Hits apply a 20-unit/second impulse that decays over 0.4 seconds (about four units); hits replace existing impulses instead of stacking. Forced movement uses synchronized substeps no longer than 0.2 units. The shot causes no direct death, mass loss, or bonus kill credit: normal collisions and boundary rules still decide the outcome. Charges cancel on caster death, launched shots can outlive a bot caster, and entering a cinematic clears shots and impulses.

Models, outfits, geometry, and names are original. Speech is bundled; no online voice service is required. The game remains SFX-only.

## Architecture

- `src/simulation.ts`: renderer-independent 60 Hz simulation, typed match modes and authoritative timed deadlines, Bounty scoring and targets, spatial grids, bots, collision resolution, and abilities.
- `src/bounty-record.ts` and `src/game-settings.ts`: separately validated local Bounty records and user preferences.
- `src/models.ts`: original chibi mesh construction with shared geometry/materials.
- `src/renderer.ts`: Three.js scene, smooth camera motion, instanced bodies and energy, cached black coil and chibi-head silhouettes, character portraits and preview. Heads and bodies render the same simulation frame to avoid early-looking hits.
- `src/skill-effects.ts`: six bounded instanced pools for character-specific E cues, attack cores, tapered strokes, impacts, trails and field accents; renderer-only, pause-aware and reduced-motion aware.
- `src/vfx-anchors.ts` and `src/vfx-geometry.ts`: displayed-head anchors and cached tapered tail, sculpted fist, slash, star and rupture-sheet geometry.
- `src/fox.ts`, `src/skybreaker.ts`, `src/spirit.ts`, and `src/purple.ts`: separate cached cinematic renderers for all four V attacks; gameplay hitboxes remain in the simulation.
- `src/models.ts`: normal and transformed chibi head templates with separately cached silhouette outlines. Form heads never mutate normal shared materials.
- `src/worlds/surfaces.ts`: map-owned, world-scale procedural surface textures and a 24-unit cosmetic rubber distortion driven by a readonly presentation frame.
- `src/ability-feedback.ts`: ready, charging, active-duration, cooldown and unavailable HUD states.
- `src/main.ts`: menus, HUD, input, minimap, pause/restart, local best score and audio integration.
- `src/practice.ts`: presentation-only guidance for turning, pickups, boost and E; the practice arena runs without bots.
- `src/progression.ts`: versioned offline challenge progress, unlocks, cosmetic selection and defensive storage handling.
- `src/ui.ts` and `src/style.css`: cozy menus, accessible dialogs, compact HUD and responsive touch layout.
- `src/audio.ts` and `src/audio-settings.ts`: character-aware skill audio and saved effects/voice settings.
- `public/audio/`: seven bundled Japanese callouts and voice attribution.
- `scripts/build_audio.py`: regenerate speech callouts; requires a local VOICEVOX Nemo engine.
- `tests/simulation.test.ts`: gameplay regression tests.

Energy score is ten times mass. Best score uses peak mass, so boosting does not erase an earned record. Physical length is capped at 360 segments per serpent and energy at 1,600 pickups to bound resource usage; score can keep growing. The screen pixel ratio is capped for performance. This is local solo play, with no accounts, server, telemetry, or online multiplayer.

Endless personal best retains its original localStorage key and behavior. Sprint has a separate best record shared across maps; equal peak-energy scores compare eliminations, then survival time. Bounty Hunt has its own record and stores points, bounty claims, and direct eliminations separately. Challenges and equipped cosmetics use a separate versioned key. Map selection, sound, and game settings are saved when storage is available; play continues if it is disabled. Practice updates none of these records or challenges. Audio is optional. WebGL initialization/context loss shows recovery instructions. Fonts use Google Fonts with local fallbacks; gameplay and models do not depend on that network request.

## Validation

Run `npm test` and `npm run build`. Browser checks cover character selection, each power, menu/arena rendering, pause/resume, results/restart and a phone-sized viewport. Actual frame rate depends on GPU, browser and device; 60 FPS is a design target, not a guarantee. A physical touch-device and cross-browser hardware performance pass are recommended before public release.

Snake heads and bodies now grow wider with current energy score, using (score / 180)^0.35 and capping at 2.5 times the starting size. Segment spacing, pickup reach, and collision sizes grow with the model. Tail taper and forgiving collision insets remain in place. Boosting spends score, so size also decreases gradually when boosting.

## Anime-inspired worlds

Choose any map with any character using the four preview cards. Selection updates the miniature scene immediately and is saved when browser storage is available. New players start in **Shibuya After Dark**; restarting a match retains the selected map. Your personal best is shared across maps.

- **Shibuya After Dark**: scramble crossings, neon signs, station entrances and city towers.
- **Hidden Leaf Village**: tiled village paths, timber shops, lanterns and a carved guardian mountain.
- **World Tournament**: tournament tiles, colorful gates, spectator stands and palms.
- **Grand Line Harbor**: sandy plaza, compass rose, dock inlays, turquoise water, ships and coastal buildings.

All scenery is original procedural Three.js geometry. Sign textures and preview thumbnails are generated locally, with no downloaded map assets. Tall landmarks sit outside the unchanged arena boundary; ground markings are decorative and safe to cross. Maps do not change movement, growth, bots or powers. `src/maps.ts` owns typed map definitions and preference handling; `src/environments.ts` builds and disposes map geometry, materials, instances and sign textures. Environment tests check landmark clearance, storage fallback and resource disposal.

### Hollow Purple — Shiro / Gojo

Press **V** (or tap **Hollow Purple** on the HUD) for a second, player-only power, independent of Infinity Veil on E. Red and blue energy merge during a 5.6-second cinematic; every rival across the arena is pulled to you. At 3.4 seconds, a huge purple blast eliminates all rivals, awards each kill once, and drops their energy. You stay invincible and stationary throughout. Twenty new bots appear after the cinematic ends. Cooldown: 30 seconds from activation; ready immediately in a new match.

Escape and tab visibility pause the cinematic and cooldown. Infinity Veil is preserved during the cutscene, and bots cannot use either Gojo power. Reduced-motion preferences disable camera movement and tone down the screen flare. Effects use reusable procedural geometry and synthesized sounds.

`npm test` includes global pull, player-only access, immunity, kill/drop accounting, delayed respawns, cooldown, pause, and restart coverage.

## v1.1 — Cozy UI & Chibi Audio

The cream-and-mint interface keeps the 3D spirit preview visible, with portrait buttons, map postcards, skill badges and a single Play button. Help contains controls and complete skill descriptions. Audio settings and Credits are available from the title screen; opening Help or settings during a match pauses it. Escape closes native settings/help dialogs before affecting the paused game.

There is no background music or external player. Effects and Voices have separate saved sliders, starting at 65% and 80%. Master mute and unavailable-storage fallback are preserved. Successful player skills display Japanese comic-style callouts even while muted. Failed cooldown presses and bot activations stay silent. Reduced-motion preferences disable callout bounce.

### Voice credits and regeneration

**VOICEVOX Nemo** provided the locally synthesized Japanese speech. Engine: 0.23.0. Terms: https://voicevox.hiroshiba.jp/nemo/term/ . Official engine: https://github.com/VOICEVOX/voicevox_nemo_engine/releases/tag/0.23.0 . Retain this attribution and the in-game Credits when distributing the generated speech. No anime recordings or actor imitations are used.

| Clip          | Japanese callout   | Nemo voice    |
| ------------- | ------------------ | ------------- |
| Kitsu     | 狐ラッシュ！       | 女声1 / 10005 |
| Kairo     | 気砲！     | 男声1 / 10001 |
| Pomu | ゴムツイスト！       | 女声2 / 10007 |
| Infinity Veil | 無限バリア！       | 男声3 / 10002 |
| Hollow Purple | ホロウ・パープル！ | 男声3 / 10002 |
| Spirit Bomb | 元気玉！ | 男声1 / 10001 |

The speech is generated with distinct pitch, speed and intonation settings, then paired in-game with character-specific original effects. Exact settings are recorded in `public/audio/credits.json`. The game serves the WAV files locally; Nemo and Python are **not required to run or build the game**.

To regenerate the six voice clips, run the official Nemo engine locally on `127.0.0.1:50123` and run `python scripts/build_audio.py`. Pass `spirit` to regenerate only the Spirit Bomb clip. The development-only generator is not shipped into the browser.

Validation includes gameplay, both ultimates, map resources, saved settings, voice cancellation, missing assets, and mute/volume behavior.

### Spirit Bomb — Kairo / Goku

Press **V** or the Spirit Bomb touch button. A dedicated cinematic shows raised chibi arms, energy ribbons gathering into a textured sphere, a forward throw, and a cloud-and-petal impact. Enemies freeze in place: there is no pull. This player-only ultimate detonates at 3.4 seconds, grants invulnerability throughout its 5.6-second cinematic, and respawns 20 bots afterward. Its independent cooldown is 30 seconds. **E** remains Ki Cannon. Both ultimates display Japanese charge and explosion lettering. Pause freezes their simulation; restart clears every effect and cooldown.

### Cozy world rebuild

All four maps now use rounded toy-town scenery, warm matte palettes, subtle ground details, cream signs, and layered contact shadows. Shibuya is lavender dusk; Hidden Leaf has mint greenery and honey paths; World Tournament has ivory paving and coral/teal gates; Grand Line has cream sand, scalloped shores, turquoise water and toy ships. Map IDs and saved choices remain compatible. Landmarks remain outside the arena and never create obstacles. Frozen coils have dark blue outlines; snakes have ground shadows for contrast.

Spirit Bomb has independent pooled geometry and animation in `src/spirit.ts`; Hollow Purple keeps its original pull and presentation. Spirit Bomb's impact point is captured along the facing direction and clamped inside the arena. Reduced motion disables cinematic camera tracking and shake. SFX and Japanese voices remain; no music is included.


## Worlds Reborn (v1.1)

The four original maps now use their own authored world builders under `src/worlds/` and a shared batching/resource owner. `src/environments.ts` remains the public builder entry point. Each environment exposes a readonly visual frame update and idempotent disposal; map resources are owned separately from cached character models. A generated local sign atlas, instanced repeated props and bounded point/line effects keep the worlds compact. The renderer has one visual clock that stops while paused or hidden, and map lighting responds to the existing cinematic state and resets on completion.

The desktop/mobile profile is selected from viewport width and coarse pointer input. Mobile keeps the landmarks and uses fewer props, crowd figures, particles, atlas pixels and water vertices. The profile budgets count environment geometry only:

| World | Desktop calls / triangles | Mobile calls / triangles |
|---|---:|---:|
| Shibuya After Dark | 10 / 11,768 | 10 / 10,412 |
| Hidden Leaf Village | 16 / 18,652 | 16 / 12,236 |
| World Tournament | 19 / 65,104 | 19 / 26,512 |
| Grand Line Harbor | 34 / 22,174 | 34 / 15,870 |

These measurements are from the generated environment batches before other game objects are rendered. The complete match with 20 active bots measured 117 draw calls and 169,440 triangles in the local desktop browser; its observed frame-time median was 10.4 ms and 95th percentile 14.4 ms in a short run. Hardware and browser conditions change these numbers. Use `?worldDebug=1` for an opt-in local diagnostics panel with frame samples and a 40-switch resource cycling check; remove the query for normal play.

Validation: `npm test` covers both profiles, deterministic authored layout, landmark clearance, motion bounds, pause/reduced-motion behavior, cinematic-response reset, and one-time disposal including textures, lines, points, instances and shared character assets. The 40-switch browser run returned to stable geometry/texture/program counts for all four maps after warmup. Mobile review used a 390 × 844 browser viewport; a physical phone and hardware GPU profile remain manual checks. The browser performance figures describe this workstation only, not a guaranteed frame rate.


## v1.2.0 — Character & Combat Polish

Kitsu, Kairo, Pomu and Shiro now have distinct E identities: movement, ranged disruption, steering, and area control. Kitsu gains warm afterimages and a forward lean; Kairo shows a fixed firing direction and solid hit-sized projectile core; Pomu gets elastic ribbons, vertical squash/stretch and banking; Shiro has a clear 12-unit field and violet slowing cues. Cosmetic deformations keep body centers and horizontal collision widths aligned. Existing head outlines, Shiro’s curved blindfold and Denz credits are retained.

The HUD shows charge and remaining active time before showing cooldown. A mint ready state and quiet disabled state stay within the existing buttons. Short activation feedback and individual menu idles respect reduced motion. Per-step events reach the renderer before the next simulation step replaces them; voices remain player-only and cannon fire/impact effects are separate from the callout. The three renamed callouts were regenerated with the existing Nemo voices and settings.

Validation includes charge/aim timing, swept head/body hits, first-contact selection, impulses and collision deaths, bot use, field entry/exit, normal Shiro vulnerability, pause/restart/cinematic cleanup, HUD states and bounded presentation pools. Physical touch-device input and extended competitive balance remain playtesting tasks. Earlier Worlds Reborn performance figures above are historical environment baselines, not measurements of this combat update.


## v1.2.1 — Spirit Compass & Living World Polish

The minimap is now a small cream spirit compass with a map-specific interior, quiet rival dots, a directional player marker, and a peach boundary warning. The warning begins in the outer 12% of the safe arena radius, accounting for the player's growing head. A cached canvas background and a maximum 30 Hz draw rate keep it inexpensive. Marker interpolation uses fixed-step snapshots without prediction; spawns, restarts and cinematic transitions snap cleanly. It preserves the existing player/rival/boundary information and adds no food markers.

Existing world animation has been refined with slow sign and lantern brightness variation, softer rain, traffic, flags and ship rocking, drifting leaves, and sparse tournament glints. Ground markings do not receive lantern brightness modulation. Water, sails, foliage, crowds, clouds and gulls retain their existing pooled or shader-driven animation. Character breathing and boost response move vertically by at most 2.8% of scale, with unchanged horizontal centers and widths. Pickups, bot arrivals and deaths share existing effect buffers; rapid pickups coalesce and ultimate wipes suppress individual death puffs.

The existing HUD receives short score/rank/readiness reactions, smooth cooldown fills, and a brief map-pill/compass entrance. Leaderboard rows retain their DOM identity and fade on rank changes, avoiding crossing text. There are no new gameplay HUD panels. Abilities, collision rules, scoring, map layouts, personal best and saved preferences are unchanged.

### Presentation architecture and lifecycle

- `src/minimap.ts`: typed themes, readonly snapshot projection and cached compass rendering.
- `src/presentation.ts`: one live reduced-motion observer, readonly shared clock frame, bounded vertical motion and clock-sampled HUD animation handles.
- `src/hud-feedback.ts`: change detection and keyed leaderboard row updates.
- `src/life-reactions.ts`: 24 reusable reaction slots, with at most eight simultaneous spawn or death reactions; rendered through the existing skill-effect pools.

The renderer's existing visual clock drives the compass, world and HUD. Pausing or hiding the tab freezes it; restart/quit clear reaction slots, marker histories and animation handles. Reduced motion removes decorative breathing, pulses, glints, pickup/spawn/death flourishes, and exaggerated deformation while preserving position, boundary warnings and skill cues. It also updates both ultimate renderers live. The opt-in `?worldDebug=1` checker includes a non-persistent **Reduced motion preview** toggle for review; normal play shows no diagnostics.

### Validation and performance

The 105 existing tests are retained, with ten additional presentation tests for themes, growing-head warning thresholds, snapshot interpolation and resets, the 30 Hz ceiling, paused rendering, reduced-motion changes, event coalescing, bounded effects, reusable accessible leaderboard content and repeated cleanup. Run `npm test` and `npm run build` before publishing.

The new feedback reuses existing Three.js effect buffers and introduces no new environment meshes, texture downloads, shadow lights or physics. Snake body colors are now cached instead of allocated for each segment every frame. Existing environment draw-call/material budgets remain in force for desktop and mobile.

Short local Shibuya gameplay samples with 20 bots measured a median/P95 frame interval of **7.0/10.4 ms before** (165 samples) and **6.9/10.4 ms after** (300 samples). These were different random matches and camera positions, not a controlled benchmark or an FPS guarantee. The captured post-death render counts were respectively 145 calls/258,616 triangles and 77 calls/292,704 triangles, so those totals must not be interpreted as a like-for-like speedup. Shibuya's environment stayed at 10 draw calls, 11,912 triangles and 10 materials.

A 40-map switching review returned exactly to its warmed resource counts: Shibuya 20 geometries/1 texture/13 programs; Hidden Leaf 21/1/14; Tournament 21/1/15; Harbor 30/1/17. The additional glow shader varies elevated lights without new draw calls. These counts exclude active match objects and are specific to this desktop review.

## v1.2.2 — Centered Music Icon

Replaced the audio-settings button's font music glyph with a centered inline SVG note. Explicit icon dimensions keep it aligned within the round button across desktop and mobile layouts. No audio or gameplay behavior changed.

## v1.2.4 — Centered Pause Actions

Primary action labels now stay centered within their buttons, while the arrow sits in a fixed right-side position. This prevents the arrow from pulling the “Keep playing” and other action labels off center in the pause, results, and title screens.

## v1.2.3 — Boost Rush Feedback

Holding boost now emits a short, flowing wake behind the player, tinted to the selected character. The camera eases into a small follow offset and widens its field of view while boost is active, then eases back when released. These cues respond to the live boost state, pause with the match, and are reduced by the reduced-motion setting. They do not affect movement, collisions, or boost cost.

Release checks passed: **115 tests, zero failures**, and the TypeScript/production build. Browser review covered all four map themes on desktop and a 390 × 844 phone viewport, character selection, normal play, ability feedback, both ultimates, frozen opponents, pause, results and repeated restarts. Both ultimates completed with their existing eliminations and bot recovery. The compass and touch controls remained separate in the phone layout. Live reduced-motion preview retained essential markers and ability cues while removing decorative motion; the OS preference listener also has automated coverage.

Changed files are the four presentation modules listed above; their integration in `src/main.ts`, `src/renderer.ts` and `src/skill-effects.ts`; shared reduced-motion handling in `src/spirit.ts` and `src/purple.ts`; `src/style.css` and `src/ui.ts`; existing world animation in `src/worlds/{architecture,atmosphere,builder,diagnostics,harbor}.ts`; `tests/presentation.test.ts`; package metadata and this documentation. `src/simulation.ts` is unchanged. Audio remains SFX and Japanese voices only.

Remaining manual checks: physical-phone touch and GPU performance, extended maximum-size-snake play, and exhaustive boundary/ultimate combinations on every map. Boundary thresholds and growing-head safety are covered by automated tests, but the short browser sessions are not a full visual or performance matrix. A later pass should use repeatable seeded benchmark runs on desktop and mobile hardware before tuning effects further.

## v1.2.5 — Boost & Fox Rush Polish

Normal boost now eases the gameplay camera from 43° to 48° field of view with a small direction-aware follow offset. Fox Rush reaches 50° with slightly more follow. The head leans forward and the body compresses vertically by no more than 4.5%; horizontal segment centers and simulation hitboxes remain unchanged. The previous boost streak prototype now fades in and out with a single pause-aware presentation strength, reaching about 12 streaks for normal boost and 20 warmer streaks for Fox Rush. A low-opacity peripheral overlay reinforces speed while keeping the middle of the screen clear.

The existing instanced effect buffers also provide a handful of map-tinted motes: Shibuya lights, Hidden Leaf leaves, Tournament dust, and Harbor spray. Boosted energy pickups gain a compact flash and backward-flowing particles. The boost button shows an active reaction or an accessible “Need energy” state at minimum mass, without losing pointer release handling. Fox Rush keeps its existing three-second free-boost and 12-second cooldown.

Boost audio is generated locally through Web Audio: one short filtered-noise whoosh at activation and a quiet, continuous wind layer while active. Fox Rush receives a stronger, warmer treatment; its existing Japanese callout remains. The wind shares the Effects and master volume controls, fades after release, and stops on pause, mute, zero effects volume, hidden tab, death, quit, restart, and cinematic activation. No music or new audio assets were added.

Reduced motion removes peripheral lines and extra deformation, limits FOV change to two or three degrees and camera offset to at most half a world unit, and keeps a single subtle trail mote. The visual clock freezes the effect during pause. Camera, character posture, motes, and audio read simulation state; `src/simulation.ts` and its movement, collision, score, and ability rules are unchanged.

Validation: **118 tests passed**, including added checks for boost audio loop reuse and cleanup, Fox Rush presentation, reduced-motion limits, and minimum-mass HUD state. `npm run build` passed. The local browser preview was reviewed at desktop and phone-sized widths, including Fox Rush on all four map themes and the reduced-motion preview, with no browser console errors. Prolonged boost comfort, physical touch input, device audio latency, and hardware frame timing still need a device pass.

## v1.2.6 — Boost label spacing

The Space key hint now sits beside the Boost title, leaving the status line clear for “Need energy.” The desktop button has enough width for the full status; the phone layout continues to hide key hints and can wrap status text when needed. Gameplay is unchanged.

Validation: 118 tests and the production build passed. The minimum-energy button was visually checked at desktop and phone widths in the local preview; no browser console errors appeared.

## v1.2.7 — Elimination Stamp

Each confirmed player elimination emits a separate `player-elimination` event at the defeated snake's death position, using the same branches that increment the existing kill count. Presentation projects that position through the gameplay camera and briefly shows a pooled **撃破！** manga stamp with an impact ring. Full-arena ultimate wipes use smaller stamps for each rival and one coalesced impact sound. Offscreen deaths do not display an edge marker. The event sequence prevents replayed batches from creating duplicate stamps.

The fixed pool holds 24 stamps and clears on restart, quit, player death, and new matches. Its age follows the shared pause-aware visual clock. Reduced motion removes the pop and rotation while keeping the text readable. The impact uses the existing Effects and master controls; no new voice or music assets were added. Simulation collision, scoring, movement, and balance are unchanged.

Validation: **124 tests passed** and `npm run build` succeeded. Both ultimate wipes were reviewed in the local browser at desktop and phone widths; the compact stamps stayed clear of the HUD, and the browser reported no console errors. A naturally earned single kill, physical-device timing, and subjective visual/audio tuning remain manual review items.

## v1.2.8 — UI & Micro-Animation Polish

The cream selection card is slimmer and lighter, with clearer map labels, modest button feedback, and a 240 ms portrait selection response capped at 1.04 scale. Desktop character previews are about 7% larger and slightly raised. Per-instance eye groups blink on Kitsu, Kairo and Pomu; Shiro gives a tiny selection nod. Shared model assets and fine hair silhouette geometry remain intact. Body outlines use charcoal with 1.06 expansion, retaining 1.08 for frozen snakes.

Typed character accents tint ability borders, progress and active states. Cooldown completion still produces exactly one pulse. The leaderboard keeps reusable keyed rows, measuring layout once before animating only changed ranks. The compass gains a clearer cocoa arrow and cream halo. Opening hints retain their 2.6-second lifetime on the shared pause-aware clock; map labels settle to a quieter state after three seconds. Restart, quit and skill activation clear the relevant transient feedback. Reduced motion removes blinking, bobbing, selection bounce, row travel and decorative pulses while preserving static states.

Changed for this patch: `src/presentation.ts`, `src/hud-feedback.ts`, `src/main.ts`, `src/renderer.ts`, `src/models.ts`, `src/minimap.ts`, `src/style.css`, `src/ui.ts`, `tests/ui-polish.test.ts`, outline/halo expectations in existing tests, package metadata and this README. Earlier local release changes are preserved. Gameplay and audio are unchanged by this patch.

Validation: **129 tests passed**, including five new presentation tests covering hint/map lifetimes, pause/reset, preview reactions, bounded blinking and clone isolation, animation replacement/reduced motion, and all character accents. Production build passed. Desktop/short-window previews covered all four characters and worlds; a 390 × 844 phone review covered menu stacking and Hollow Purple. Runtime reduced-motion controls and Spirit Bomb were exercised. No browser console errors were reported.

Forty map switches returned identical warm/final renderer resource counts: Shibuya 20 geometries/1 texture/13 programs; Leaf 21/1/14; Tournament 21/1/15; Harbor 30/1/17. This patch adds no render geometry or particle pools, only eye transform groups and presentation state. A short Tournament cinematic sample with 21 snakes reported 181 draw calls, 369,672 triangles, median 13.4 ms and p95 41.5 ms (11 samples). This is not a controlled before/after benchmark and should not be compared directly to the older normal-play measurements above. Sustained frame timing on real desktop/mobile hardware, physical touch releases, large-snake boundary cases and the full character/map/ultimate combination matrix remain manual review items. Local release only; no Git publishing or deployment.

## v1.2.9 — Map Finish & Texture Polish

All four worlds now use deterministic local surface textures: asphalt, plaster, timber, roof tiles, stone, sand, fabric, grass and rock. Materials are created lazily per map, shared by instance batches, and disposed with the environment. Neutral texture modulation preserves authored colors. Face-projected mapping uses transformed geometry coordinates so scaling a building does not stretch its texture. Desktop textures are 256 × 256; mobile textures are 128 × 128, with repeat wrapping and mipmaps. No network texture files, new lights, bloom or reflections are required.

Shibuya gains textured pavement and storefront trim with brighter crossing paint. Hidden Leaf gains continuous path ribbons, timber window frames, roof tiles, drainage/bridge materials and rock strata on the guardian cliff. Tournament gains stone tiers and gate materials plus a continuous flat perimeter inlay. Harbor gains timber docks/hulls, sand and quay surfaces, fabric sails and fitted sail seams. New sail materials retain subtle pause-aware movement and double-sided visibility. The existing architecture layout, collision boundary and landmark clearance are preserved; arena decoration remains flat.

The surface audit found that most plain areas had no material maps, rather than failed downloads. Sign UVs now stay inside padded atlas cells and disable mipmaps that can bleed neighboring signs. Missing/failed canvas contexts produce opaque dark sign panels. Texture-generation failure retains the material's base color. Continuous village paths replace overlapping coplanar strips, and diagonal crossing paint has a separate depth layer. Harbor custom surfaces explicitly preserve their authored colors during batching. Postcards are generated from the updated environments at startup.

| Environment | Desktop calls / triangles | Mobile calls / triangles | Materials | Textures |
| --- | --- | --- | --- | --- |
| Shibuya | 12 / 12,200 | 12 / 10,844 | 13 | 4 |
| Hidden Leaf | 29 / 19,620 | 29 / 13,204 | 17 | 9 |
| Tournament | 30 / 65,368 | 30 / 26,776 | 13 | 5 |
| Harbor | 63 / 23,562 | 63 / 17,258 | 16 | 7 |

Counts are environment-only construction statistics; full-game counts include snakes, food, outlines and ultimates. Every profile remains below its draw-call, triangle and material budget. Compared with the earlier Tournament environment (19 calls / 65,176 triangles), the finished version adds 11 calls and 192 triangles.

Validation: **134 tests passed**, preserving the 129 prior tests and adding checks for deterministic opaque texture data, profile resolution, generation fallback, atlas padding, finite UVs, repeated resource disposal and upward-facing continuous paths. The production build passed. Browser review and resource measurements are recorded below. Real-device touch performance and an exhaustive map/character/boundary/ultimate combination pass remain manual review limitations.

This patch changes the shared world builder and architecture helpers, all four map builders, adds `src/worlds/surfaces.ts` and `tests/surfaces.test.ts`, and updates visible/package versions and documentation. Existing local edits remain intact. No simulation, balance, audio or UI layout changes are part of v1.2.9. Local preview and source archive are refreshed; no Git publishing or deployment.


Browser review for v1.2.9: all four menu environments were checked at the available 943 × 694 desktop/short-window size and at 390 × 844. Gameplay surfaces were inspected on Tournament, Leaf and Harbor; Hollow Purple was checked on Shibuya at phone size, and Spirit Bomb/frozen opponents on Leaf at desktop size. Pause was exercised on Harbor. No browser shader/console errors appeared. Edge views, every ultimate recovery stage, and every map on physical phones still need a longer manual pass.

The 40-switch browser audit returned identical warm/final geometry / texture / program counts: Shibuya **20 / 4 / 16**, Leaf **23 / 9 / 22**, Tournament **22 / 5 / 19**, Harbor **42 / 7 / 22**. For normal Tournament play, a pre-change sample reported median **12.7 ms**, p95 **25.5 ms** over 143 samples (the player died during capture). The post-change sample with 20 bots plus the player reported median **12.9 ms**, p95 **18.6 ms** over only 10 samples. Browser automation throttled sampling, so these are observations, not a statistically comparable before/after benchmark or an FPS guarantee. A controlled sustained hardware comparison remains outstanding.

## v1.3.0 — New Ways to Play

The menu offers **Endless** (the default) and **3-Minute Sprint**. Sprint uses the same peak-energy score as Endless. Its 180-second clock advances only with the simulation and freezes during pause or a hidden tab. Dying ends the run early. When time expires during Hollow Purple or Spirit Bomb, the cinematic finishes before results appear and before another normal movement step. Results show best energy, credited eliminations and survival time. Sprint records use `anime-coil-sprint-best-v1`, separate from the unchanged `anime-coil-best` Endless key. Equal Sprint scores compare eliminations, then survival time. Quitting a Sprint does not record a result.

Help opens **Guided Practice** using the selected character and map. It has no bots and walks through turning, collecting five orbs, holding Boost for a second, and activating E. Each step can be skipped, and **Leave practice** returns to the garden. A boundary death uses the same three-second player respawn; practice never records a best score or advances challenges.

The **Challenges** button opens four fixed, offline lifetime goals. Progress is awarded only from eligible match simulation steps and confirmed player events; saved data is validated, and disabled storage never prevents play.

| Goal | Target | Reward |
| --- | ---: | --- |
| Spirit Gatherer | Collect 100 energy orbs | Neon Spirit body skin |
| Steady Spirit | Survive 10 total minutes | Spiritweave body skin |
| Coil Champion | Earn 10 credited eliminations | Petal Drift boost trail |
| World Sprinter | Finish a Sprint on each of the four maps | Starlight boost trail |

Unlocked body skins and trails can be previewed and equipped from the same screen. The default cosmetics remain available. `anime-coil-progression-v1` stores bounded challenge counters, completed map IDs, and equipped choices; legacy color selections migrate to their matching skins. Cosmetics affect only the player's body material and boost trail; bot colors, hitboxes, movement, and scoring stay unchanged.

Rendering reduces fixed chibi-head draw objects by merging like-material parts while preserving animated eyes, Shiro's curved blindfold, details and head silhouettes. Per-head mesh counts are now 16/11/15/13 for Kitsu/Kairo/Pomu/Shiro, versus 40/33/29/33 before this pass. Each body sphere now has 132 triangles versus 168, and body instance colors upload only when growth, frozen state or equipped skin changes. Body skins reuse the same instanced geometry; Spiritweave uses one shared generated texture, and Neon Spirit adds no glow pass. Energy pickups already used one instanced eight-triangle octahedron draw, so they were left intact. Environment budgets and mobile/reduced-motion profiles are unchanged.

Open `?worldDebug=1` only for local diagnostics. **Profile 6s** requires 21 live snakes, warms up for one second and samples five seconds of frame intervals, draw calls and triangle counts; normal, Hollow Purple and Spirit Bomb are reported separately when observed. **Capture stats** includes renderer geometry, texture and program counts. This panel collects no telemetry and never sends measurements to a server. Results are browser observations, not a controlled FPS guarantee.

A 21-snake Harbor profile in the local desktop browser reported a **7.3 ms median**, **11.9 ms p95**, **137 median draw calls**, and **241,660 median triangles** across 300 bounded normal-play samples after warmup. Separate 300-sample cinematic captures reported Hollow Purple at **7.0 / 13.8 ms median/p95**, 49 median calls and 47,436 median triangles; Spirit Bomb at **7.6 / 10.5 ms**, 289 calls and 359,348 triangles. These were different short runs, and each ultimate includes a full-arena wipe, so their snake counts change during sampling. They show local presentation cost, not a controlled before/after speedup or real-device FPS. The larger Spirit Bomb remains the heavier draw-call phase.

Forty opt-in map switches returned identical warm and final renderer geometry/texture/program counts for every map: Shibuya **121/4/25**, Leaf **124/9/32**, Tournament **123/5/29**, and Harbor **152/7/31**. This indicates the environment-owned resources stabilize after switching. Shared character models remain cached throughout.

Validation: **151 tests passed**, including Sprint deadline, pause, early death, cinematic timeout and record tie order; practice steps/exclusions; challenge triggers, storage corruption/fallback and rewards; and model batching. TypeScript checking and `npm run build` passed. Desktop browser review verified mode selection, Sprint countdown and early-death results, Help-to-Practice, skip/leave flow, the challenge sheet, separate record display and practice exclusion from progress. Both ultimates completed with 20 credited eliminations and bot recovery. Physical touch input, phone-sized browser presentation, longer full-Sprint playthroughs and a sustained cross-device performance comparison remain manual review items. The preview and source archive are generated locally; no Git publishing or deployment is part of this release.

## v1.3.1 — Practice UI fix

The practice guide now accepts pointer input above the arena, so **Skip step** and **Leave practice** work with mouse or touch. Both controls use 44-pixel minimum touch targets. The top-center match HUD no longer shows the map name; it keeps only the match mode or Guided Practice label. Map names remain visible in the selection menu. Gameplay and progression rules are unchanged.

Validation: 151 tests and `npm run build` passed. In the local browser preview, **Skip step** advanced the guide, **Leave practice** returned to the menu, and a normal match showed only the mode label at the top center. Physical touch remains a device-level check.

## v1.3.2 — Hidden Leaf terrain finish

Hidden Leaf now has a continuous winding perimeter canal, four fitted timber bridges, connected narrow village paths, textured grass islands, and a more layered guardian cliff. The old isolated channel strips are gone. Shops use aligned gabled roofs and an anchored fascia; the same shared roof fix improves Harbor cottages. Water, bridge decks, and raised scenery stay beyond the playable boundary. This patch changes only the procedural world geometry and materials, not map IDs, collision, scoring, abilities, or match rules.

The canal uses deterministic upward-facing ribbon geometry with finite world-scale UVs, tracked by the existing map resource owner. Mobile uses fewer ribbon sections while retaining all four bridges. Hidden Leaf measures **40 environment draw calls, 22,492 triangles, 19 materials** on desktop and **40 calls, 15,676 triangles, 19 materials** on mobile, below both environment budgets. Targeted tests verify continuous water, clearance, normals, mobile construction, and roof fit; the full suite and production build pass. Local menu and normal-play previews were reviewed. Physical-device terrain contrast and longer play sessions remain visual tuning checks. The local preview and source archive were refreshed; Git publishing is outside this patch.

## v1.3.3 — Living world polish

The three other worlds now have more complete approaches to their arenas. **Shibuya** has a continuous night arcade, connected crossing approaches, streetlights, brighter roof trim, and distant rooftop signs. Its existing rain, traffic, and sign changes remain pause-aware. **World Tournament** has joined stone concourses, paths from the court to the stands, a center medallion, warmer spectator details, and a fitted gate roof. Existing flags, crowd sway, and ultimate reactions remain in use. **Grand Line Harbor** has a smoother shoreline, piers that physically meet the quay, narrower sand paths, ship wakes, darker grounded islands, softer directional water variation, and a bounded pool of moving wave marks. Ships, clouds, and gulls continue to move through the existing world clock; reduced motion holds decorative movement still.

All new raised geometry remains outside the playable boundary. Map IDs, arena dimensions, movement, abilities, and scoring are unchanged. Mobile keeps every main landmark with lower geometry and fewer wave marks. Current environment counts are Shibuya **17 calls / 14,976 triangles** desktop and **17 / 13,522** mobile; Tournament **45 / 68,912** and **45 / 30,032**; Harbor **69 / 28,202** and **69 / 19,906**. Each map stays below its existing draw-call, triangle, and material budgets. Tests cover arena clearance, continuous flat concourses, connected piers, deterministic construction, paused animation, and owned-resource disposal. Menu previews were reviewed locally; physical-device lighting, phone framing, and sustained frame timing remain manual checks. The local preview and source archive are refreshed; Git publishing is outside this patch.

## v1.3.4 — Arena, wind, and elimination polish

Shibuya's oversized road slabs have been narrowed and lowered in contrast so its crossing reads as the focal ground mark. Harbor's long sand strips have been removed to leave a clean playing court, while Tournament's decorative inlay now sits outside the collision boundary. These flat, non-blocking scenery changes leave the arena dimensions and all gameplay rules untouched.

Boost now adds a projected-heading wind layer alongside the existing world streaks. A single bounded canvas draws curved, depth-varied streaks in each map's palette, mostly at the screen edges; Fox Rush uses denser warm lines. The existing presentation clock drives the fade and motion, and pause, death, cinematics, restart, quit, and reduced motion clear it. There is no new animation loop or post-processing pass.

Confirmed player kills retain the simulation's `player-elimination` event and a fixed 24-slot stamp pool. The **撃破！** callout now has a cream manga sticker, ink slash, ring, and restrained flecks, with compact treatment for ultimate multi-kills. Offscreen and HUD-covered deaths do not get a misleading clamped stamp. The coalesced Effects-channel impact sound has a brush snap and small chime; mute and volume preferences still apply. The full **161-test** suite and production build pass; added coverage checks event deduplication, pool limits, screen placement, wind bounds and heading, cleanup, and the Tournament rim. Shibuya, Harbor, and Tournament menu previews and Fox Rush at match scale were reviewed locally. A manual single-kill/multi-kill appearance check and sustained physical-phone comfort pass remain. The source archive and local preview are refreshed; Git publishing is outside this patch.

## v1.3.5 — Visible boost trails

Equipped boost trails now produce distinct marks beside the actual coil path instead of merely recoloring thin streaks hidden beneath the body. Original uses paired character-colored streamlines; Petal Drift leaves drifting pink and peach petals; Starlight leaves blue-white sparks and tiny rings. The directional screen wind also adopts the selected trail palette. Fox Rush makes the path marks denser and slightly larger. All trail marks remain presentation-only, use the existing shared instance buffers, and stay within a fixed 22-mark pool with a short fade. Pause freezes them, reduced motion removes them, and restart, quit, and cinematics clear them. Boost speed, mass cost, collisions, and cosmetic unlock rules are unchanged.

Validation: **163 tests passed** and the production build passed. Targeted tests check distinct visual marks, their position outside the coil, no new marks during pause, reduced-motion cleanup, and cosmetic wind colors. Petal Drift was visually checked during Fox Rush in the local browser preview. Starlight remains locked in that saved profile, so its in-browser appearance and physical-phone comfort still need a manual pass. The local preview and source archive are refreshed; Git publishing is outside this patch.

## v1.3.6 — Compact match HUD

The active Endless, 3-Minute Sprint, or Guided Practice label now sits as a small mint chip beneath the rank and clock inside the Energy card. The separate center-top mode pill is removed, leaving the middle of the arena open after onboarding. The starting “Gather energy. Watch your head!” hint remains a status announcement, stays for four active seconds, then fades by opacity and leaves the accessibility tree. Pause or a hidden tab freezes its lifetime; restart shows it again. Practice keeps its own guide without the opening match hint. Match mode IDs, timers, score, and gameplay are unchanged.

Validation: **164 tests passed** and the production build passed. The local browser preview was checked in Endless and Sprint at desktop size, including the hint appearing and then clearing. Physical-phone sizing remains a manual visual check.

## v1.3.7 — Hidden Leaf roads and world surface polish

Hidden Leaf's canal bridges now use the canal's varying radius, and four inner roads and outer village approaches meet each bridge at its actual ends. Short stepped timber ramps lower the decks onto the roads on both banks, replacing the previous fixed-radius placements and visible road gaps. Surface textures have stronger but restrained grain and clearer grout, roof, grass, sand, and rock patterns. Ambient motes are easier to see and drift more naturally while remaining paused with the shared visual clock and static under reduced motion. These cosmetic updates do not change map IDs, arena size, collision, or gameplay.

The local production build was checked after these changes. The updated local preview and source archive are refreshed; Git publishing is outside this patch.

## v1.3.8 — Optional dark interface

Audio settings now include a **Dark mode** toggle. It applies a coordinated deep navy, warm ivory, and mint palette to the menu, HUD, dialogs, controls, and challenge screens while leaving the 3D maps and their lighting unchanged. The preference is saved locally with a versioned key; if browser storage is unavailable, the toggle still works for the current session. Audio controls and game state are unchanged.

## v1.3.9 — Boost text contrast in dark mode

When boost is active, the Boost label, active status, and Space keycap now use darker ink against the warm highlight surface. This keeps the active state readable without changing boost behavior or its feedback colors.

## v1.3.10 — Dark pause icon polish

In dark mode, the cloud icon at the top of the pause and results cards now sits in a compact near-black circular badge instead of a full-width green strip. The mint cloud remains visible against the dark badge, which follows the modal palette more naturally. This is a presentation-only change; pause, resume, and results behavior are unchanged.

## v1.3.11 — Three-second respawns

Bot replacements now wait **3 seconds** after a confirmed death. The player also gets a 3-second respawn countdown, while the current match, clock, surviving bots, food, peak score, and credited eliminations continue. Respawn starts a fresh coil at minimum size in a clear arena position; the run's peak score and kill count are retained. Pause and hidden-tab states freeze respawn timers. A sprint still ends at its existing deadline, and practice remains bot-free. The countdown appears in a compact, accessible HUD notice.

Validation: the full **164-test** suite passes, covering player and bot delays, paused countdowns, carried-over run stats, ultimate elimination timing, and the existing sprint deadline. The production build passes. Manual browser and phone play checks remain useful for tuning the countdown's placement and respawn camera transition.

## v1.3.12 — Dark pause badge blend

The cloud badge on the dark pause and results cards now uses the same background color as its card instead of a separate black circle. The mint icon remains visible, while the badge blends naturally into the panel. No gameplay behavior changed.

## v1.3.13 — Spirit resting death polish

Player death now uses a compact **Spirit resting** card with the collision/death reason and a large countdown driven directly by the existing three-second simulation timer. The number reacts only when its displayed second changes; the card fades after the authoritative respawn without holding up play. A restrained world vignette/desaturation and pooled impact ring mark the death, while dead-state HUD controls read **Respawning…** and remain clear. Pause stays usable, and pause/hidden tabs freeze the presentation along with simulation.

The simulation now emits a single `player-respawn` presentation event when the existing respawn path creates the new coil. The shared effect pool uses it for an arrival ring, and the Effects channel plays a quiet two-note recovery chime. The existing death sound, mute and volume controls remain in effect. Reduced motion removes the countdown bounce and moving death particles while keeping the text and a small static ring. Death rules, timer, scores, modes, abilities, and balance are unchanged.

Validation: **167 tests passed** and `npm run build` succeeded. The local browser loaded the v1.3.13 app shell; its automation connection could not complete interactive gameplay review. Desktop and phone presentation should still be checked in both themes, especially card placement with pause open and repeated deaths; no physical-device review was available for this local patch.

## v1.3.14 — Player coil readability

The player coil now has a warm cream band every sixth body segment, layered over its selected character or equipped palette colors. Bots retain their existing character pattern. A subtly brighter charcoal outline distinguishes the player without adding geometry or draw calls; the same band pattern appears in the menu coil preview and remains static during motion and ability effects.

This band-based distinction is superseded by the full-body skin cosmetics in v1.3.15.

Rendering uses per-instance colors on the existing body meshes. No simulation state, collision dimensions, character IDs, or gameplay rules changed. Tests cover the band cadence, unchanged bot colors, character identity, and stable player ownership through respawn and a new match.

Validation: **171 tests passed** and the production build succeeded. The render change reuses existing instanced body and outline meshes, so it adds no draw calls or per-segment materials. Manual desktop and phone checks should still tune cream-band contrast on large coils and frozen-opponent overlaps.

## v1.3.15 — Neon and Spiritweave skins

Replaced the player-only cream bands and challenge palette rewards with full-body cosmetics: **Neon Spirit** adds a restrained emissive finish in the chosen character's hue, and **Spiritweave** applies a generated, tileable scale texture tinted by the character's existing palette. The default player outline remains slightly brighter than bot outlines as a small always-on ownership cue. Boost trails, challenge goals, character colors, hitboxes, and gameplay are unchanged.

Existing challenge progress and saves are preserved. Legacy Sunset palette equipment maps to Neon Spirit, and Moonlit maps to Spiritweave; the same progression key reads version-one saves and writes the new version-two cosmetic shape. Skins use the existing per-snake instanced body mesh and a single shared texture, without per-segment materials or additional body draw calls.

Validation: **171 tests passed** and the production build succeeded. Skin material profiles retain all four character hues; generated texture tests cover determinism, grayscale tintability, opacity, seam continuity, and invalid sizes. Progression tests cover old-save migration, skin unlocks/equips, and storage fallback. Desktop/mobile material tuning remains a manual visual check.

## v1.3.16 — Coil readability and skin preview

The player now has a small cream sparkle mark every sixth body segment. These marks sit over Original, Neon Spirit, and Spiritweave without recoloring the whole coil; bots have no marks. The existing slightly brighter player outline remains. Marks follow the same instanced segment transforms, so they do not change hitboxes or simulation positions and add one bounded draw call for the player. The menu hero shows the same marks.

Locked body skins can now be tried on the full-size menu spirit. Opening a skin preview changes only the menu model; **Equip skin** appears only for an unlocked reward. Back, Escape, Play, and returning to the garden clear the temporary preview. Unlock progress, saved equipment, and cosmetic gameplay neutrality are unchanged.

Spirit Bomb's 24 textured orb patches now render in two instanced batches, and its ten energy ribbons use two combined line buffers. Mobile trims secondary clouds, petals, motes, ribbons, and rays while retaining the bomb's main sphere, throw, and impact. This reduces the effect's static draw-object count by 30 before other scene objects; no gameplay or cinematic timing changed. The effect remains owned by the renderer and does not create map-switch resources.

Validation: **176 tests passed** and `npm run build` succeeded. Browser review covered desktop and 390 × 844 layouts, locked Neon Spirit and Spiritweave previews, Back/Play cleanup, and the player's marks in the menu and match. The mobile check used a resized desktop browser, not physical phone hardware. A Shibuya desktop 21-snake diagnostic run after warmup sampled 300 normal frames (6.9 ms median, 10.0 ms p95, 114 median draw calls, 220,958 median triangles); bot deaths and respawns meant the minimum observed population was 19. A Harbor phone-sized viewport sampled 300 normal frames (7.9 ms median, 14.1 ms p95, 89 median calls, 216,864 median triangles; minimum population 18). A Spirit Bomb phase sampled 300 frames (7.0 ms median, 8.5 ms p95, 42 median calls, 169,492 median triangles), but its global wipe left one snake, so this is not a 21-snake ultimate benchmark. A 40-switch map cycle returned all four worlds to their warmup geometry, texture, and program counts. These are local browser observations, not controlled real-device performance guarantees.

The map cycle also exposed an older Harbor water shader error: a generated shoreline constant became invalid GLSL (`126.5.`). The generated literal is now valid and a regression test checks it, restoring the intended animated water on stricter WebGL implementations. The production build still reports the existing Three.js chunk-size advisory.

## v1.3.17 — Ultimate Cinematic Polish

Hollow Purple now builds separate red and blue orbs around Shiro, spirals them into a dense violet core, then opens into a sharp rupture with energy sheets, rings, fragments, and a brief dark cavity. Spirit Bomb instead grows a flowing blue-white orb above Kairo, throws it toward the existing impact point with a trailing wake and ground shadow, and resolves into a broad cloud dome and pressure wave. The effects use separate renderers and camera paths, with pooled vectors, geometry, and instanced details. A shared readonly timeline drives camera blends, short title/impact lettering, letterbox opacity, lighting overlays, and one-shot transition sounds. Normal gameplay framing is restored continuously at the end.

Both sequences retain the authoritative **5.6-second** duration and **3.4-second** elimination moment. Purple still pulls rivals; Spirit Bomb still holds them in place. Cooldowns, immunity, scoring, energy drops, and respawns are unchanged. Pause and hidden tabs freeze progression and stop sustained sound. Resume does not replay completed cues. Reduced motion keeps the gameplay camera and simpler energy silhouettes, removes full-screen flashes and fast decorative movement, and retains readable attack text. Existing Japanese voices remain, and all new convergence, compression, throw, rupture, and impact tones use the Effects channel; there is still no music.

Validation: **180 tests passed** and `npm run build` succeeded. Timeline tests cover stage boundaries, cue deduplication, pause/restart reset, reduced-motion output, camera return, and effect-object limits. The added ultimate objects remain at or below **24 desktop** and **16 mobile** draw objects per effect, excluding the ordinary scene. Browser review covered both sequences at desktop and a **390 × 844** viewport; pause controls stayed accessible and the console reported no shader or audio errors during those runs. The pre-update Shibuya desktop normal-play sample was 6.9 ms median / 10.0 ms p95 with 114 median draw calls and 220,958 median triangles (300 frames; population dipped to 19). A post-update Shibuya normal-play sample was 10.3 ms median / 16.1 ms p95 with 111 median calls and 213,228 median triangles (300 frames; population dipped to 17). A second post-update run sampled 300 normal frames at 11.4 ms median / 17.2 ms p95 with 124 median calls and 223,672 median triangles (population dipped to 16). The Shibuya ultimate phase samples were 8.7 ms median / 19.5 ms p95 and 51 calls for Hollow Purple (300 frames), and 7.1 ms median / 9.4 ms p95 and 43 calls for Spirit Bomb (110 frames). Both samples include the post-wipe one-snake interval, so they are not full-population pre-impact benchmarks. Because these runs were not seeded and bot counts differed, the frame-time differences are not isolated effect-cost measurements. A 40-switch map cycle returned every world to identical warmup and final geometry, texture, and program counts. Physical-phone touch, GPU-specific timing, every map/edge combination, and extended repeated activations remain manual review work. The preview and source archive are local; this release was not published to Git or deployed.

## v1.4.0 — Living Worlds, Spirit Forms & Skill VFX

The four worlds retain their existing IDs, open circular arenas, and cosmetic-only behavior. The map pass corrected Hidden Leaf road and bridge joins against the flowing canal, grounded district and roof placements, and tightened land/water and concourse transitions. Shared anchors keep buildings, roads, bridges, and shore details aligned; instanced pedestrians, spectators, traffic, ships, clouds, and foliage use bounded, deterministic motion that pauses with the visual clock. Tall structures and background actors stay outside the arena. No downloaded models or textures were added.

Kitsu and Pomu now have player-only V transformations alongside Shiro and Kairo's cinematics. Nine-Tail Cloak gives Kitsu a separate golden head with a flame crown, chakra collar, dark markings, a temporary gold-and-charcoal coil, and nine brighter tapered tails. Skybreaker gives Pomu a separate curled white-haired head, spiral brows, chibi grin, white costume with a purple sash, and a hat carried behind the head. Its temporary pearl coil retains the player ownership marks. Sculpted fists, elastic arms, smoke curls, and compact impact lettering complete the form. The equipped body cosmetic is not changed and returns when the form expires. Their authoritative 8-second durations, 30-second cooldowns, collision protection, boundary vulnerability, scoring, drops, and three-second respawns live in `src/simulation.ts` and `src/ultimates.ts`. E remains usable during either form. Bots cannot transform.

Skybreaker also bends nearby map markings and surface textures within a 24-unit **visual-only** radius. A soft four-unit edge keeps the transition unobtrusive; curved map-colored ink arcs and small comic impact accents and flat rebounding ground dents give the effect a cartoon response without changing collision or movement. Ground paint, local grass/stone/sand textures, and Harbor water respond through map-owned uniforms; remote scenery remains intact. Reduced motion keeps the transformed head and pearl finish but holds the terrain static and removes orbiting smoke and lettering drift. Form intensity rises over the first 0.25 seconds and recedes over the final 0.35 seconds of the existing timer; appearance restores immediately when simulation ends the form.

The VFX pass gives Fox Rush pointed fox-flare strokes and path-following warm trails; Ki Cannon a compressing muzzle core, locked narrow cue, fixed-radius bolt and directional impact; Elastic Twist side ribbons and a snap accent; and Infinity Veil a transparent 12-unit boundary with fine ripples and violet arcs. Form meshes use one cached, instanced geometry per silhouette. The new `RenderAnchor` view follows the head's displayed pose, so cosmetic fists, ears, and muzzle cues do not drift ahead of collisions. Spirit Bomb now rises into view during the early camera blend and uses one flowing blue-white shader surface instead of the two patch-overlay pools, with a narrower descent wake and opening cloud dome. Hollow Purple uses contrasting orbital filaments, jagged rupture sheets, a smaller post-impact core, and a brief dark cavity. Existing 5.6-second cinematic duration, 3.4-second elimination moment, later camera paths, SFX/voice settings, and gameplay effects remain unchanged. No music, bloom, reflection pass, or new shadow-casting light was added.

The E effects use at most six shared draw objects, below the 8 desktop / 6 mobile budget; bot-only decoration is trimmed when the arena is crowded while projectile cores remain visible. Form effects use twelve pooled draw objects, below the 24 / 16 budgets. Reduced motion removes decorative trails, rapid orbiting, and tail sway while preserving essential attack cores, aim, field boundaries, transformed heads, and static comic styling. Map switching owns only map assets; cached character and skill geometry survives it. Each new effect has bounded buffers and idempotent disposal.

Validation: **203 tests passed** and `npm run build` succeeded. Tests cover transformation mechanics, separately cached form models/outlines, temporary cosmetic finish definitions, the 24-unit influence falloff, impact pooling, cinematic staging, rendered-head anchoring, fixed projectile core radius, reduced motion, pause, and resource disposal. Current environment-only counts are Shibuya **19 calls / 16,288 triangles** desktop (**19 / 13,986** mobile), Hidden Leaf **45 / 24,132** (**45 / 16,324**), Tournament **47 / 70,224** (**47 / 30,496**), and Harbor **71 / 29,786** (**71 / 20,218**); all are below their respective budgets. A 40-switch browser cycle returned exactly to its warm menu resource counts: Shibuya **84 geometries / 5 textures / 22 programs**, Leaf **95 / 10 / 30**, Tournament **92 / 6 / 26**, and Harbor **115 / 9 / 30**. A warm Tournament normal-play browser sample of 300 frames gave **7.8 ms median / 13.7 ms p95**, **153 median draw calls**, and **271,800 median triangles**, with at least 20 living snakes; bot turnover prevents a controlled 21-snake comparison. The local browser visually confirmed Kitsu and Pomu transformations and no shader/audio console errors. A matched-population transformation timing sample, physical-phone touch/feel, and exhaustive map/edge combinations remain manual checks. The local preview and source archive are refreshed; website deployment remains outside this release.

## v1.4.1 — Arena-Scale Spectacle

All four player V abilities now use a **5.6-second cinematic** with a **3.4-second impact**, a **30-second cooldown beginning at activation**, credited eliminations, energy drops, and the existing delayed respawns. Kitsu's Fox Spirit Bomb summons a larger, more detailed fox with a mouth-charged orb and fiery arena pressure fronts. Kairo's overhead Spirit Bomb is larger, with a clearer luminous surface, shadow, descent, and cloud impact. Its charge orb and gathering ribbons now stay centered above Kairo before following the captured impact path, including when he activates near the arena edge. Shiro's Hollow Purple has larger red/blue convergence, a dense merged core, jagged sheets, and a dark rupture. Pomu's new **Skybreaker Slam** replaces the former playable eight-second barrage: he transforms, winds up a giant sculpted fist, then strikes the arena with smoke, stars, rubber waves, and **ドン！** lettering. Only Hollow Purple pulls rivals; the other cinematics hold them in place. Pomu's old automated punch projectiles and form collision protection are gone. The earlier v1.4.0 transformation description above is retained as release history and is superseded by this section.

E-skill decoration is larger and more character-specific while Fox Rush speed, Ki Cannon's projectile and hit radius, Elastic Twist timing, and Infinity Veil's 12-unit gameplay field stay unchanged. The four cinematics use separate cached renderers and a shared authoritative stage timeline. Pomu's 24-unit nearby cartoon distortion affects map textures and flat overlays only; it never changes collision. Camera framing scales for short and phone-sized windows, and recovery returns to the gameplay view. Reduced motion retains large readable attack silhouettes while limiting movement, flashes, and distortion. Effects audio adds layered charge, throw, release, and impact tones; the Japanese voice assets remain, and there is no music. Pausing or hiding the tab freezes the timeline, and completion, death, restart, quit, or match end clears transient visuals and sound.

Validation: **205 tests passed** and the production build succeeded. Cinematic tests cover activation, stage boundaries, impact timing, cooldown rejection, stationary/Purple-pulled rivals, single-credit kills, drops, three-second respawns, pause, Sprint expiry, reduced motion, and cleanup; existing E-skill regressions remain green. Browser review inspected all four anticipation silhouettes at desktop and 390 × 844, plus Pomu's impact and reduced-motion state. A controlled Harbor rendering sample with 21 snakes over 300 frames gave **6.9 ms median / 7.1 ms p95, 151 median draw calls, 211,916 triangles** in normal play; **6.9 / 7.2 ms, 267 calls, 273,072 triangles** during Skybreaker charge; and **6.9 / 7.1 ms, 67 calls, 68,308 triangles** after the wipe with one snake. The camera reveals different scenery in each phase, so total draw-call changes do not isolate the effect renderer. A 40-map-switch review returned every map's geometry, texture, and program counts to its warm values. These are local browser observations, not physical-phone GPU or touch measurements. Extended edge activation and repeated live-match feel remain useful manual checks. The local preview and source archive are refreshed; Git publishing and website deployment are excluded.

## v1.4.2 — Fox Spirit Bomb Polish

Kitsu's fox summon keeps its existing size. Its mouth-charged bomb grows to a more dominant scale, moves forward as it expands so the fox's face remains visible, and has a brighter animated core and rim. The launched bomb has a longer wake. After impact, the existing pooled shell becomes a translucent fire dome while wider flame fronts, thicker pressure rings, and embers spread from the captured impact position. The camera eases toward the strike during detonation. Reduced motion keeps a restrained static dome and pressure marks. No gameplay timing, hitboxes, scoring, cooldowns, or new draw objects were changed.

Validation: **206 tests passed** and `npm run build` succeeded. The added renderer test checks that the bomb grows independently of the fox and that the aftermath reuses the bounded shell and rings. The charge and post-impact effects were reviewed in the local desktop preview; physical-phone appearance remains a manual check. The preview and source archive were refreshed. Git publishing and website deployment remain outside this patch.
