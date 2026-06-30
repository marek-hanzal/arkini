# V0 craft target replacement

Datum: 2026-06-18
Task: Stabilization epic T2

## Výsledek

Craft completion už nespawnuje output bokem a nevrací stored requirements jako extra itemy. Dokončený craft teď vezme původní board target, vyčistí jeho runtime state, zachová jeho `itemInstanceId` a board souřadnice, a přepíše `itemId` na `recipe.resultItemId`.

Prakticky: `blueprint + inputs + craft.start -> stejná board cellka se změní na result`. Žádný blueprint duch, žádný result v inventáři, žádné scheduled spawn mezistavy kvůli animaci. Díky bohu, jedna věc se chová jako jedna věc, což je v softwaru překvapivě ambiciózní cíl.

## Upravená místa

- `src/v0/game/engine/fx/completeCraftJobFx.ts`
  - completion validuje live target a recipe/result reference
  - maže hotový job
  - volá `removeBoardItemRuntimeState` pro starou target identitu
  - replace-ne target item na `recipe.resultItemId`
  - emituje `craft.completed` + `item.replaced(reason: "craft-result")`
- `src/v0/game/engine/fx/startCraftFx.ts`
  - craft job už nenese `returnItems`
- `src/v0/game/engine/model/GameSaveSchema.ts`
  - `GameSaveCraftJobSchema` už nemá `returnItems`
- `src/v0/game/engine/model/GameEventSchema.ts`
  - přidán board change reason `craft-result`
  - odstraněny staré created reasons `craft-output` a `craft-requirement-return`
  - odstraněn mrtvý `craft.blocked`, protože craft replacement nepotřebuje placement preflight
- `src/v0/game/engine/fx/processCompletedCraftJobsFx.ts`
  - po craft jobu už nespouští scheduled event pass jen kvůli bývalému output spawnu
- visual bridge / TileEngine motion
  - `craft-result` se mapuje na `item.replaced` s craft animation cause
  - replacement target dostane board enter motion na existující tile id, takže vizuál je transformace/replacement, ne spawn vedle

## Kontrakt

- Craft job = jeden target, jeden result.
- Result zůstává na původním `itemInstanceId` a původní board cellce.
- Stored craft requirements jsou spotřebované do výsledku, ne vrácené po dokončení.
- Craft completion nemůže být blocked kvůli placementu, protože nic neumisťuje bokem.
- Pokud save obsahuje craft job s chybějícím nebo změněným targetem, engine selže přes `GameSaveInvalid`; takový save má zachytit schema/storage validace, ne UI šamanismus.

## Test coverage

- `runGameTickFx.test.ts`: completed craft replace-ne target in-place, nevytvoří inventory result ani scheduled spawn.
- `applyGameActionFx.test.ts`: craft start pořád spotřebuje inputs/requirements a vytvoří job bez return payloadu.
- `GameSaveSchema.test.ts`: craft job shape bez `returnItems` drží single-target invariant z T1.
- `createActionVisualEventsFromGameEvents.test.ts`: `craft-result` replacement mapuje na craft visual cause.
- `registerTileEngineEnterRequests.test.ts`: replacement visual request jde na replaced tile id.

## Další krok

Pokračovat T3: stash completion/output atomicita podle produceru. Craft už je z té scheduled-spawn bažiny venku, stash v ní pořád stojí po kotníky a tváří se, že je to lázeň.
