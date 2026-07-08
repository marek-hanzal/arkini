# Arkini selector model

Selectors are the shared vocabulary for saying “this rule applies to these domain entities.” They are deliberately small: a selector only answers whether a candidate entity matches. It does not create effects, choose outputs, patch config, or decide UI text. Those jobs belong to the owning rule.

The current runtime selector shape is defined in `src/config/schema/GameDomainSelectorSchema.ts`. Matching helpers live in:

- `src/selector/doesResolvedDomainSelectorMatchId.ts` for one concrete domain entity such as one item id.
- `src/effects/doesGameGrantSelectorMatchIds.ts` for a set of active grant ids.
- `src/config/validation/GameConfigSelectorValidation.ts` for config validation and formatting support.
- `cli/game/package.ts` for authoring-time item selector normalization.

## Resolved runtime selector shape

Compiled config uses only resolved selector clauses. A resolved selector is either all entities:

```json
{ "mode": "all" }
```

or a combination of clause groups:

```json
{
  "anyOf": [{ "ids": ["entity:a", "entity:b"] }],
  "allOf": [{ "ids": ["entity:b", "entity:c"] }],
  "noneOf": [{ "ids": ["entity:cursed"] }]
}
```

`anyOf`, `allOf`, and `noneOf` are all optional, but at least one of them must be present unless `mode: "all"` is used. Empty clause arrays are invalid. Empty `ids` arrays are invalid. Duplicate ids inside one clause are invalid. A selector that can match nothing is invalid for item/domain selectors.

## Authoring selector refs

Authoring item selectors may use compact refs before compile expands them into resolved `ids` clauses:

```json
{ "id": "item:tree" }
{ "ids": ["item:tree", "item:double-tree", "item:micro-forest"] }
{ "tag": "wood-source" }
```

Tags are expanded by the compiler against the selected domain index. For item selectors, `tag` means “all item ids whose item definition has that tag.” The compiled pack will not contain `{ "tag": "..." }`; it will contain deterministic `{ "ids": [...] }` clauses.

Grant selectors are authored in resolved form today, so grant clauses use `ids` directly:

```json
{
  "allOf": [{ "ids": ["grant:active:shrine-bountiful-offering"] }]
}
```

Do not write grant selector clauses as `{ "id": "grant:..." }` or `{ "tag": "..." }` unless the schema/compiler is intentionally changed to support authoring grant refs. Source JSON accepting a shape and runtime understanding it are two different traps, and apparently we need the warning label.

## Matching semantics for one entity

Item selectors and other single-entity domain selectors test one candidate id at a time. The runtime asks “does this item id match?”

The effective rule is:

```text
matches =
  (mode: all OR no selector means true)
  AND (anyOf is absent OR candidate is inside at least one anyOf clause)
  AND (allOf is absent OR candidate is inside every allOf clause)
  AND (noneOf is absent OR candidate is inside no noneOf clause)
```

Examples:

```json
{ "mode": "all" }
```

Matches every item.

```json
{ "anyOf": [{ "ids": ["item:tree", "item:double-tree"] }] }
```

Matches `item:tree` or `item:double-tree`.

```json
{
  "allOf": [
    { "ids": ["item:tree", "item:double-tree", "item:micro-forest"] },
    { "ids": ["item:tree", "item:rock"] }
  ]
}
```

Matches only ids that are in both clauses. In this example, only `item:tree` matches. This is how tag intersections work after compile: `allOf: [{ "tag": "wood-source" }, { "tag": "finite-deposit" }]` becomes two id sets, and the candidate must be in both.

```json
{
  "anyOf": [{ "ids": ["item:tree", "item:rock"] }],
  "noneOf": [{ "ids": ["item:rock"] }]
}
```

Matches `item:tree`, not `item:rock`.

### Important single-entity pitfall

For item selectors, this is usually wrong:

```json
{
  "allOf": [
    { "ids": ["item:tree"] },
    { "ids": ["item:rock"] }
  ]
}
```

No single item id can be both `item:tree` and `item:rock`, so the selector matches nothing. Use `anyOf` when you mean either item.

## Matching semantics for active grants

Grant selectors test a set of currently active grant ids, not one candidate entity. The runtime asks “does the current world grant set satisfy this selector?”

