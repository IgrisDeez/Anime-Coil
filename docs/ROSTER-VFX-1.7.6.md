# Anime Coil 1.7.6 — Sculpted roster and ultimate VFX

The revised Blender heads are now the default for Kitsu, Kairo, Pomu and Shiro, including character selection, portraits, players and bots. Layered, directional hair uses one packed diffuse map per character/profile. The approved coil, Kitsu eye clearance, faces, body cosmetics, transformed heads and Kurama are preserved.

Selected-profile assets preload before renderer construction. Clones share geometry, materials and maps while owning blink transforms. Profile changes replace all normal heads and portraits without changing simulation or cinematic time. A failed revised Kitsu load restores the approved earlier Kitsu asset; other failures use the procedural head. Resources are owned by the cache and disposed once at application teardown.

| Head | Desktop triangles including coil | Mobile | Draws including coil, before outline |
| --- | ---: | ---: | ---: |
| Kitsu | 5,951 | 3,933 | 12 |
| Kairo | 4,794 | 3,058 | 10 |
| Pomu | 5,985 | 3,749 | 12 |
| Shiro | 4,420 | 2,874 | 7 |

Each ultimate uses its approved distinct charge, kill-frame impact and bounded aftermath. Reduced motion, reduced flashes and disabled cinematic camera remain supported. Authoritative outcomes, cooldowns, eliminations and respawn timing are unchanged.

Historical review evidence: [hair review](HAIR-DETAIL-REVIEW.md), [VFX report](ULTIMATE-VFX-1.7.6-REVIEW.md). Hair adds approximately 5.33 MiB desktop / 1.33 MiB mobile for four RGBA8 textures with mipmaps and adds no head draws compared with the previous sculpt candidates. The VFX review measured repeatable CPU increases in some impact/aftermath cases; see its report for all raw comparisons. Do not interpret emulator viewport testing as physical-phone or GPU performance verification.

Publication targets the existing public GPT Site and GitHub repository. Editable models and full visual review archives remain local, separate from the lean runtime source repository. No new Site or arena is created.

Validation: `npm test` passed all 332 tests; `npm run build` passed. The default application passed 61 desktop/phone-width checks with zero browser errors, including all four menu heads and portraits, 21-character crowds, resource sharing, independent blinks, cached profile switches during recovery, unchanged held authoritative state, restoration after completion/death/respawn/restart/quit, repeated Shibuya rebuilds, reduced motion/flash, disabled cinematic camera, boundary casts with large snakes, and failed revised-asset fallback. Captures and raw JSON are retained locally in `docs/roster-vfx-1.7.6/`.
