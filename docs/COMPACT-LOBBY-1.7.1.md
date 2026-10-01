# v1.7.1 — Closer Map-Centered Lobby

The prior 920×668 lobby had 826px of content and required scrolling to reach Play. Its character occupied a detached platform while map scenery was shifted 65 units behind it. The revised lobby fits the screen and grounds the character at the arena center with recognizable map scenery surrounding it.

## Presentation and layout

- The lobby uses a 28° three-quarter view with azimuth derived from the selected map's preview. A 55° vertical lens permits a closer camera and more surrounding scenery; normal gameplay returns to its original 43° base lens and boost behavior.
- Cached character vertices fit the complete head and coil into roughly 80% of available width and 70% of available height, with room for existing idle and selection motion. Fitting uses actual geometry rather than empty global-box corners. Geometry support points are cached; framing and DOM measurements run on selection/layout changes rather than every frame.
- The platform and backdrop offset are removed. Environment scale keeps the eye inside the clear arena interior; each map's unmodified geometry remains centered at the origin. Existing lights, presentation timing and a single render pass are reused. Gameplay restores map scale, position, rotation, lighting and projection.
- A viewport-height layout replaces the scrolling minimum heights. Desktop retains three columns; short windows use four map thumbnails in one row. Portrait phones show a horizontal character roster, flexible showcase and compact controls; short landscape uses columns. All visible menu controls retain at least 44px targets.
- Character ability names, descriptions, key bindings and cooldowns are available in the native **Details** dialog, which can scroll internally. Escape and Close restore focus to Details. Credits moved into Settings. On portrait phones, cosmetics preview temporarily replaces the match panel with additional showcase space; its dock is included in the framing calculation, and Back restores the normal menu.

Existing character/map/mode selection hooks, theme storage, controls, cosmetics, progression and gameplay rules remain compatible. Preexisting Kitsu and performance edits were preserved. Very small windows or enlarged accessibility text can still scroll rather than clip controls.

## Validation

- `npm test`: **335 passed, 0 failed**. Three new focused checks cover complete bounds fitting and camera clearance across aspect ratios, world-transform restoration, and transformed active-instance sampling without unused capacity inflating the fit. Existing theme and lighting tests remain passing.
- `npm run build`: TypeScript and Vite pass. The existing shared Three.js chunk-size advisory remains.
- `git diff --check`: passes.
- Every combination of four characters, four maps and both themes was checked at **1440×900, 920×668, 900×480, 640×390, 390×844 and 320×640**: **192 combinations**. Live DOM geometry showed no horizontal or vertical main-menu overflow; Play stayed visible, all character vertices remained inside the showcase, camera clearance held, and all menu buttons met the 44px minimum.
- Visual review covered map scenery, all characters, Details and cosmetics preview. Keyboard Enter, native Escape/Close and focus restoration were verified. Credits opens from Settings and returns to it. Locked skin preview/Back retains the equipped skin and restores the menu.
- On all four maps, match start and pause/resume confirmed original ambient/key/rim colors, `[1,1,1]` environment scale, zero position/rotation, disabled lobby view offset and the 43° gameplay lens. Returning to the lobby restores cinematic staging.
- Final browser logs reported no warnings or errors. Test gameplay records were restored after validation. Review used browser viewports, not a physical-phone session.

Screenshots, [layout measurements](compact-lobby-review/layout-checks.json), [gameplay restoration checks](compact-lobby-review/gameplay-restoration.json) and profiler snapshots are retained in [compact-lobby-review](compact-lobby-review/).

## Rendering comparison

Before/after samples used a freshly initialized Kitsu/Shibuya lobby at 1280×720, DPR 1, desktop profile, dark theme, with 120 warmup frames followed by 120 measured frames in the same in-app browser. The scene intentionally differs because framing and scenery placement changed. Short samples include normal scheduling noise and do not establish sustained FPS or device-wide performance.

| Measurement | v1.7.0 | v1.7.1 |
| --- | ---: | ---: |
| Submitted calls | 87 | 63 |
| Submitted triangles | 113,882 | 78,336 |
| Whole-frame CPU median / p95, ms | 1.9 / 3.0 | 2.0 / 3.2 |
| WebGL submission median / p95, ms | 1.5 / 2.4 | 1.4 / 2.3 |
| RAF interval median / p95, ms | 6.9 / 7.4 | 7.0 / 10.3 |
| GPU-uploaded geometries / programs / textures | 82 / 27 / 5 | 75 / 27 / 5 |

The centered view submits fewer visible batches and triangles, while the small CPU increase and noisier RAF tail prevent claiming an FPS improvement. No additional lights, render passes or continuous DOM updates were introduced. Raw snapshots: [before](compact-lobby-review/performance-before.json), [after](compact-lobby-review/performance-after.json).

Package/lockfile, title, lobby and credits show **v1.7.1**. Local preview: http://127.0.0.1:4175/. Publishing and deployment were excluded.
