# Single-copy producer buildings

Default Arkini producer buildings are now authored as unique one-copy board objects.

Rules:
- Every `producer:*` item has `maxCount: 1`.
- Every `producer:*` item carries the informational `unique` tag so intent is visible in config.
- Town Hall I no longer offers Lumberjack I or Quarry I blueprints because both buildings are present in the starting board and capped to one copy.

Guardrails:
- `defaultGameConfig` tests assert every producer is single-copy and tagged `unique`.
- `defaultGameConfig` tests assert Town Hall I does not reissue the starter Lumberjack/Quarry blueprint lines.
