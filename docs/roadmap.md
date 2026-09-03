# Development Roadmap

## Current Prototype

The current build is a browser-playable combat slice that keeps data separate from logic. It is intended to validate tactical fundamentals before moving to a full Windows build.

## Phase 1-7 Completion Target

- Tune Phase 7 balance after manual playtesting.
- Add richer action result popup styling and sound hooks.
- Replace the browser package with a native Windows build after engine finalization.
- Tune terrain and obstacle placement after manual playtesting.
- Replace canvas placeholder actors with pixel sprites.
- Add sound hooks with muted placeholder events.
- Package a Windows desktop build after choosing Godot or an HTML wrapper.

## Phase 8 Growth

- Add equipment quantities instead of simple available lists.
- Add weapon proficiency growth and weapon-specific passive bonuses.
- Add skill tree cursor selection instead of one button per available node.
- Add equipment stat preview and skill unlock confirmation.
- Add multiple save slots for story, inventory, money, equipment, learned nodes, and flags.

## Phase 9 RPG Shell

- Add overworld mode separate from battle mode.
- Add town maps with NPC interaction points.
- Add shop inventory data, buy/sell rules, and inn recovery.
- Add dungeon map chains with encounter triggers and treasure flags.
- Add scenario JSON for dialogue, choices, flags, party joins, and map unlocks.

Initial shell implemented:

- Town hub, NPC scenario talks, shop buy flow, inn recovery, and dungeon route selection.
- Save/load now includes gold, story flags, town/shop/dungeon cursors, and purchased inventory.
- Chapter 1-20 now run through chapter select, battle, clear rewards, next-chapter unlocks, and final ending routing.

Remaining Phase 9 work:

- Replace draft Chapter 4-20 content with unique maps, enemy sets, rewards, and final story text.
- Replace hub menu with a walkable tile-based town.
- Add sell flow, stock limits, rewards, treasure flags, and multiple dungeon maps.
- Add scenario choices, flag-locked routes, party joins, and map unlocks.

## Phase 10 Productization

- Export Windows build.
- Add settings for volume, window scale, input mapping, and gamepad support.
- Add README, asset credits, third-party licenses, and distribution notes.
