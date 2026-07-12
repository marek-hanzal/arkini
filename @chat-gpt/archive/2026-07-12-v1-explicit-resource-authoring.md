# V1 explicit resource authoring

## Resource identity

Every packaged PNG resource is identified by its filename basename without the `.png` suffix.

```text
assets/blueprint.png              -> blueprint
assets/producer-lumberjack-t1.png -> producer-lumberjack-t1
assets/hero.png                   -> hero
```

Config always references these IDs explicitly. The compiler and runtime must not infer a resource ID from an item ID, item type, `targetId`, directory name, or naming prefix.

## Item resources

Normal item visuals are explicit authored resource IDs.

Blueprints use the ordered tuple:

```text
[blueprintVisualResourceId, completedTargetVisualResourceId]
```

Both positions are explicit references. Explicit does not mean unique: multiple blueprint items may intentionally reuse the same blueprint visual while keeping distinct target visuals.

```json
"asset": ["blueprint", "producer-lumberjack-t1"]
```

This is normal resource reuse, not an implicit fallback. Do not create per-blueprint copies such as `item-blueprint-lumberjack-t1.png` when the visual is identical. Do not infer `blueprint` or the target visual from `targetId`.

## Non-item resources

Resources used by the application outside item rendering belong to named fields in `ResourceConfigSchema`.

Today the only such role is:

```json
"resources": {
  "hero": "hero"
}
```

The object key is a stable logical application role. Its value is an explicit resource registry ID. Add future non-item resources as named schema fields when the application gains a concrete use for them; do not turn `ResourceConfigSchema` into an anonymous asset bag.

## Validation policy

The completed game-directory validator owns:

- duplicate PNG basenames;
- missing resources referenced by item assets;
- missing resources referenced by blueprint tuple positions;
- missing resources referenced by `ResourceConfigSchema`;
- unused PNG resources as diagnostics.

Pack and `game:validate` must consume the same resource manifest. No separate pack-only naming or fallback logic is allowed.
