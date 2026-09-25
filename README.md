# Anime Coil v1.2.1 — Spirit Compass & Living World Polish
A complete solo browser arena built with TypeScript, Three.js, and Vite. Pick one of four original code-modeled anime-inspired chibi serpents and compete with 20 bots.


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

## Controls

| Action | Desktop                         | Touch              |
| ------ | ------------------------------- | ------------------ |
| Steer  | Move mouse                      | Drag left joystick |
| Boost  | Hold Space or left mouse button | Hold BOOST         |
| Power  | E or right mouse button         | Tap ability button |
| Ultimate | V (Shiro or Kairo) | Tap ultimate button |
| Pause  | Escape or pause button          | Pause button       |

Collect energy to grow. Boost spends mass and sheds energy behind you, unless Fox Rush is active. Boost becomes unavailable at the minimum length. Your head touching a rival's body or the arena edge ends the match. Your own coil is safe. A head-on collision eliminates both spirits. Defeated bots drop energy and are replaced. Pause freezes all simulation; hiding the tab pauses automatically.

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

- `src/simulation.ts`: renderer-independent 60 Hz simulation, typed match state, spatial grids, bots, collision resolution, and abilities.
- `src/models.ts`: original chibi mesh construction with shared geometry/materials.
- `src/renderer.ts`: Three.js scene, smooth camera motion, instanced bodies and energy, cached black coil and chibi-head silhouettes, character portraits and preview. Heads and bodies render the same simulation frame to avoid early-looking hits.
- `src/skill-effects.ts`: four bounded instanced pools for charge cues, shots, impacts, trails and field accents; renderer-only, pause-aware and reduced-motion aware.
- `src/ability-feedback.ts`: ready, charging, active-duration, cooldown and unavailable HUD states.
- `src/main.ts`: menus, HUD, input, minimap, pause/restart, local best score and audio integration.
- `src/ui.ts` and `src/style.css`: cozy menus, accessible dialogs, compact HUD and responsive touch layout.
- `src/audio.ts` and `src/audio-settings.ts`: character-aware skill audio and saved effects/voice settings.
- `public/audio/`: six bundled Japanese callouts and voice attribution.
- `scripts/build_audio.py`: regenerate speech callouts; requires a local VOICEVOX Nemo engine.
- `tests/simulation.test.ts`: gameplay regression tests.

Energy score is ten times mass. Best score uses peak mass, so boosting does not erase an earned record. Physical length is capped at 360 segments per serpent and energy at 1,600 pickups to bound resource usage; score can keep growing. The screen pixel ratio is capped for performance. This is local solo play, with no accounts, server, telemetry, or online multiplayer.

Best scores, map selection and sound preferences are saved to localStorage when available; play continues if storage is disabled. Audio is optional. WebGL initialization/context loss shows recovery instructions. Fonts use Google Fonts with local fallbacks; gameplay and models do not depend on that network request.

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

Release checks passed: **115 tests, zero failures**, and the TypeScript/production build. Browser review covered all four map themes on desktop and a 390 × 844 phone viewport, character selection, normal play, ability feedback, both ultimates, frozen opponents, pause, results and repeated restarts. Both ultimates completed with their existing eliminations and bot recovery. The compass and touch controls remained separate in the phone layout. Live reduced-motion preview retained essential markers and ability cues while removing decorative motion; the OS preference listener also has automated coverage.

Changed files are the four presentation modules listed above; their integration in `src/main.ts`, `src/renderer.ts` and `src/skill-effects.ts`; shared reduced-motion handling in `src/spirit.ts` and `src/purple.ts`; `src/style.css` and `src/ui.ts`; existing world animation in `src/worlds/{architecture,atmosphere,builder,diagnostics,harbor}.ts`; `tests/presentation.test.ts`; package metadata and this documentation. `src/simulation.ts` is unchanged. Audio remains SFX and Japanese voices only.

Remaining manual checks: physical-phone touch and GPU performance, extended maximum-size-snake play, and exhaustive boundary/ultimate combinations on every map. Boundary thresholds and growing-head safety are covered by automated tests, but the short browser sessions are not a full visual or performance matrix. A later pass should use repeatable seeded benchmark runs on desktop and mobile hardware before tuning effects further.
