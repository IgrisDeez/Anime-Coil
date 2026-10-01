## Approved integration update

The user approved this candidate for integration and GPT Sites deployment. The live game is now v1.7.2, preserving concurrent local UI changes. Active editable source: `assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend`; public GLBs contain 11 batches and four eye batches. Desktop/mobile totals including the coil: 5,859 / 3,949 triangles. See `docs/KITSU-CHIBI-1.7.2.md`. The notes below describe the earlier review or asset state and are retained as history.

# Kitsu head asset — Anime Coil 1.6.9

`kitsu-head-master.blend` is the editable master. Open scene `Kitsu_Reference_Studio_169`; collection `Kitsu_169_Editable_Master` contains individual named facial, hair, band, ear and ribbon meshes. The original default scene and its cube/camera/light are preserved. Hidden `Kitsu_169_Export_desktop` and `Kitsu_169_Export_mobile` contain the optimized batches. The studio camera/lights are excluded from GLB exports.

The supplied four-view reference is preserved in `reference-four-view.png`. `four-view-comparison.png` compares it with neutral Blender studio renders. `in-game-review-sheet.png` shows representative local game review. Individual master/profile PNGs are retained for closer inspection.

Game-ready files: `../../public/assets/kitsu/kitsu-head-desktop.glb` (5,341 triangles) and `kitsu-head-mobile.glb` (3,620 triangles). Both have ten meshes/material batches, an identity root, +Y up, +Z forward, and `EyesPivot_<profile>` at Y=1.28. The game adds its retained 352-triangle coil attachment and one restrained outline draw. Total normal-head triangles including the attachment are 5,693 desktop / 3,972 mobile, before the outline.

The fixed shapes use custom meshes and deliberately shaped swept hair sections. Facial tessellation is regenerated per profile to preserve rounded eyes and recessed ears; generic uniform face decimation was rejected during render review. Hair and cloth are reduced separately. No skeleton, animation clips, textures, emission, reflection passes or runtime modifiers are exported.

Authoring scripts are under `../../scripts/blender/`. The live Blender work was performed through MCP, using separate collections and scene. `correct_fit.py` and `profile_features.py` must run before `export_kitsu.py` in the same Python namespace. Exports replace only the two specifically named generated export collections. The saved `.blend` is the authoritative editable model; authoring scripts document construction and refinement rather than requiring regeneration to edit the asset. Keep Blender MCP safe mode enabled; send file contents through MCP instead of using exec/open inside Blender.

The setup script starts the installed localhost addon only when required. Its connection was stopped after delivery preparation; no listener remains on port 9876. Open the master normally to edit it.

The four-view source is interpreted as a friendly stylized chibi head, with simplified facets for the game budgets. There has been no physical-phone review. See `../../docs/KITSU-1.6.9.md` for integration, performance evidence and limitations.

Correction: the identity asset root retains the coil origin; a named internal mount lifts the sculpt 0.12. Facial surfaces follow the skull and both export budgets include the retained 352-triangle coil. The prior model and image are retained for comparison.
