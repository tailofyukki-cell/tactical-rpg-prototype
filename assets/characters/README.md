# Character Sprite Replacement

Put character PNG files in this folder and keep the filenames used by `data/sprites.json`.

Default expected sheet layout:

- PNG sprite sheet
- 32x32 pixels per frame
- 4 rows for direction
- Row 0: down
- Row 1: left
- Row 2: right
- Row 3: up
- Column 0: idle frame

Current paths:

- `rook.png`
- `nia.png`
- `mira.png`
- `raider.png`
- `cutpurse.png`
- `ash_shaman.png`

If a file is missing, the game automatically draws the built-in placeholder sprite. You can change frame size, draw size, filename, or row mapping in `data/sprites.json` without editing `src/game.js`.
