# Anime Coil 1.7.8 — Dense Shibuya and Haki Punch

Shibuya has a connected junction with paved corner landings, road-mouth crossings and aligned lane paint, surrounded by narrower lots and varied architecture. Pomu's giant punch now has a coherent closed fist, wrist-driven orientation and red Haki aftermath. The approved normal roster, textured hair, Gear 5 head, other finishers and authoritative simulation remain unchanged.

## Design and assets

The [official Tokyo district map](https://www.gotokyo.org/book/wp-content/uploads/2024/03/2403_shibuydaymap_low_EN.pdf) and [Shibuya guide](https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html) inform the station, Qfront, Magnet, 109, Center Gai and surrounding street identities. This is a stylized game interpretation retaining the circular collision arena. Side streets bend outward instead of radiating symmetrically. Crossings stop at paved landings, lane dashes stop behind crossings, and sidewalk geometry follows building fronts. Paved corners leave a real hole over the central asphalt to avoid drawing it twice.

Fourteen editable Blender families include commercial curves, glass towers, narrow shops, terraces, station/arcade fronts, landmark façades, balcony hotels, civic buildings, rooftop gardens and angled crowns. Thirteen are placed in the foreground. Desktop has 48 foreground, 48 middle and 64 rear buildings; mobile has 48, 32 and 48. Window frames, balconies, setbacks, shop bays and rooftop details share immutable prototype geometry and an atlas. Raised scenery remains beyond the original arena radius plus six-unit margin.

Store names remain stable. Fit lettering, neutral cream type, padding and one accent line replace dense glowing labels; a few shop columns use upright Japanese lettering. Large ads occupy designated façades rather than every building. Existing rain, fog, 64/20 pedestrians, 8/4 vehicles, traffic and billboard cadence are preserved, including pause and reduced motion.

Blender MCP inspected the live scene before authoring. Dedicated scenes and collections preserve unrelated objects and previous assets. Both masters include the final review setup; GLBs contain applied geometry with finite outward normals, vertex colors, Y up and +Z forward, without lights, cameras or skeletons. Only the task-owned connection was stopped.

- [Editable city](../assets/shibuya/v178/dense-shibuya-editable.blend), [city desktop](../assets/shibuya/v178/city-kit-desktop.glb), [city mobile](../assets/shibuya/v178/city-kit-mobile.glb).
- [Editable Pomu ultimate](../assets/pomu-gear5/v178/pomu-haki-editable.blend), [ultimate desktop](../assets/pomu-gear5/v178/pomu-ultimate-desktop.glb), [ultimate mobile](../assets/pomu-gear5/v178/pomu-ultimate-mobile.glb).
- [City four views](dense-shibuya-1.7.8/city-four-views.png), [fourteen-family kit views](dense-shibuya-1.7.8/kit-four-views.png), [road study](dense-shibuya-1.7.8/road-study.png), [fist four views](dense-shibuya-1.7.8/fist-four-views.png), [wrist and coil attachment](dense-shibuya-1.7.8/coil-attachment.png).
- [Matched game comparison](dense-shibuya-1.7.8/matched-comparison.png), [eight-stage punch sequence](dense-shibuya-1.7.8/haki-timeline.png), [phone review](dense-shibuya-1.7.8/phone-review.png), [complete desktop cinematic](dense-shibuya-1.7.8/cinematic/desktop-gear5-complete.webm), [phone cinematic](dense-shibuya-1.7.8/cinematic/phone-gear5-complete.webm).

## Punch alignment and red aftermath

The new closed hand has four readable knuckles, folded fingers, a thumb across the palm and a defined wrist. Creases are projected onto the sculpt rather than floating above it. Exported wrist, contact and strike-axis anchors drive the runtime transform. The knuckle contact follows a cubic trajectory and reaches the intended impact point at ground height; the hand and shader-deformed arm share a tangent, including eight tested headings and boundary casts.

The old fixed screen overlay drew a second fist and arm at a conflicting angle. It has been removed so the sculpt's perspective governs the punch. Recovery framing follows the retreating hand and expression. Charcoal skin, red-black lightning, pressure rings, red fragments and red fading smoke use a common Haki palette. The shared Pomu kill frame keeps its color instead of turning the red impact grayscale. Other finishers retain their palettes.

The original 5.6-second presentation and 3.4-second elimination threshold remain. The approved Gear 5 head retains its 0.12 Y coil mount and 1.28 Y expression pivot. Arm and rubber street geometry are created once; shader uniforms and object transforms animate them. Selected-profile preload, accessible feedback, cached subsequent loads, synchronous factories and procedural fallback remain. Profile changes preserve cinematic time and state; imported geometry and textures are disposed only by their owning cache at teardown.

| Geometry or environment | Desktop | Mobile | Limit |
| --- | ---: | ---: | --- |
| Fourteen city prototypes / mesh batches | 9,058 / 44 | 7,534 / 44 | Selected-profile prototype kit |
| Complete environment triangles | 90,386 | 58,556 | 150,000 / 75,000 |
| Complete environment draws | 73 | 73 | 120 / 80 |
| Environment materials / textures | 26 / 6 | 26 / 6 | 32 materials |
| Preserved Gear 5 head including coil | 5,644 | 3,812 | 6,000 / 4,000 |
| New hand triangles / draws with outline | 2,598 / 3 | 1,618 / 3 | Optimized static sculpt |
| Peak held Pomu draws including transformed head and outline | 18 | 16 | 24 / 16 |

## Validation and measurements

**345 tests pass**, production build succeeds and diff checks pass. The simulation regression suite and cooldown, elimination, respawn and collision behavior remain intact. Ninety-three real Edge browser cases cover desktop and phone widths, all normal characters and same-character crowds, large snakes, boundary casts, comfort settings, disabled cinematic camera, pause, load failure, profile caching and lifecycle restoration. The continuous recordings verify the actual wipe and approved normal-head restoration. Recordings are silent. Nineteen preserved source/asset files are compared with the 1.7.7 baseline using exact GLB bytes and canonical LF text hashes.

The frozen matched fixture retains 21 living snakes and 850 orbs without authoritative state changes. ABBA repeats advance real rendering and visual cadence; CPU excludes simulation and DOM. Tables average per-run medians/p95 values rather than pooling percentiles. Cinematic totals include each version's intended camera visibility. GPU measurements use optional asynchronous disjoint queries and fewer samples than CPU.

| Profile / stage | CPU median / p95 before → after (ms) | Median change | Draws | Triangles |
| --- | --- | ---: | ---: | ---: |
| desktop / normal | 8.70 / 14.35 → 8.45 / 15.25 | -2.9% | 82 → 82 | 110,605 → 92,985 |
| desktop / charge | 11.95 / 19.40 → 11.45 / 19.10 | -4.2% | 298 → 284 | 308,329 → 292,671 |
| desktop / impact | 12.70 / 16.95 → 12.10 / 16.65 | -4.7% | 301 → 265 | 319,659 → 271,117 |
| desktop / recovery | 11.50 / 16.50 → 12.75 / 17.95 | +10.9% | 296 → 319 | 307,858 → 326,862 |
| mobile / normal | 4.20 / 6.20 → 3.90 / 5.40 | -7.1% | 88 → 85 | 83,869 → 73,665 |
| mobile / charge | 4.45 / 7.05 → 4.25 / 6.50 | -4.5% | 198 → 199 | 158,386 → 153,182 |
| mobile / impact | 6.00 / 11.90 → 8.50 / 14.95 | +41.7% | 215 → 173 | 187,500 → 147,912 |
| mobile / recovery | 5.15 / 8.45 → 4.30 / 6.30 | -16.5% | 242 → 206 | 205,364 → 181,292 |

| Profile / stage | GPU median / p95 before → after (ms) | GPU queries | Geometry / texture / program resources |
| --- | --- | ---: | --- |
| desktop / normal | 4.810 / 5.595 → 4.676 / 5.732 | 28 / 26 | 72 / 6 / 35 → 73 / 7 / 33 |
| desktop / charge | 8.381 / 9.015 → 7.986 / 9.271 | 22 / 23 | 110 / 9 / 47 → 119 / 10 / 47 |
| desktop / impact | 8.456 / 10.504 → 8.005 / 9.789 | 24 / 23 | 114 / 9 / 47 → 121 / 10 / 47 |
| desktop / recovery | 7.224 / 9.358 → 7.993 / 10.693 | 25 / 23 | 113 / 9 / 47 → 128 / 10 / 47 |
| mobile / normal | 1.041 / 1.963 → 0.881 / 1.038 | 47 / 48 | 74 / 6 / 35 → 72 / 7 / 33 |
| mobile / charge | 2.527 / 3.824 → 2.158 / 3.285 | 44 / 46 | 102 / 9 / 46 → 108 / 10 / 46 |
| mobile / impact | 2.899 / 7.297 → 1.552 / 6.374 | 38 / 35 | 107 / 9 / 46 → 116 / 10 / 46 |
| mobile / recovery | 3.316 / 6.479 → 2.260 / 2.950 | 45 / 48 | 108 / 9 / 46 → 119 / 10 / 46 |

The initial sample exposed significant normal-view overhead. A longer repeat confirmed desktop CPU increased about 33% and GPU about 68%, while mobile CPU was close to baseline. The extra junction layer redrew the opaque central road. Replacing it with pavement geometry containing a junction hole and bypassing inactive ripple fragment math brought normal GPU submission close to baseline in the optimization repeat. Recovery framing also narrows as the arm retreats. Initial and investigation measurements remain in [the combined evidence](dense-shibuya-1.7.8/performance-comparison.json), with [final raw samples](dense-shibuya-1.7.8/performance-promoted/raw-abba.json). Final CPU median increases above 10%: desktop / recovery: CPU median +10.9%; mobile / impact: CPU median +41.7%. Timing variability, especially p95 and sparse GPU queries, is reported rather than treated as a guarantee across devices.

The mobile impact flag comes from two identical candidate runs at 4.1 and 12.9 ms CPU, both with approximately 1.55 ms GPU time. The longer six-second warmup / twelve-second ABBA follow-up measures 4.70 → 4.55 ms (-3.2%). The unchanged baseline also varied between 4.7 and 7.3 ms in the original pair. That CPU spike did not repeat; the impact uses fewer draws and triangles and lower measured GPU time.

The longer desktop recovery follow-up measures 11.50 → 12.30 ms (+7.0%). The new framing submits 319 rather than 296 draws in the intentionally retained 21-living-snake fixture: more normal heads and bodies remain visible around the fist. This is a measured scene-visibility cost, with the larger hand and full wrist/arm kept in frame. The actual live recording eliminates all twenty bots at impact, so its recovery workload differs from the held crowd stress fixture. These costs and the sparse GPU percentile variation remain disclosed; there is no claim of a universal performance improvement.

## Release

Version 1.7.8 updates package/lockfile, title, visible credits, documentation, source archive and local preview at http://127.0.0.1:4175/. Publication uses the existing [GitHub repository](https://github.com/IgrisDeez/Anime-Coil/tree/main) and existing public [GPT Site](https://animecoil.igrisdeez.chatgpt.site), preserving its audience. Private saved-state backups and setup credentials are excluded from copies and archives.

Phone-width review ran in Edge WebGL on this Windows computer. Physical-phone touch feel, battery use and sustained thermal performance remain untested. City layout and side/rear anatomy are stylized interpretations; the approved character models remain intact.
