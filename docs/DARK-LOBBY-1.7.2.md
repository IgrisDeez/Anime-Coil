# Anime Coil v1.7.2 — Lobby Alignment and Dark-Only UI

Released locally on 2026-10-01. Publishing and deployment are excluded.

## Presentation

- Desktop and landscape use one centered grid row for the roster and match panel, aligned at their top edges. The showcase spans the full grid height. Portrait phones retain the horizontal roster and vertical layout.
- The duplicate character banner and bottom map pill are removed along with their DOM update calls and styles. Framing uses the released space and still protects the cosmetics preview dock.
- Moonlit dark colors and native dark controls apply from the initial HTML/CSS. There is no theme toggle, saved-theme reader or theme reset path. Legacy saved theme values remain harmless and are ignored. Appearance retains graphics quality and reset.
- Character/map/mode hooks, Details, saved controls, progression, cosmetics, camera angle and map gameplay restoration remain intact. Short-landscape panel spacing is reduced while retaining 44px controls. No animation loop, light or render pass was added.
- Package, lockfile, page title, branding and Credits identify v1.7.2. Prior local asset and performance changes are preserved.

## Validation

- `npm test`: **336 passing, zero failures**. Focused Moonlit coverage verifies fixed dark HTML/CSS initialization and absence of preference/switching paths, stable selection hooks, full-character framing, active instance bounds and lighting/world restoration.
- `npm run build`: TypeScript and production build pass. The preexisting Three.js chunk-size advisory remains.
- `git diff --check`: passes.
- **112 combinations**: four characters × four maps at **1920×1080, 1440×900, 920×668, 900×480, 640×390, 390×844 and 320×640**. Live DOM checks confirmed no normal-menu horizontal or vertical overflow, visible Play, targets at least 44px, matching panel tops on column layouts, no obsolete overlays/toggle, and complete projected character geometry within the showcase. Screenshots cover every combination; desktop and phone contact sheets support visual review.
- Startup with absent, saved-light, saved-dark and invalid preferences stays dark. Blocked-storage application initialization was rerun in an isolated test document with a throwing localStorage getter; it produced a usable dark lobby without a theme control. The test document was closed afterward.
- Details opens, scrolls internally on phone, closes through Escape and restores focus to Details. Settings Appearance contains graphics choices and reset only. Locked cosmetics preview fits its character above the dock at 320×640; Back restores the lobby and cosmetic list.
- Mode selection, gameplay HUD, respawn feedback, pause/resume, results, restart and Back to lobby were reviewed. Gameplay restored the 43° camera, disabled lobby projection offset and identity map transforms. Existing focused tests cover all four maps' lighting restoration.
- Browser console warnings/errors were absent in the final preview. Test gameplay records and prior preferences were restored after validation. Viewport overrides and temporary storage changes were cleaned up. Review used browser emulation, not physical phones.

Evidence: [layout checks](dark-lobby-review/layout-checks.json), [startup checks](dark-lobby-review/startup-checks.json), [desktop contact sheet](dark-lobby-review/contact-1920x1080.jpg), [phone contact sheet](dark-lobby-review/contact-320x640.jpg), and [final lobby](dark-lobby-review/final-lobby.png).
