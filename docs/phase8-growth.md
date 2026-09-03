# Phase 8 Growth Notes

Implemented prototype systems:

- quantity-based equipment and weapon inventory in `data/progression.json`
- class weapon compatibility in `src/game.js`
- weapon swapping from the `PARTY` screen
- weapon proficiency XP and rank display
- weapon proficiency rank bonuses from `data/progression.json`
- weapon metadata in `data/weapons.json`
- equipment preview lines for the next weapon, armor, and accessory
- expanded skill trees with node descriptions and branches
- skill tree cursor selection and selected-node training
- confirmation dialog before spending SP on a skill tree node
- skill tree stat bonuses recalculated separately from equipment
- three local save slots

Current class weapon tags:

- Guard: sword, spear
- Scout: bow, spear
- Mage: staff

Next refinements:

- add reset/respec support for testing
