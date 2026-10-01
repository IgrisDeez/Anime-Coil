# Kitsu anime-reference candidate

Latest supplied Naruto front image supersedes the earlier chibi brief. This candidate is staged for visual review, not integrated into the game. The front reference crops the crown and has no side or rear views; hidden geometry is inferred, not an exact reconstruction.

Changes: authored angular temple/cheek/jaw contours; shallow almond blue eyes with round pupils; angled brows and subtle frown; slender folded ears; narrow nose; three thin whisker lines per cheek; connected scalp with shaped, directional crown/side/rear spikes; fitted navy headband with curved Leaf plate and six rivets. No collar or body costume was added.

The editable master contains the candidate scene, separate authored meshes, hidden optimized copies, studio lighting, camera, and a hidden coil fit study. Existing objects/scenes were preserved in the live Blender session. Game assets and source behavior were not replaced. The original coil origin, dimensions and 0.12 Y mount are retained. The studio fit study confirms slight overlap at the chin; final menu/game camera fit still requires integration review.

| Profile | Head asset triangles | Including existing coil | Draws including coil |
|---|---:|---:|---:|
| Desktop | 5,134 | 5,486 | 12 |
| Mobile | 3,535 | 3,887 | 12 |

The existing outline would add one draw. GLBs use Y up, +Z forward, applied mesh transforms, eleven material batches, no cameras/lights/skeletons/animations, finite unit normals, and no zero-area triangles. Mesh clones share geometry/materials and have independent eye transforms. See candidate-validation.json for measured bounds and eye depth.

Before integration, update the game's palette to include Iris, eye pivot to 1.57 Y with four child batches, and bounds check for the slimmer 2.3114-unit hair width. Preserve the existing synchronous creation, cached preload, fallback, outline, cinematic restoration, and disposal contracts. Staging these exports does not validate those game paths. Map/UI/phone/crowd/cinematic and CPU comparisons have not been run for this candidate.

The current checkout's package version is 1.7.0 and includes other local work. It was preserved; this visual candidate does not perform a release/version downgrade or refresh the game's preview/archive.

Render files are actual Blender EEVEE outputs without painted or generated corrections. four-view-renders.jpg shows the editable sculpt; optimized-comparison.jpg shows evaluated export copies; coil-fit-preview.jpg is a studio study, not an in-game screenshot.

Validation on 2026-10-01: staged export validator passed; npm test passed all 332 tests; npm run build passed with the existing Three.js chunk-size warning. git diff --check reports existing trailing whitespace in src/main.ts:1146, which this asset-only correction did not change. No authoritative game state or game source was changed by this candidate work.
