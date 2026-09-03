# Scenario Format

Scenario scenes are data-driven.

Runtime files:

- `docs/scenario-bible.md`: source of truth for approved setting, cast, chapter arc, and writing rules.
- `data/scenario.json`: scene order and dialogue lines.
- `data/portraits.json`: portrait image path and accent colors.
- `assets/portraits/`: optional portrait PNG files.

Before changing implemented dialogue, update or check `docs/scenario-bible.md` so scenario work from another chat has one stable handoff point.

## Scene Flow

The prototype currently supports:

- `opening`: plays before the battle briefing.
- `victory`: plays after victory, before result display.
- `defeat`: plays after defeat, before result display.

Each scene has:

```json
{
  "background": "stoneford_crossing",
  "next": "battle",
  "lines": [
    {
      "speaker": "Nia",
      "speakerId": "nia",
      "portrait": "nia",
      "text": "Dialogue text."
    }
  ]
}
```

## Future Extensions

The shape is ready for:

- choices
- flags
- party joins
- map unlocks
- background images
- voice or sound cue IDs
