# Kitsu reference rebuild — visual review candidate

Created through live Blender MCP in Blender 5.2.2 LTS. Awaiting the user's
four-view visual approval before game integration. Public game GLBs, gameplay,
character IDs, body cosmetics, cinematic effects, and the existing master are
unchanged. The original Blender scenes remain in the dedicated candidate file.

## Proportions and fit

- Eye width/height reduced approximately 22.5%; center spacing reduced from
  0.86 to 0.72 game units. Whites and pupils conform to the rounded skull;
  ray-tested white protrusion stays below 0.036 units in both exports.
- Ear width/height reduced approximately 31–32%, with thinner recessed interiors
  and roots tucked against the skull.
- Face width reduced approximately 8%; full skull depth increased approximately
  12%. Forehead, cheeks and rounded chin are a single mesh volume.
- Smaller mouth and nearly flush cheek marks; soft skin upper eyelids.
- Hair uses independently directed crown, front, side, profile and rear controls.
  Its envelope is approximately 12% narrower and 7% lower than the previous
  sculpt. Rear layers vary in width, sweep and length; nape follows the skull.
- Band height reduced from approximately 0.315 to 0.201 units. The curved
  silver plate is 0.76 × 0.231 units, preserving four rivets and diagonal emblem.
- Attachment origin is unchanged; sculpt mount is still +0.12 Y. The attachment
  study uses the exact existing SphereGeometry dimensions: scale (0.91,0.55,0.84),
  position (0,0.25,-0.18). The head overlaps this attachment without a gap.

## Files

- `kitsu-head-reference-rebuild.blend`: editable review sculpt, studio, original
  scenes, hidden optimized collections and hidden attachment study.
- `kitsu-head-desktop.glb`: 5,515 asset triangles; 5,867 including retained coil.
- `kitsu-head-mobile.glb`: 3,574 asset triangles; 3,926 including retained coil.
- Both GLBs: ten material batches, applied mesh transforms, Y up/+Z forward,
  independent eye pivot, no cameras/lights/animation/skeletons. Ten asset draws
  plus the existing coil draw; existing outline remains a separate draw.
- `four-view-renders.jpg`: front, three-quarter, true 90-degree side and back.
- `reference-comparison.jpg`: supplied reference against matched candidate views.
- `before-after.jpg`: previous and rebuilt sculpt under identical camera/lighting.
- `coil-fit-preview.jpg`: attachment study; not an in-game screenshot.
- `optimized-comparison.jpg`: desktop/mobile geometry inspection.
- Individual studio PNGs and `candidate-validation.json` are also supplied.

## Reproducible workflow

Execute `scripts/blender/rebuild_reference.py` through Blender MCP, then
`export_reference_candidate.py`, then `render_reference_candidate.py`.
The candidate exporter copies evaluated editable meshes instead of regenerating
their shapes. It samples the actual headband loops to preserve smooth edges.
It writes only this candidate directory, never `public/assets/kitsu`.

Run `npx tsx scripts/validate-kitsu-candidate.ts` to check the real game loader's
schema, orientation, finite unit normals, budgets, attachment, face embedding,
shared geometry/materials, independent blinking, caching and one-time disposal.
The deliberate load-failure warning is expected.

Validation on this candidate: asset checks passed; `npm test` passed all 328
existing tests; `npm run build` passed with the existing Three.js chunk-size
warning; `git diff --check` passed (existing CRLF conversion notices only).

## Review limits

Studio lighting uses Blender materials; game lighting uses the existing cached
game palette. In-game menu framing, four-map review, cinematic recovery, matched
21-snake performance samples, local release/archive refresh and physical-phone
review follow visual approval. Do not infer those results from this candidate.
The existing source version remains 1.6.9.
