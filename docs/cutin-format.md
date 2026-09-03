# Cut-in Format

Skill and magic cut-ins are data-driven.

Runtime files:

- `data/cutins.json`: unit-specific cut-in image path, accent color, and duration.
- `assets/cutins/`: optional cut-in PNG files.
- `src/game.js`: renders the cut-in and falls back to text if no image exists.

## When Cut-ins Play

Cut-ins play for:

- `SKILL`
- `MAGIC`

They do not play for:

- normal attacks
- items
- wait
- training

## Recommended Image

- PNG
- 480x180
- transparent background preferred
- face or upper-body art

Example:

```json
{
  "accentColor": "#d7a7ff",
  "durationMs": 950,
  "imagePath": "assets/cutins/mira.png"
}
```

If the image is missing, the game uses a text-only cut-in. This lets combat stay playable while art is incomplete.
