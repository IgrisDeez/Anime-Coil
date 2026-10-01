# v1.7.0 — Moonlit Arena

The interface now uses midnight navy, lavender, icy blue and reserved gold highlights, with a coordinated pale lavender light theme. Inter and Rajdhani ship locally under their bundled OFL licenses. Existing saved light/dark choices are honored; missing or inaccessible theme storage defaults to dark.

The desktop lobby contains a named four-character roster, a central three-quarter 3D showcase and a 320px match panel. Below 760px it stacks into a scrolling layout with safe-area spacing and 44px controls. A cached showcase rectangle positions the camera on resize, selection, font readiness and scrolling; no new per-frame DOM measurement or animation loop is introduced. Short desktop windows scroll to keep match controls available.

Lobby staging reuses the three existing lights. Ambient, key and lavender rim lighting change only on map/mode transitions. Scenery is placed behind the character during presentation; its scale, placement, rotation and map lighting restore for gameplay. The former halo draw is reused as a display platform. No additional lights, postprocessing, render passes or simulation changes are introduced.

The HUD, settings, help, challenges, cosmetics, credits, pause, results, loading feedback and WebGL error surface share the new tokens. Results prioritize score, survival, eliminations, records and earned progress. Ability labels and countdowns remain explicit. Touch handedness and size presets, keyboard bindings, reduced motion/flashes, bounty feedback, practice, respawn and all cinematics remain compatible. Existing DOM IDs, selection attributes, character assets, saved progression and gameplay contracts are retained. Prior uncommitted Kitsu/performance changes were preserved.

## Validation

- `npm test`: **332 passing, 0 failing**, including four focused Moonlit tests for theme defaults/storage errors, repeated lighting restoration on every map, staging cache invalidation and stable UI selection hooks.
- `npm run build`: passes TypeScript and Vite production compilation. The existing advisory about the shared Three.js chunk exceeding 500kB remains.
- `git diff --check`: passes.
- In-app browser visual review: all four characters and maps in dark/light at 1440×900, 960×600 and 390×844; additional 320×640 menu/settings/credits and 640×390 touch HUD checks. Desktop short-window layouts intentionally scroll. No horizontal overflow was observed.
- Interaction review: character/map selection, Endless/Sprint/Bounty, locked cosmetics preview and return, settings sections and theme persistence, guided practice, pause/resume, recap, restart/quit, respawn countdown and return, and all four ultimate recoveries. Development fixtures advanced each ultimate to inspect active/recovery states and confirmed normal heads and gameplay projection were restored.
- Keyboard Enter activates controls; visible focus, reduced-motion and reduced-flash preferences were reviewed. Both touch handedness layouts and large controls were checked. Phone minimap placement was adjusted after finding an overlap with the pause/settings controls.
- Loading and WebGL fallback surfaces were visually inspected at 320px using temporary DOM visibility fixtures; an actual GPU context loss was not induced. Visible lobby buttons met the 44px minimum at that width.
- Core text/surface token pairs exceed 4.5:1 contrast in both themes, including muted text, Play and gold readiness labels; [ratios](moonlit-review/contrast.json). Final browser logs reported no warnings or errors.

Representative captures, layout checks and rendering samples are in [moonlit-review](moonlit-review/). Viewport emulation is not physical-phone touch validation; sustained play and long-duration GPU measurements are outside this review.

## Lobby rendering comparison

Short hardware-browser samples used Kitsu/Shibuya, desktop profile, 1280×720 at DPR 1. CPU/RAF summaries contain 120 frames. The finished sample followed 120 warmup frames; the earlier sample had a different warmup history, so this is an observational comparison rather than a controlled isolated benchmark. GPU results contain only three asynchronous queries and are insufficient for a reliable GPU conclusion.

| Lobby measurement | Before | v1.7.0 |
| --- | ---: | ---: |
| Submitted calls | 76 | 87 |
| Submitted triangles | 95,326 | 113,882 |
| CPU submission median / p95, ms | 1.8 / 3.1 | 2.0 / 3.7 |
| RAF interval median / p95, ms | 6.9 / 8.4 | 7.0 / 7.7 |
| GPU-uploaded geometries / programs / textures | 78 / 26 / 5 | 82 / 27 / 5 |

The lower, broader view exposes more background scenery: +11 calls and +18,556 triangles, with a +0.2ms median / +0.6ms p95 CPU submission change in these samples. This is a visual framing tradeoff, not a performance improvement claim. Reused lights and the existing presentation clock keep lighting updates bounded. Raw snapshots: [before](moonlit-review/performance-before.json), [after](moonlit-review/performance-after.json).

Package, lockfile, title, metadata, lobby and credits show **v1.7.0**. Local preview: http://127.0.0.1:4175/. No publishing or deployment was performed.
