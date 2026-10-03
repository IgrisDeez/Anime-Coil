# Roster polish — staged visual reviews

Current release: **1.7.5**; approved Kurama release **1.7.4**, Shibuya only. Each normal-head visual approval authorizes integrating and publishing that stage to the existing Anime Coil GPT Site, with its audience preserved. No GitHub publishing or new Site.

| Stage | Scope | State |
| --- | --- | --- |
| 1 | Kurama summon and tailed beast bomb | Approved; integrated in 1.7.4 |
| 2 | Kairo normal head | Blender candidates exported; awaiting visual approval |
| 3 | Pomu normal head | Blender candidates exported; review ready after Kairo |
| 4 | Shiro normal head | Blender candidates exported; review ready after Pomu |

Stage 1 was approved and integrated as **1.7.4**. Increment the current patch for each later release. Keep Kitsu's approved head, the 1.7.3 eye-clearance/skin-side fixes, all transformed heads, character IDs, cosmetics and authoritative gameplay.

## Stage 1 candidate

Editable model: `assets/kurama/candidates/chibi-review/kurama-chibi-master.blend`. Separate `Kurama_Chibi_Review` scene/collection; the original default scene remains. The master retains individual anatomical shapes, markings, linked tails, optimized profile collections and a hidden study containing exports of the current roster heads and original coil.

Reference direction: short torso, enlarged fox head, swept ears, forward muzzle, open lower jaw, two larger upper fangs, two smaller lower fangs and four incisors; broad paws and a crouch. Dark cheek/shoulder/chest/abdomen/limb markings follow the surfaces. Nine linked tapered flame tails form a varied fan; gold-to-orange vertex color avoids glossy plastic shading.

| Profile | Four body batches | One tail prototype | Nine tails + nine contours | Model total |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 8,519 | 500 | 9,000 | **17,519** |
| Mobile | 5,869 | 296 | 5,328 | **11,197** |

These totals include contour geometry, exclude the bomb and particles, and satisfy the 20,000/12,000 model budgets. A GLB contains four body meshes and one reusable tail prototype; all nine visible tails and contours use instance transforms. All mesh transforms are applied. Articulated head and paw pivots and a +Z muzzle anchor retain the `FoxSummonModel` contract. The actual draw audit is in `docs/kurama-review/captures.json`.

Approved runtime: `src/kurama-assets.ts` owns imported geometry and selected-profile load promises; instances own fade materials and transforms. `src/fox.ts` retains the existing `FoxStaging`, mouth clearance, ground clearance, flight helper and authoritative timing. Color-modulated diffuse shading keeps gold readable in Shibuya without brightening ink. Multisample coverage handles fading when the renderer supplies MSAA; stable alpha hashing is the fallback without MSAA. Neither requires another render pass.

The bomb has a purple-black core, slow violet channels, narrow violet/magenta rim, converging pooled energy and a compact violet wake. Impact reuses the existing shell, shockwaves, chakra fragments and smoke pools. Reduced motion freezes movement and limits impact opacity/counts. The main application's reduced-flash feedback and timing remain unchanged.

## Review locally

Run `npm run dev -- --port 4175 --strictPort`, then open `http://127.0.0.1:4175/tests/kurama-review.html`. The review page preloads one selected profile before constructing its renderer, shows accessible loading/failure feedback, and can compare the current fox with the candidate. It uses the current GameRenderer, Kitsu head and Shibuya environment. The main game now uses the approved cached sculpt. The review retains the frozen 1.7.3 procedural baseline.

Controls hold summon, charge, launch, impact, recovery and completion; switch graphics profiles; replay; show 21 Kitsu instances/large coils; reduced motion; camera disabled; boundary casts; and lifecycle cleanup. These are controlled rendering fixtures, not a claim of full physical-phone play testing.

Authoring scripts in `scripts/blender/` were executed through Blender MCP 5.2.2 LTS, with safe mode enabled. Start with a fresh default scene: sculpt, refine, export, correct patch normals, finalize named GLBs, then render the scale study. The model files are directly editable without rerunning these scripts. The task-owned localhost connection is stopped at delivery. Preserve previous candidates and unrelated Blender objects.

## Promotion history

Following Stage 1 approval, the cache/factory was wired into the main renderer without loading both profiles at startup. Kitsu's cache stays intact. Fade coverage is configured after renderer construction; profile swaps preserve time, captured origin and poses. Approved GLBs are in public assets and the release is 1.7.4. Tests/build/diff, real-application load/fallback/lifecycle checks and fresh paired performance measurements are recorded in `docs/KURAMA-1.7.4.md` and `docs/kurama-1.7.4/`. Publish to the existing GPT Site preserving its audience.

## 1.7.5 VFX and normal-head candidates

The latest request adds an ultimate VFX polish release before the head approvals. Each ultimate receives stronger charge/impact contrast and a short pressure front, using bounded existing pools and no new post-processing pass. The 5.6-second timelines and authoritative outcomes are unchanged. See `docs/ULTIMATE-VFX-1.7.5.md` for tests, captures and paired rendering measurements.

All three normal heads are now editable Blender candidates: Kairo's determined compact face and directional black locks; Pomu's cheerful face, coherent fringe, small scar and fitted straw hat; Shiro's layered white hair, fitted blindfold and retained collar. Their profiles use **4,494/3,058**, **5,685/3,749** and **4,120/2,874** triangles respectively, including the original coil. Batches including the coil are 10, 12 and 7, plus one restrained outline.

Each has actual front, three-quarter, side and rear renders, matching-scale current-head comparisons and original-coil studies. Review sheets and staged desktop/phone-width menu-coil, portrait and 21-snake gameplay captures are in `docs/roster-review/`. The local interactive fixture is `http://127.0.0.1:4175/tests/roster-review.html`. Model notes and exports are in `assets/roster/`. None are wired into production `createHead` yet; Kairo remains the next approval and patch integration, followed by Pomu and Shiro.
