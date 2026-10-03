# Anime Coil - Hair detail candidates

The four normal heads now have individually swept locks, thinner tapered ends,
small overlapping layers, and painted directional hair grain. This is a local
visual review alongside the pending 1.7.6 ultimate VFX candidate. The package
version remains 1.7.5 and the existing public Site remains unchanged.

- Kitsu: 27 gold locks, a cleaner crown and fringe, and continuous rear coverage.
  The approved face, blue eyes, blond brows and headband are retained.
- Kairo: 25 black locks with a swept crown, smaller interleaved layers and a
  tapered fringe. The existing determined face and blue eyes are retained.
- Pomu: 25 dark locks shaped under the existing straw hat. Finer fringe and
  connected nape coverage retain the cheerful face, scar and hat silhouette.
- Shiro: 25 white locks with softer ridges, a layered fringe and pale lavender
  grain. The fitted blindfold, smile and collar are retained.

Actual Blender renders use identical neutral lighting and camera framing for
before/after. Both profiles have front, three-quarter, side and back views, plus
desktop matching-scale coil studies. The prior candidates and unrelated default
Blender scene were retained. Authored through Blender MCP 5.2.2 LTS, with safe
mode enabled. The setup-owned localhost connection and Blender process were
stopped after saving. No library links, downloads or generated substitute models
were used.

## Assets and runtime review

Each character has an editable `.blend`, two GLBs, two PNG diffuse atlases and
actual renders in `assets/roster/hair-review/<character>/`. Named vertex groups
select each individual lock, the fitted scalp and Kitsu's retained blond brows.
Textures are packed in the editable model and GLB. The desktop map is 512 square;
mobile is 256 square. Eight painted swatches vary root shading and brush streaks.
The detail follows each lock's root-to-tip HairFlow UVs; there are no strand meshes,
normal maps, added glow passes, real-time reflections or skeletons.

| Character | Desktop triangles with coil | Mobile triangles with coil | Head draws with coil |
| --- | ---: | ---: | ---: |
| Kitsu | 5,951 | 3,933 | 12 |
| Kairo | 4,794 | 3,058 | 10 |
| Pomu | 5,985 | 3,749 | 12 |
| Shiro | 4,420 | 2,874 | 7 |

One restrained outline draw is separate. The revised review outline excludes
exposed root caps and clump seams; it is cached once per profile. The original
352-triangle coil is appended by the existing factory and is excluded from the
GLB. Origin, Y up / +Z forward, 0.12 Y mount and 1.28 Y blink pivot are preserved.
Tests compare all non-hair triangles with the previous exports, including eye,
face, accessory and collar geometry.

`src/hair-review-assets.ts` wraps the working Kitsu and roster caches only for
review. Profile maps, materials and meshes are shared across clones. Eye
transforms remain independent. Missing/malformed assets use the current head.
Shared resources are disposed once on review teardown, never per snake or map.
The extra diffuse maps cost four texture resources per loaded profile, about
5.33 MiB desktop / 1.33 MiB mobile with RGBA8 mipmaps. The before/after fixture
keeps both sets loaded, so its renderer resource counters are not an estimate of
the final application memory increase. No production factory or approved asset
was replaced.

Open `http://127.0.0.1:4175/tests/hair-review.html` for staged menu coils,
portraits, gameplay, before/after, profiles, reduced motion and large crowds.
The production local preview and previously completed ultimate VFX work are
preserved. Promotion and publication follow the requested visual review gate.

## Verification

- 332/332 `npm test` tests passed, including three new textured-asset tests.
- `npm run build` passed; existing Three.js chunk-size advisory remains.
- `git diff --check` passed. Selected-profile image dimensions and packed PNGs
  were checked, along with geometry, normals, UVs, bounds, orientation and budgets.
- Real Edge/WebGL desktop 1440x900 and phone-width 390x844 captures cover all four
  characters in menu, portrait and gameplay, large same-character crowds, and
  reduced motion. Cache loads, decoded pixels, independent blinks, failed-load
  fallback and profile switching were verified. Profile switching preserved the
  held cinematic time; recovery, death, respawn, restart and quit restored the
  normal heads. No browser errors occurred.
- SHA-256 checks preserve the simulation, production factories, approved Kitsu
  cache and GLBs, and approved Kurama cache and GLBs. See
  `hair-review/preserved-production.json`.
- Matched 21-snake performance samples use both old Blender candidates and the
  revised hair, with the approved Kitsu head as its baseline. Same paused state,
  mass 48, food 850, camera, visual time and ABBA order. Both paths include the
  review fixture's second render. Counts, resources, CPU median/p95 and all raw
  samples are in `hair-review/performance-final-clean/`. Crowds measured at most
  +4.9% median / +6.3% p95 desktop. Mixed phone width measured +0.8% median with
  unchanged p95. A larger initial desktop mixed p95 spike did not repeat in a
  longer window. Earlier and interrupted samples remain labeled and retained;
  `hair-review/performance-findings.md` documents the variance and scope.

Visual approval and physical-phone/sustained performance review remain pending.
Side and rear hair anatomy are inferred from the supplied style references.
