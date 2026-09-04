# Scenario Bible

This file is the source of truth for story planning. Draft freely in a separate chat, then move only approved setting, chapter, and dialogue decisions into this file before implementation.

## Target Structure

- Total play time: about 5 hours
- Chapters: 20
- Per chapter pacing: about 5 minutes of story, about 10 minutes of battle
- Core loop: town preparation, chapter scene, tactical battle, result, growth, next chapter
- Current implementation: Chapter 1-20 campaign spine exists in `data/chapters.json`

## Working Title

Gridbound Tactics

## Premise

Stoneford Outpost guards an old northern road and a cracked bridge. A raid at the crossing reveals organized markings, hidden signals, and a bannerless force using the pinewood and sunken ruins to prepare a larger movement. The party must secure the road over 20 battles before the enemy command can surround Stoneford.

## Tone

- Grounded tactical fantasy
- Short, direct dialogue before and after battles
- Focus on military pressure, terrain knowledge, supply lines, and trust between party members
- Avoid parody, modern slang, and overly long exposition
- Each story scene should create a tactical reason for the next battle

## Main Cast

### Rook

- Class: Guard
- Role: front-line defender and practical field leader
- Voice: direct, responsible, restrained
- Story use: explains stakes, commits the party to defensive choices, anchors military decisions

### Nia

- Class: Scout
- Role: fast attacker, route reader, ambush detector
- Voice: sharp, observant, concise
- Story use: notices tracks, markings, flanking routes, and enemy inconsistencies

### Mira

- Class: Mage
- Role: healer and scholar of the ruins
- Voice: calm, precise, wary
- Story use: interprets poison marsh, old symbols, magical hazards, and the cost of lingering

### Captain Elric

- Role: Stoneford garrison captain
- Voice: tired but disciplined
- Story use: provides objectives, outpost stakes, and chapter-to-chapter pressure

### Sella

- Role: supply keeper
- Voice: practical, dry, protective
- Story use: ties battles to resources, shops, medicine, and preparation

### Tovin

- Role: wounded scout
- Voice: guilty, urgent, useful
- Story use: provides route clues, ambush hints, and reveals the enemy's planning

### Iron Voss

- Role: enemy field commander
- Voice: blunt, threatening, strategic
- Story use: gives the campaign a visible antagonist and escalates from raids to organized war

## Locations

### Stoneford Outpost

The hub town. A small fortified stop built around the old bridge. Used for NPC talks, shop access, inn recovery, party growth, and chapter selection.

### Old Road

Small map route. Few enemies. Best for fast skirmishes, interception, escort pressure, and close tactical lessons.

### Pinewood

Medium map route. Normal enemy count. Best for ambushes, line-of-sight pressure, cover, and formation play.

### Sunken Ruins

Large map route. Many enemies. Best for poison marsh pressure, boss presence, signal lore, and late-campaign escalation.

## Campaign Arc

### Act 1: The Raid Is Planned

- Chapters: 1-5
- Purpose: introduce Stoneford, terrain tactics, enemy markings, and the first banner clue
- End beat: the enemy is organized, not a random raider band

### Act 2: The Road Is a Weapon

- Chapters: 6-10
- Purpose: reveal signals, supply pressure, counter-routes, and the bridgefire midpoint crisis
- End beat: Stoneford survives the first major attack

### Act 3: The Hidden Command

- Chapters: 11-15
- Purpose: expose invasion orders, the drowned gate, and Iron Voss as the enemy's visible hand
- End beat: Voss commits his guard and the party breaks his first major operation

### Act 4: Bannerless Dawn

- Chapters: 16-20
- Purpose: counterattack, final approach, false signals, last road interception, final battle
- End beat: the hidden command is broken and Stoneford remains open

## Chapter Spine

| Chapter | Title | Route | Story Purpose |
| --- | --- | --- | --- |
| 1 | Smoke at Stoneford | Old Road | Secure the crossing and introduce planned raid clues. |
| 2 | Needles in the Pines | Pinewood | Follow markers into a controlled ambush. |
| 3 | The Sunken Marker | Sunken Ruins | Reveal the ruin marker and first arc mystery. |
| 4 | Broken Cart Road | Cart Crossroads | Tie tactics to supply loss and outpost survival. |
| 5 | The First Banner | Thornwood Lanes | Confirm the enemy is organized. |
| 6 | Lanterns Underwater | Marshlight Isles | Introduce ruin signals under the marsh. |
| 7 | Scout's Debt | Stone Bridge | Let Tovin guide a dangerous shortcut. |
| 8 | Pinewood Countermarch | Pinewood | Stop a flanking column. |
| 9 | Names in the Stone | Split Hall Ruins | Connect ruin names to enemy command. |
| 10 | Bridgefire | Stone Bridge | Midpoint defense of Stoneford bridge. |
| 11 | Ash Orders | Thornwood Lanes | Reveal invasion timetable. |
| 12 | The Drowned Gate | Split Hall Ruins | Enemy reserve force emerges. |
| 13 | Courier at Dusk | Old Road | Intercept orders before they spread. |
| 14 | Green Shade Trap | Thornwood Lanes | Turn forest tactics against a prepared trap. |
| 15 | Voss at the Ruins | Ashen Keep Courtyard | First major boss operation. |
| 16 | Stoneford Strikes Back | Stone Bridge | Begin the counterattack. |
| 17 | Pines Before Dawn | Pinewood | Final approach through ambush terrain. |
| 18 | Marsh of False Lights | Marshlight Isles | Enemy tries to split the party with signals. |
| 19 | Last Road to the Banner | Cart Crossroads | Stop the last column before the final battle. |
| 20 | Bannerless Dawn | Ashen Keep Courtyard | End the Stoneford campaign. |

## Dialogue Rules

- Keep each pre-battle scene to 2-4 lines until the final writing pass.
- Each line should be one clear thought.
- Every chapter scene needs:
  - the immediate objective
  - a terrain or tactical hint
  - one small story reveal or character beat
- Use speaker IDs already present in `data/scenario.json` unless adding a new portrait plan.
- Do not write final long scenes directly in `src/game.js`; implement them in `data/scenario.json`.

## Data Ownership

- `docs/scenario-bible.md`: approved story direction and canon
- `data/chapters.json`: chapter numbers, titles, target minutes, route IDs, rewards, unlocks
- `data/scenario.json`: implemented dialogue lines and scene flow
- `data/locations.json`: towns, NPCs, inns, dungeon routes
- `data/maps.json`: route map layouts

## Open Story Decisions

- Name and nature of the hidden enemy command
- Whether Iron Voss survives Chapter 15 or returns in Chapter 20
- Whether Tovin becomes a playable party member
- Whether the final enemy is a person, unit, or command structure
- How many town NPC scenes change after major chapters
