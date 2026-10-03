# Living Shibuya city kit — 1.7.7

`living-shibuya-editable.blend` is the editable Blender master. Its `Living_Shibuya` scene contains separate desktop/mobile kit collections and review-only cameras and lighting. Unrelated scene objects and previous asset files were preserved. The task-owned Blender MCP connection was stopped after saving.

The six families are Rounded, Glass, Shop, Terrace, Station and Arcade. Each uses a vertex-painted Stone batch and Windows batch; Meeting and Furniture add the small original seated dog, plinth, benches and coordinated props. The kit is navy architecture with warm interiors and cyan/magenta accents, without reflective or emissive render passes.

| Export | Prototype triangles | Mesh batches | File |
| --- | ---: | ---: | --- |
| Desktop | 4,800 | 14 | `city-kit-desktop.glb` |
| Mobile | 3,728 | 14 | `city-kit-mobile.glb` |

The GLBs contain kit prototypes, not the assembled arena. They have applied mesh transforms, finite outward normals, vertex colors and Y-up coordinates. Runtime placement, the shared original sign atlas, roads, puddles, traffic, weather and shader animation are built in Three.js. Raised structures remain outside the unchanged playfield radius plus a six-unit clearance margin. Both profiles combine compatible surfaces within each of four districts; shared cached prototypes remain immutable.

`scripts/blender/living_shibuya.py` is the authoring source for Blender MCP. `scripts/blender/living_review.py` assembles the actual Blender review scenes. `renders/city-kit-overview.png` shows the prototype gallery; the front, three-quarter, side and rear files show an assembled kit. Runtime has additional sign art, city life and rain. See [release validation](../../../docs/LIVING-SHIBUYA-1.7.7.md).
