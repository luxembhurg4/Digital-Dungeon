# Dungeon of Tabs — New Assets Build Log

## Goal
Implement the "new assest builder amster plan" in order: interactive rooms → new maps → HUD/dialogue.
Plan file: `new assest builder amster plan.txt` (1479 lines). New art: `new assets/` (137 files).

## Phase 0 — Staging (DONE 2026-10-06)
- [x] Read new master plan §1–7 (journey, maps, hero, props, read mode, interactions, dialogue)
- [x] Read new master plan §8–15 (dialogue/panels, HUD/state, spawns, HUD details, acceptance, collision workflow, verification)
- [x] Inventory `new assets/`: 8 room dirs (gate, profile-hall, analysis-chamber, router-quest, reel-trap, plan-armory, infographic-vault, exit), 7 hallway dirs (Hallway 01_…07_), Dungeon Kit_, shared-system, ui, control
- [x] Agreed order with user: rooms → maps → HUD/dialogue, with this log tracking progress

## Phase 1 — Interactive rooms (IN PROGRESS)
- [ ] Gate field layout (spawn E, exit W, prompt E, treasure chest, torch)
- [ ] Profile Hall field layout (spawn S, exit N, prompt E, profile + inventory panels)
- [ ] Analysis Chamber field layout (spawn S, exit N, 10 reward chests)
- [ ] Router Quest field layout (spawn S, exit N, research scroll, workaround/fix chain)
- [ ] Reel Trap field layout (spawn S, exit N, round logic)
- [ ] Plan Armory field layout (spawn S, exit N, quest list)
- [ ] Infographic Vault field layout (spawn S, exit N, torch ring)
- [ ] Exit field layout (spawn S, no exit, final stats + commitment)
- [ ] Loot registry: 10 analysis + 1 router + 1 exit = 12 max, first-open only, persisted
- [ ] Room engine: entry/exit/prompt cells, E-to-read, dialogue lock, torch/chest/scroll interactions

## Phase 2 — New maps + D-pad art
- [ ] Swap 7 hallway base maps from `new assets/Hallway 0N_/map-0N/artwork.png`
- [ ] Swap D-pad art from `Dungeon Kit_/control/*` (normal/pressed/disabled per direction)
- [ ] Verify collision guides still match new artwork

## Phase 3 — HUD + dialogue/panels
- [ ] RPG dialogue box (pixel title, typewriter, Next/Close, reduced-motion)
- [ ] Room HUD (room name, explored X/8, loot, local progress) from `ui/room-hud*.png`
- [ ] Panels: profile, inventory, benefits, risks, commitment, final stats, reel lost/success
- [ ] Read-mode images for all 8 rooms
- [ ] Read-mode toggle behavior (§6.4)

## Phase 4 — Verify + deploy
- [ ] Extend test/run.js: room entry/exit, E-to-read, chest loot once, torch persist, reel rounds, HUD/loot display
- [ ] All tests green
- [ ] Sync docs/ mirror, push to GitHub, confirm Pages deploy

## Move log (every change, newest last)
- 2026-10-06 · Created BUILD_LOG.md with phased plan (rooms → maps → HUD/dialogue + verify/deploy).
- 2026-10-06 · MOVE 1 — Staged new art (DONE): 16 room files in `site/assets/rooms/<room>/` (map-terrain + read-mode ×8), Dungeon Kit props/hero/control, shared panels, kit-ui. Verified: 137 files in `new assets/`, all staged.
- 2026-10-06 · MOVE 2 — Phase 1 rooms data (DONE, syntax-checked): added ROOM_FIELDS + LOOT_CHESTS (12 chests, §10 + §9.3) to `site/js/data.js`. NOT DONE: rooms.js engine, HUD/dialogue wiring, tests.
- 2026-10-06 · MOVE 3 — Build `site/js/rooms.js` engine: tile grid per ROOM_FIELDS, WASD/arrows+E movement, exit/prompt triggers, chest open-once + loot callback, torch toggle callback, terrain+sprite rendering. Then wire into index.html + app.js save (chests/torches), verify with node --check + local boot.
- 2026-10-07 · MOVE 4 — Fixed flaky Analysis Chamber navigation in `site/test/smoke-rooms.js`: replaced blind timed key-holds with the polled `nudgeTo()` waypoint walker (same as run.js). Timed "right 300ms" overshot to x≥84, putting a foot in col6 (blocked at row6), stalling the climb at cell (3,7) → opened chest-03 instead of chest-01. Game/collision data was correct; only the test route changed. Verified: smoke 26/26, run.js 36/36.
- 2026-10-07 · MOVE 6 â€” Hallway back-door confirmation prompt: added overlay HTML (`site/index.html`), CSS styles (`site/css/style.css`), and implementation (`site/js/hallway.js`: `openBackConfirm`, `closeBackConfirm`, `confirmBackYes`, `confirmBackNo`, `bindBackConfirm`). Bound in `app.js` `init()` via `Hallway.bindBackConfirm()`. Hallway movement frozen while prompt open; re-arms doorway on decline. Also added `bindBackConfirm` to hallway.js public API.
- 2026-10-07 Â· MOVE 6 (cont.) â€” Room 7 ending at last door: `fireExit()` opens "The Last Door" dialogue with stats (rooms explored, chests, loot, wellness) and wise words "May the treasures you found guide you towards a more responsible digital citizen."
- 2026-10-07 Â· MOVE 6 (cont.) â€” Reel Trap overhaul: fight-gated autoplay (autoplay only starts when monster fight is triggered), audio always on (`soundOn = true`, no mute param), whole-reel playback via `YT.PlayerState.ENDED` event, Shorts-sized window (reel-deck max-width: 380px, aspect-ratio 9/16).
- 2026-10-07 Â· MOVE 6 (cont.) â€” Phase A bug fixes verified: Plan Armory rack off-by-one (racks 00-06 + DAY 07 reachable), Escape stops fight + movement restored, Measures scroll wider/sticky, Inventory readability.
- 2026-10-07 Â· MOVE 6 (cont.) â€” Verification: `node --check` passed on app.js, hallway.js, rooms.js. All JS syntax clean.
- 2026-10-07 MOVE 7 - Synced stale docs/ Pages mirror (DONE, verified): docs/ was missing rooms.js + 76 assets (23 vs 99 files). Copied site/index.html, css, all 4 js files, full assets tree. Verified: hashes match, live boot shows Gate map + Rooms engine with zero page errors. Suites green: run.js 36/36, smoke-rooms.js 26/26.
