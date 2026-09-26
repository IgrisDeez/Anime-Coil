# Anime Coil v1.3.10 — New Ways to Play
A complete solo browser arena built with TypeScript, Three.js, and Vite. Pick one of four original code-modeled anime-inspired chibi serpents and compete with 20 bots in Endless or a three-minute Sprint. Guided Practice is available from Help.


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
| Boost  | Hold Space or left mouse button | Hold BOOST         |
| Power  | E or right mouse button         | Tap ability button |
| Ultimate | V (Shiro or Kairo) | Tap ultimate button |
| Pause  | Escape or pause button          | Pause button       |

Collect energy to grow. Boost spends mass and sheds energy behind you, unless Fox Rush is active. Boost becomes unavailable at the minimum length. Your head touching a rival's body or the arena edge ends the match. Your own coil is safe. A head-on collision eliminates both spirits. Defeated bots drop energy and are replaced. Pause freezes all simulation; hiding the tab pauses automatically. Sprint has a three-minute active-match clock and ends early if you die; an ultimate in progress finishes before the timer ends the run.

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

- `src/simulation.ts`: renderer-independent 60 Hz simulation, typed match modes and authoritative Sprint deadline, spatial grids, bots, collision resolution, and abilities.
- `src/models.ts`: original chibi mesh construction with shared geometry/materials.
- `src/renderer.ts`: Three.js scene, smooth camera motion, instanced bodies and energy, cached black coil and chibi-head silhouettes, character portraits and preview. Heads and bodies render the same simulation frame to avoid early-looking hits.
- `src/skill-effects.ts`: four bounded instanced pools for charge cues, shots, impacts, trails and field accents; renderer-only, pause-aware and reduced-motion aware.
- `src/ability-feedback.ts`: ready, charging, active-duration, cooldown and unavailable HUD states.
- `src/main.ts`: menus, HUD, input, minimap, pause/restart, local best score and audio integration.
- `src/practice.ts`: presentation-only guidance for turning, pickups, boost and E; the practice arena runs without bots.
- `src/progression.ts`: versioned offline challenge progress, unlocks, cosmetic selection and defensive storage handling.
- `src/ui.ts` and `src/style.css`: cozy menus, accessible dialogs, compact HUD and responsive touch layout.
- `src/audio.ts` and `src/audio-settings.ts`: character-aware skill audio and saved effects/voice settings.
- `public/audio/`: six bundled Japanese callouts and voice attribution.
- `scripts/build_audio.py`: regenerate speech callouts; requires a local VOICEVOX Nemo engine.
- `tests/simulation.test.ts`: gameplay regression tests.

Energy score is ten times mass. Best score uses peak mass, so boosting does not erase an earned record. Physical length is capped at 360 segments per serpent and energy at 1,600 pickups to bound resource usage; score can keep growing. The screen pixel ratio is capped for performance. This is local solo play, with no accounts, server, telemetry, or online multiplayer.

Endless personal best retains its original localStorage key and behavior. Sprint has a separate best record shared across maps; equal peak-energy scores compare eliminations, then survival time. Challenges and equipped cosmetics use a separate versioned key. Map selection and sound preferences are saved when storage is available; play continues if it is disabled. Practice updates none of these records or challenges. Audio is optional. WebGL initialization/context loss shows recovery instructions. Fonts use Google Fonts with local fallbacks; gameplay and models do not depend on that network request.

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

Help opens **Guided Practice** using the selected character and map. It has no bots and walks through turning, collecting five orbs, holding Boost for a second, and activating E. Each step can be skipped, and **Leave practice** returns to the garden. Practice can be restarted after a boundary death; it never records a best score or advances challenges.

The **Challenges** button opens four fixed, offline lifetime goals. Progress is awarded only from eligible match simulation steps and confirmed player events; saved data is validated, and disabled storage never prevents play.

| Goal | Target | Reward |
| --- | ---: | --- |
| Spirit Gatherer | Collect 100 energy orbs | Sunset coil colors |
| Steady Spirit | Survive 10 total minutes | Moonlit coil colors |
| Coil Champion | Earn 10 credited eliminations | Petal Drift boost trail |
| World Sprinter | Finish a Sprint on each of the four maps | Starlight boost trail |

Unlocked colors and trails can be previewed and equipped from the same screen. The default cosmetics remain available. `anime-coil-progression-v1` stores bounded challenge counters, completed map IDs, and equipped choices. Cosmetics recolor only the player's instanced coil and boost trail; bot colors, hitboxes, movement, and scoring stay unchanged.

Rendering reduces fixed chibi-head draw objects by merging like-material parts while preserving animated eyes, Shiro's curved blindfold, details and head silhouettes. Per-head mesh counts are now 16/11/15/13 for Kitsu/Kairo/Pomu/Shiro, versus 40/33/29/33 before this pass. Each body sphere now has 132 triangles versus 168, and body instance colors upload only when growth, frozen state or equipped palette changes. Energy pickups already used one instanced eight-triangle octahedron draw, so they were left intact. Environment budgets and mobile/reduced-motion profiles are unchanged.

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
