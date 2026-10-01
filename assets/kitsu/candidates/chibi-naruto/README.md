## Approved integration update

The user approved this candidate for integration and GPT Sites deployment. The live game is now v1.7.2, preserving concurrent local UI changes. Active editable source: `assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend`; public GLBs contain 11 batches and four eye batches. Desktop/mobile totals including the coil: 5,859 / 3,949 triangles. See `docs/KITSU-CHIBI-1.7.2.md`. The notes below describe the earlier review or asset state and are retained as history.

# Kitsu: Balanced Chibi Naruto review candidate

This is a separate visual review asset. The game still uses its existing Kitsu head. No candidate GLB has been copied into `public/assets`, and no head loader, character ID, simulation, cosmetic, transformed head or fox summon was changed by this sculpt work.

The editable `Kitsu_Chibi_Naruto` collection is in `kitsu-chibi-naruto.blend`, active scene `Kitsu_Chibi_Naruto_Review`. Previous candidate scenes are preserved in this new file; their original saved files remain unchanged. Studio comparison/export collections are hidden by default. The game-space mount and pivot are authored through a Blender Z-up conversion, and the GLBs export Y-up with +Z forward.

The exposed face is 0.96 units high instead of the mature candidate's 1.20, a 20% reduction. Soft cheeks, flattened temples and a small tapered chin replace the angular jaw and long nose bridge. Eyes measure about 0.44 by 0.339, centered at +/-0.36 X around the existing 1.28 Y blink pivot. Blue irises, small pupils, restrained glints, gently angled blond brows and a tiny frown give cute determination. Recessed ears are 0.34 high; three short shallow marks follow each cheek. Hair has a continuous scalp with 15 individually bent locks and a coherent nape. The fitted band has a compact Leaf plate, six rivets, rear knot and two ties.

| Profile | Asset triangles | With existing 352-triangle coil | Head draws with coil | GLB bytes |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 5,507 | 5,859 / 6,000 | 12 | 124,944 |
| Mobile | 3,597 | 3,949 / 4,000 | 12 | 90,292 |

Both profiles retain all authored hair-tip and fitted cloth vertices. Reduction concentrates on face and small details. Eleven single-material meshes include four eye batches (whites, pupils plus closing upper-eye accent, iris, highlights), each sharing immutable geometry/material data when cloned. The editable master has 9,093 triangles and separate sculpt pieces; runtime budgets apply to the evaluated GLBs. An existing silhouette outline would add one draw after integration.

`candidate-validation.json` records schema, origin/mount, blink pivot, finite positions and unit normals, nondegenerate triangles, transforms, bounds, eye dimensions/depth, resource sharing and independent-clone checks. Asset bounds are approximately X +/-1.22, Y 0.74-2.78, Z -1.081 to +0.862. The unchanged coil's top is 0.80 Y, giving about 0.06 units of intentional contact overlap with the chin at 0.74. The coil/roster renders check actual original dimensions at matching scale. The exposed face and features are bilaterally balanced; swept hair deliberately varies direction.

All PNGs are actual Blender renders. JPEG sheets only compose and scale these renders and the supplied references; they do not paint over the model. `reference-comparison.jpg` compares the previous mature head and new chibi using matching studio camera/lights/scale, beside the latest identity image. `four-view-reference-comparison.jpg` shows the original softness/depth reference. Side and rear Naruto anatomy remain an interpretation of the available references.

The final exports and all four angles were inspected for band/skin breakthrough, scalp/lock joins, eye seating, face balance and rear silhouette. A rendered blink study exposed a stationary upper-eye accent; it now moves with the pupil batch. These studio renders do not establish gameplay readability under every map light or the final game outline.

## Local verification and version boundary

The existing game suite passes: **335 tests, zero failures**. `npm run build` passes, with the existing Three.js chunk-size warning. `git diff --check` passes. The game source and live assets were not edited by this candidate work. A protected-file audit records unrelated concurrent source/version edits separately; do not revert those edits.

The candidate keeps the review metadata `1.7.0-chibi-review`. During this work, other local changes advanced the actual app package to **1.7.1**; those changes were preserved. This is not a head-integration release and does not downgrade any local work. The distinct review and source ZIPs do not overwrite release archives.

## Approval before integration

Review the front, three-quarter, side and back renders and the attachment study before replacing the game head. After approval, add the Iris palette entry and change the live eye schema from three to four batches while retaining the 1.28 pivot, mount, synchronous creation, cached selected-profile preload, fallback, shared resources and lifecycle/cinematic restoration. Do not copy the candidates into the live asset folder before that change: the current validator deliberately accepts the existing ten-batch asset schema.

Menu/portrait/gameplay screenshots, all-four-map and desktop/phone-width review, dark/light UI, crowds, large snakes, reduced motion, Fox Rush and lifecycle/cinematic recovery of **this candidate** await approval and integration. No matched 21-snake before/after CPU median/p95, actual scene resources or rendering draw-count regression is claimed here. Existing automated cache/fallback/profile/lifecycle tests pass for the currently integrated head; candidate asset tests run separately. Physical-phone review has not been performed.

The setup-owned Blender MCP localhost connection is stopped after final delivery preparation. Nothing is published or deployed.
