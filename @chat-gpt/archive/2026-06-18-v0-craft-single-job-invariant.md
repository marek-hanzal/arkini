# V0 craft single-job invariant

Datum: 2026-06-18
Task: Stabilization epic T1

## Výsledek

Craft target na boardu smí mít právě jeden běžící craft job. Engine teď odmítne druhý `craft.start` na stejný `targetItemInstanceId` ještě v readiness/start vrstvě a save schema odmítne uložený save se dvěma craft joby na stejný target.

Tím je craft kontrakt připravený na další task: craft completion má replace-nout původní target za result item, ne spawnovat výsledek bokem. Bez single-job guardu by se replace completion chovala jako malá továrna na časové paradoxy.

## Upravená místa

- `src/v0/game/engine/fx/checkCraftStartReadinessFx.ts`
  - hledá existující job se stejným `targetItemInstanceId`
  - vrací `GameActionRejected` s reason `craft_in_progress`
- `src/v0/game/engine/model/GameEngineError.ts`
  - přidán reason `craft_in_progress`
- `src/v0/game/engine/model/GameActionRejectedReadinessSchema.ts`
  - readiness schema zná `craft_in_progress`
- `src/v0/game/engine/model/GameSaveSchema.ts`
  - `GameSaveConfigSchema` odmítá duplicitní craft job targety
- testy:
  - `applyGameActionFx.test.ts`: druhý start na stejný target failne
  - `readActionReadinessFx.test.ts`: readiness ukáže `craft_in_progress`
  - `GameSaveSchema.test.ts`: duplicitní target failne, různé targety projdou

## Kontrakt

- Jeden board item target = max jeden craft job.
- Různé craft targety smí běžet paralelně.
- Completed-but-still-present craft job se pořád počítá jako active lock, protože save ho ještě nezpracoval tick/completion flow.
- UI readiness je jen pohodlí. Skutečný invariant drží engine a schema.

## Další krok

Pokračovat T2: `completeCraftJobFx` musí target item replace-nout za `recipe.resultItemId` v původní board cellce. Současné output spawnování bokem je v rozporu s vyjasněným craft designem.
