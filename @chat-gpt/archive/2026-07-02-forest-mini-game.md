# Forest mini-game

Implemented the first small forest growth loop on top of the embedded item capability model.

## Gameplay

- `Water + Micro-Forest` now consumes only the water and keeps the micro-forest in place.
- The preserved micro-forest drops `Seed` as merge output.
- `Water + Seed` grows into `Sapling`.
- `Water + Sapling` grows into `Tree`.

## Runtime support

The old merge action could only consume the source and replace the target. That was not enough for the forest seed rule because preserving the target matters for gameplay and should not be faked with a same-item replacement.

Added keep-target merge rules:

```json
{
  "withItemId": "item:micro-forest",
  "targetMode": "keep",
  "output": [
    { "type": "guaranteed", "itemId": "item:seed", "quantity": 1 }
  ]
}
```

Runtime now:

- consumes the source input normally,
- replaces the target only when `resultItemId` is present,
- rolls optional merge output,
- places merge output near the target, allowing the consumed board source cell to be reused,
- emits `merge-output` item creation events.

## Validation/audit

Config validation and audit flow now understand merge output item references and keep-target merge rules.

## Tests

Added tests for:

- keep-target merge schema acceptance,
- missing output item validation,
- runtime merge behavior that consumes water, keeps target, and places seed output.
