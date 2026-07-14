# New config: remaining feature model

## Goal

Continue the new standalone game configuration under `config/schema` until it can replace the meaningful gameplay surface of the current `src/config` model without reintroducing its generic effect/selector mess.

The intended direction remains a materially smaller runtime bundle and codebase while retaining gameplay behavior. Do not blindly port the old effect system.

## Current state

The new model already contains:

- `GameSchema` with version and item catalog;
- discriminated item schemas: simple, producer, craft, stash, cheats, nuke and inventory;
- explicit quantity, input, line, output, roll-set and drop models;
- local line rules (`show`, `hide`, `block`, `require`) and local drop rules (`block`, `require`);
- standalone `WhenSchema` conditions and a pure evaluator in `config/when/evaluateWhen.ts`.

The output pipeline is deliberate:

```text
select RollSet -> evaluate roll -> select drop -> evaluate drop rules -> emit or discard
```

A rejected selected drop is discarded. It is never rerolled or replaced implicitly.

## Locked decisions

### Conditions

`WhenSchema` stays a small discriminated union over one shared `QuerySchema`:

```ts
type WhenExists = {
  type: "exists";
  query: Query;
};

type WhenCount = {
  type: "count";
  query: Query;
  count: NonNegativeInteger;
};

type WhenRange = {
  type: "range";
  query: Query;
  min: NonNegativeInteger;
  max: NonNegativeInteger;
};
```

- `exists` passes when the query returns any logical item quantity.
- `count` is exact equality, including zero.
- `range` is inclusive and requires `min <= max`.
- A rule owns a non-empty `when` tuple. All conditions must pass (flat AND).
- Distance is a concern of board queries, not a standalone condition type.
- Do not add generic selector trees, boolean composition, or comparison variants without a concrete data need. Future `gte`/`lte` variants can be added independently if gameplay requires them.
- Board query distance uses Chebyshev distance. A distance query returns no matches without a board source; the source and all distance-zero matches are excluded.
- `close` searches within one cell, `near` within two cells and `far` searches every non-source board cell.

### Rules

Rules stay local to their owner:

- `config/schema/line/rule/*` governs a line;
- `config/schema/output/drop/rule/*` governs a selected drop;
- do not create a mega-generic `RuleSchema` spanning both domains.

Line visibility semantics are:

```text
shown = no matching hide rule && (line.show || some matching show rule)
```

A failed line requirement leaves the line visible but unavailable. A matching block also leaves it visible but unavailable. A matching hide wins over show.

## Gap analysis

### First: foundational playable config

- Add game metadata: game ID/title, board dimensions, inventory capacity and starting board/inventory state.
- Add universal item presentation: title/name, description, optional label, tier, tags and asset binding.
- Add item storage and lifecycle: board/inventory policy, stack size, maximum owned count, capacity and depletion behavior.
- Add line identity and presentation: each producer line needs a stable ID and player-facing title/description. `OutputSchema` identity is not a substitute for line identity.
- Relax `LineSchema` so a line can have no inputs. In current source data, 32 of 126 lines have no input; these are normal producer/extraction lines.
- Decide how effect-only lines should map. Current data has two lines with an effect and no output.
- Restore output placement policy (`board_then_inventory` in the old model) or deliberately replace it with a better explicit destination model.

### Second: production and item actions

- Finish input semantics: new quantity already covers old exact/upTo behavior, but inputs still need `consume` and producer-side input capacity.
- Finish producers: queue size, charges, line charge cost and depleted behavior.
- Finish stashes: their single line, charges and mandatory remove-on-depletion behavior. The new stash type is currently only a discriminator.
- Model merges and remove-by interactions, including their outputs.
- Model the board-memory item or consciously remove it. It is a real current special interaction and is not present in `ItemEnumSchema`; cheats, nuke and inventory already are.

### Third: rule actions and dynamic state

- Add a line runtime multiplier rule for pollution/forest-style effects. This was an explicit desired new-game behavior and corresponds to 23 current duration modifiers.
- Keep capacity spending separate from `WhenSchema`: the two current `nearby.capacity.spend` effects both test and mutate state, so they are not pure boolean conditions.
- Decide the replacement for current passive/active grants. `WhenExists` can read item presence, but does not create a capability/state token. The current config has 60 items with passive `GameEffect`s plus active effect lines.
- Add player-facing rule explanation metadata if the UI must explain why a line or drop is unavailable. The old effects carry label, reason and display policy; the new rules currently do not.

### Fourth: output/UI and validation

- Consider drop presentation/order only if needed. The new output model already covers guaranteed, chance, weighted rolls and weighted output sets; it is stronger than current data here. Current data has six conditional drop-hide uses and seven explicit sorts.
- Add cross-reference and gameplay validation after the shape stabilizes: item references, board bounds, impossible rules, reachability and soft-lock checks. Key-to-`item.id` validation is explicitly deferred for now.
- Decide whether the source-fragment/compiler pipeline, `$schema` authoring fields, assets and resources should remain. Current data has eight explicit assets; resources are not currently used by the source package.

## Evidence from current game data

- 247 item fragments: all contain name, description and tags.
- 77 craft items, 64 producers, 4 stashes, 1 merge-bearing item and 4 remove-by items.
- 254 effects: 102 `nearby.require`, 14 nearby duration modifiers, 9 grant duration modifiers, 6 path blocks and 6 conditional drop hides.
- 126 lines: 94 have inputs, 119 have outputs, and 2 are effect-only.

Relevant old schemas:

- `src/config/GameConfigSchema.ts`
- `src/config/schema/GameItemSchema.ts`
- `src/config/schema/GameLineSchema.ts`
- `src/config/schema/GameProducerSchema.ts`
- `src/config/schema/GameActivationInputSchema.ts`
- `src/config/schema/GameActivationOutputSchema.ts`
- `src/config/schema/GameLineEffectSchema.ts`
- `src/config/schema/GameDropEffectSchema.ts`

## Recommended implementation order

1. Game/base item/line metadata plus starting state, storage and placement.
2. Optional-input line model, input consumption/capacity, producer and stash mechanics.
3. Merge/remove/capacity lifecycle and board-memory decision.
4. Runtime multiplier and the passive/active capability decision.
5. Presentation-only output details, validation and authoring/compiler tooling.
