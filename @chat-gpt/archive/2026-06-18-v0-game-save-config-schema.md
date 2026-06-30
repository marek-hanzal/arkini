# V0 GameSaveConfigSchema checkpoint - 2026-06-18

Save validation is now centralized in the game schema/model layer.

Public contract:

- `GameSaveSchema` still validates raw save document shape.
- `GameSaveConfigSchema` validates `{ save, config }` and owns config-aware save invariants through Zod `superRefine`.
- Storage/runtime code must call this central schema instead of duplicating board/inventory/job invariants in persistence plumbing.

Current semantic save guards:

- save `gameId` must match `config.game.id`.
- inventory slot count must match configured inventory slots.
- board item record keys must match item ids, item references must exist, positions must be in bounds, and occupied cells must be unique.
- inventory stacks must reference existing items and respect `items.*.maxStackSize`.
- producer jobs must key by their own id, target an existing producer board item, reference a product owned by that producer, reference an existing output loot table when present, and stay within the effective producer queue size.
- effective producer queue size is derived centrally from completed `producer.maxQueueSize.add` upgrade tiers, matching runtime layer semantics without pushing this validation into storage.
- producer line state must target producer board items and disabled products must belong to that producer.
- craft jobs must key by their own id, reference an existing recipe, target a board item with that craft recipe, and return existing items.
- upgrade state/jobs must reference existing upgrades, valid tier indexes, and only one running job per upgrade.
- stash state must target stash board items and not exceed configured stash charges.
- stored requirement state must target board items, store accepted item ids only, and stay within accepted capacity.
- scheduled event record keys must match event ids, item references must exist, `afterEventIds` cannot duplicate/self-reference, and live board remove/replace targets must still match the event item when present.

Dexie integration:

- `GameSaveStorageScope` and `SaveActiveGameSaveProps` now include `config`.
- `DexieGameSaveStorage` validates both loaded and saved documents through `GameSaveConfigSchema`.
- Semantic invalidity is treated like stale/corrupt storage: wipe Dexie save DB and let persistent runtime recreate a fresh initial save.

Keep this boundary strict. Do not add separate save invariant checks in storage, runtime hooks, UI views, or feature modules unless they are action-readiness guards for current user intent.
