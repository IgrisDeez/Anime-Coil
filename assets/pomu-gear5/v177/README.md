# Pomu Gear 5 head and Haki fist — 1.7.7

`pomu-gear5-editable.blend` is the editable Blender master. The `Pomu_Gear5` scene keeps desktop/mobile head and fist collections separate from the approved normal roster. Review cameras, studio lighting and the coil study are excluded from exports. The task-owned Blender MCP connection was stopped after saving.

The head uses the approved Pomu anatomy with fourteen shaped white hair curls, a cloud scarf, spiral brows, embedded eyes and a broad grin. The dark fist has a coherent closed palm, readable knuckles, folded fingers, thumb and wrist; its union and simplification were applied before export. Both use restrained diffuse, vertex-painted shading.

| Export | Head including retained 352-triangle coil | Fist | Head draws including coil | Fist draws including outline |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 5,644 | 2,444 | 7 | 3 |
| Mobile | 3,812 | 1,544 | 7 | 3 |

`pomu-ultimate-desktop.glb` and `pomu-ultimate-mobile.glb` contain the head and fist in one selected-profile download. The runtime adds the original coil and a single head silhouette outline. Six head batches and two fist batches share immutable geometry; head expression/blink transforms remain independent. The closed outward-facing fist uses front-face culling with a separate restrained contour draw. Shared materials are disposed only at application teardown.

Coordinates are Y up and +Z forward. The head retains the 0.12 Y mount and the 1.28 Y eye pivot. `PomuHakiFist` has a normalized wrist anchor for object posing; the arm is a fixed prebuilt mesh deformed by shader uniforms. No skeleton or per-frame vertex edits are used.

`scripts/blender/pomu_gear5.py` is the Blender MCP authoring source. `renders/` contains actual front, three-quarter, side, rear and attachment renders, plus all four fist views. The cinematic's bounce, ballooning, eye-pop, punch, rubber street and flattened recovery are Three.js presentation transforms. See [the release report](../../../docs/LIVING-SHIBUYA-1.7.7.md) and [complete recording](../../../docs/living-shibuya-1.7.7/cinematic/desktop-gear5-complete.webm).
