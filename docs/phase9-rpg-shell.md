# Phase 9 RPG Shell Notes

Implemented prototype systems:

- town hub mode separate from battle mode
- chapter progression toward a 20-battle, roughly 5-hour structure
- data-driven town definition in `data/locations.json`
- data-driven chapter definition in `data/chapters.json`
- NPC entries with scenario scenes and story flags
- shop stock in `data/shops.json`
- buy flow for items, weapons, armor, and accessories
- inn recovery using party HP/MP and local gold
- nine-route dungeon select screen that leads into route-specific tactical battles
- route-specific map size and enemy count
- save/load support for gold, story flags, shop cursor, town cursor, dungeon cursor, and inventory
- chapter clear rewards, completed chapter flags, and next-chapter unlocks

Current content:

- Town: Stoneford Outpost
- Shop: Stoneford Supply
- Inn: Wayfarer's Rest
- Dungeon routes: nine routes spanning roads, forest, ruins, bridge, crossroads, marsh, and keep layouts
- Chapters: Chapter 1-20 campaign spine
- Route scale:
  - Old Road Skirmish: small map, few enemies
  - Pinewood Ambush: medium map, normal enemies
  - Sunken Ruins: large map, many enemies

Current limitation:

- Route maps currently reuse the same tactical rules and placeholder tileset style. Enemy composition, layout, and map size are route-specific.
- Chapter 4-20 currently use draft story scenes and provisional rewards.

Next refinements:

- add sell flow and item quantities in the shop UI
- add a real tile-based town map with player walking
- tune map-specific enemy sets and route rewards
- add scenario choices that set flags and unlock routes
- add treasure and dungeon clear rewards
- refine Chapter 4-20 with unique maps, enemy sets, rewards, and story beats
