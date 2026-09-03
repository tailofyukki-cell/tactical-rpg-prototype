# Sprite Format

Character images are data-driven.

Runtime files:

- `data/characters.json`: each unit has a `sprite` ID.
- `data/sprites.json`: each sprite ID maps to an image path and sheet settings.
- `assets/characters/`: image files live here.

## Recommended Format

Use PNG sprite sheets for final art.

- 32x32 pixels per frame by default
- 4 direction rows
- Row 0: down
- Row 1: left
- Row 2: right
- Row 3: up
- Column 0: idle

Example:

```json
{
  "path": "assets/characters/nia.png",
  "frameWidth": 32,
  "frameHeight": 32,
  "drawWidth": 42,
  "drawHeight": 42,
  "idleFrame": 0,
  "directions": {
    "down": 0,
    "left": 1,
    "right": 2,
    "up": 3
  }
}
```

## Replacing Art

To replace Nia:

1. Put the new sheet at `assets/characters/nia.png`.
2. Keep `data/sprites.json` pointing to `assets/characters/nia.png`.
3. If the sheet uses a different frame size or row order, change only `data/sprites.json`.

No JavaScript change is needed.

## Fallback

When the image path is missing or fails to load, the game draws the built-in placeholder unit. This keeps the prototype playable while art is still being produced.