The effective rule is:

```text
matches =
  (mode: all means true)
  AND (anyOf is absent OR at least one anyOf clause has at least one active grant)
  AND (allOf is absent OR every allOf clause has at least one active grant)
  AND (noneOf is absent OR no noneOf clause has an active grant)
```

Examples:

```json
{
  "allOf": [{ "ids": ["grant:owned:producer:townhall-t1"] }]
}
```

Requires that one grant.

```json
{
  "allOf": [
    { "ids": ["grant:path:faith", "grant:path:engineers"] },
    { "ids": ["grant:active:shrine-minor-haste"] }
  ]
}
```

Requires either `grant:path:faith` or `grant:path:engineers`, and also requires `grant:active:shrine-minor-haste`.

```json
{
  "noneOf": [{ "ids": ["grant:path:faith"] }]
}
```

Matches only while `grant:path:faith` is not active.

### Important grant pitfall

For grants, one clause with multiple ids is an OR group. Multiple `allOf` clauses are ANDed groups. This means:

```json
{
  "allOf": [{ "ids": ["grant:a", "grant:b"] }]
}
```

means “grant A or grant B is active,” not “both A and B are active.” To require both, write two clauses:

```json
{
  "allOf": [{ "ids": ["grant:a"] }, { "ids": ["grant:b"] }]
}
```

This differs from item selectors only because grant matching is set-based while item matching is one-id-at-a-time.

## Where selectors are used

### Nearby item selectors

Nearby rules use an `items` selector. These are item-domain selectors and can use authoring refs/tags in source JSON:

```json
{
  "kind": "nearby.require",
  "items": { "anyOf": [{ "tag": "tree" }] },
  "distance": "near",
  "phase": "start",
  "display": "whenMissing"
}
```

Used by rules such as:

- `nearby.require`
- `nearby.capacity.spend`
- `nearby.duration.multiply`
- `nearby.loot.outputChance.add.sources[].items`

Nearby distance and selection semantics belong to the individual effect kind. The selector only answers which item definitions are eligible before board position/capacity/distance-bucket logic runs.

### Grant selectors

Grant rules use `selector` and test the active grant set:

```json
{
  "kind": "grant.require",
  "phase": "start",
  "display": "whenMissing",
  "selector": {
    "allOf": [{ "ids": ["grant:owned:producer:townhall-t1"] }]
  }
}
```

Used by rules such as:

- `grant.require`
- `grant.blockStart`
- `grant.duration.multiply`
- `grant.drop.hide`
- `grant.drop.show`
- `grant.drop.disable`
- `grant.drop.enable`
- `grant.loot.extraOutputChance.add`

Selectors use grant ids, not player-facing grant names. UI may display grant names from the source effect definitions, but matching must use ids.

## Compiler and validation behavior

Compile-time normalization in `cli/game/package.ts` currently expands authoring item selectors under nearby `items` fields. It validates that:

- referenced item ids exist,
- referenced item tags exist on at least one item,
- duplicate selector refs are rejected,
- the normalized item selector matches at least one item.

Runtime config validation validates resolved selectors. It checks that ids exist in the expected domain and that item/domain selectors match something. Grant selectors validate referenced grant ids, but `noneOf`-only grant selectors are allowed because “match while this grant is absent” is a valid rule.

The browser runtime consumes the compiled config. If source JSON changes but `game/arkini.game.arkpack` is stale, the browser will not see the change. `npm run audit:current` is expected to catch stale pack drift.

## Style rules

Prefer tags for item categories that are meant to grow:

```json
{ "anyOf": [{ "tag": "stone-deposit" }] }
```

Prefer explicit ids for one-off story/path gates or specific grants:

```json
{ "allOf": [{ "ids": ["grant:path:faith"] }] }
```

Use `allOf` for intersections or multiple mandatory grant groups. Use `anyOf` for alternatives. Use `noneOf` for exclusions and blockers.

Do not use selectors as hidden effect routing. The owner of the rule should already be local: output-owned effects live on the output they modify, craft effects live on the craft they block, nearby effects live on the line/source that needs proximity. Selectors narrow eligible domain facts; they are not a replacement for owning the behavior in the right place.
