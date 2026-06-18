# V0 stabilization epic: config, tick engine, craft/stash, events

Datum: 2026-06-18
Base commit: `e1fd0b3 Review game config tick engine stabilization`
Scope: přetavené poznámky z brutálního review + Marekovo upřesnění craft/inventory/overlay kontraktu. Tohle je epic pro stabilizační pass před další gameplay vrstvou. Cíl není plošný refactor pro radost z bourání domečků, ale tvrdé srovnání míst, která už teď smrdí.

## Upřesněný design kontrakt

### Craft

Craft není obecná výrobní stanice s outputem bokem. Craft je:

1. Na boardu existuje právě jeden target item.
2. Do target itemu se přes core DnD/merge-like interakce nasypou suroviny / requirements.
3. Spustí se právě jeden craft job na tento target.
4. Po dokončení se target item swapne / replace-ne za právě jeden výsledný item.

Prakticky: `blueprint + suroviny + craft.start -> stejný board slot / stejná instance path se změní na budovu`, ne “blueprint zůstane a vedle něj se spawnne barák”. Pokud z toho někdy budeme chtít craft station output model, musí to být nový explicitní config mode, ne tichý default, protože takhle vznikají designové trosky s úsměvem.

### Craft & stash completion

Producer completion už má správnější model: výstup se rollne jednou, placement se pokusí aplikovat atomicky, blocked delivery se perzistuje na jobu a retry ne-rerolluje. Craft a stash se mají normalizovat stejným směrem.

Save má být pravda hned po action/tick výsledku. Scheduled events nesmí sloužit jako gameplay mezivrstva jen proto, že chceme hezkou sekvenční animaci. Animace může být delayed/sequence; stav hry nemá být Schrödingerův šuplík.

### Config overlay / upgrades

Overlay jako koncept je v pořádku: upgrady jsou globální pro konkrétní item / konkrétní product line na itemu. Například `lumber camp lvl 1` a jeho product line `wood`.

Pozor ale na modelovou čistotu: effect je product-scoped, takže runtime resolved config musí zůstat product-scoped. Jestli authoring používá top-level reusable `inputs`, nesmí se stát, že upgrade productu A náhodou zmutuje shared inputRef tak, že se změní product B. Dnes to nemusí být obsahový bug, ale schema/kód by ten kontrakt měl vynutit nebo vyjádřit přímo, ne doufat, že shared inputRef nikdy nikdo nepoužije blbě. Doufání je validní nástroj jen u počasí a i tam je to trapné.

### Upgrade effective validation

Base config validace nestačí. Musíme umět ověřit i postupný effective config po aplikaci dokončených tierů, minimálně pro každý prefix tierů každého upgradu, aby upgrade nikdy nevyrobil invalidní runtime stav.

Zakázané výsledky:

- záporný čas / duration
- nulový nebo záporný product input quantity, pokud input slot dál existuje
- nulový nebo záporný cost/resource quantity
- záporná queue size nebo kapacita
- effective reference na neexistující input/product/loot/item

Pokud quantity spadne na nulu a chceme to někdy používat jako “input odstraněn”, musí to být explicitní efekt / explicitní normalized output, ne boční efekt `Math.max(0, x)`. Nula jako požadavek v UI je jen bug s malou cedulkou “feature”.

### Inventory

Inventory může obsahovat cokoli. To je designově v pořádku.

Ale stack je vždy stateless. Tzn. item, který má runtime state, běžící joby, uložené requirements, product inputs, stash charges nebo jinou per-instance paměť, nesmí být anonymně sloučen do stacku. Stateful item v inventory zabírá právě jedno místo, ideálně jako single-slot non-stackable instance nebo jako resetnutý stateless item podle explicitní policy.

Aktuální engine save model má inventory slot jako `itemId + quantity`, takže pro stabilizační fázi jsou možné dvě poctivé varianty:

1. Stashing / inventory placement stateful board actorů resetuje jejich runtime state a uloží je jako stateless item. Pak to musí být explicitní, testované a UX texty s tím musí počítat.
2. Inventory slot schema se rozšíří na discriminated union: `stack` pro stateless stacky a `instance` pro stateful/capability itemy. Pak musí place/stash/swap/merge respektovat instance identitu.

Nemíchat obě varianty potichu. To je přesně cesta k “mám jeden sapling, ale zároveň padesát saplingů a jeden z nich si pamatuje trauma z boardu”.

### GameSaveConfigSchema monotonic counters

`GameSaveConfigSchema` má hlídat nejen reference a bounds, ale i to, že `nextItemInstanceIndex`, `nextJobIndex` a `nextScheduledEventIndex` jsou větší než všechny už existující odpovídající ID v save.

Proč: pokud save obsahuje `job:7`, ale `nextJobIndex` je 7 nebo méně, další generated ID může collide-nout. V runtime se pak přepíše existující job/event/item a my budeme předstírat, že JavaScript je posedlý, i když jsme mu jen podstrčili rozbitou numerologii.

## Event flow audit

### Aktuální stav

Máme minimálně tři event/animation jazyky:

1. Engine domain events: `GameEventSchema` pod `src/v0/game/engine/model/GameEventSchema.ts`.
2. Visual bridge events: `ActionVisualEventSchema` pod `src/v0/play/action/ActionVisualEventSchema.ts`.
3. TileEngine gesture/drop animation contract: `TileEngine.DropAnimation` a motion requesty pod `src/v0/tile-engine`.

Runtime cesta dnes vypadá takhle:

- Engine action/tick vrátí `GameEngineResult { save, events, nextWakeAtMs }`.
- `GameRuntimeStore` vytvoří previous/current runtime view.
- `GameRuntimeVisualEffects` převede engine events přes `createActionVisualEventsFromGameEngineResult`.
- Bridge z toho udělá `ActionVisualEventSchema.Type[]`.
- `registerBoardMergeExitTiles` a `registerTileEngineEnterRequests` z toho registrují TileEngine motion requesty / transient tiles.

To je funkční, ale dost ukecané. A hlavně `ActionVisualEventSchema` dnes není čistý “animation event”. Je to směs:

- motion požadavků (`item.spawned`, `item.merged`)
- inventory cache/state hintů (`inventory.quantity_changed`)
- legacy aktivace (`activation.activated`, `activation.depleted`)
- doménových UI událostí (`craft.started`, `upgrade.started`)

Výsledek je střední jazyk, který není ani engine truth, ani přímo TileEngine command. Takové mezivrstvy mají jednu superschopnost: za půl roku nikdo neví, jestli jsou kontrakt, cache patch, debug log, nebo špatně pojmenovaný sen.

### Co je přímo špatně / podezřelé

- `createActionVisualEventsFromGameEvents` není exhaustive. Ignoruje `product.started`, `product.completed`, `product.blocked`, `craft.started`, `craft.completed`, `upgrade.completed`, `stash.depleted`, producer input store/withdraw a stored requirement store/withdraw. Něco z toho je správný no-op, ale musí to být explicitní no-op s testem, ne tiché propadnutí do nicoty.
- Move/swap engine akce (`moveBoardItemFx`, `swapBoardItemsFx`, `swapInventorySlotsFx`) vrací `events: []`, protože gesture animace řeší TileEngine lokálně při dropu. To je pochopitelné, ale znamená to, že `GameEvent` není plný state-diff stream. Buď to tak pojmenujme, nebo začněme emitovat domain events i pro move/swap.
- Merge visual bridge páruje `item.consumed(reason=merge-source)` s pozdějším `item.replaced(reason=merge-result)` přes dopředné hledání v poli. Funguje, ale je to křehká implicitní korelace. Engine by klidně mohl emitnout explicitní semantic event typu `item.merged` / `item.transformed` se source+target+result, a save mutace může pořád zůstat stejná.
- Visual reason enumy nejsou 1:1 s engine reason enumy. Např. engine má `producer-input-withdraw`, visual spawned reason enum ho aktuálně neobsahuje; bridge vrací přes type assertion. Type assertion tady schová drift, což je programátorská verze koberečku přes díru v podlaze.
- `ActionVisualEventSchema` obsahuje staré activation názvosloví, i když runtime engine už mluví o stash/craft/producer/stored requirements. To zvyšuje kognitivní bordel.

### Doporučený směr

Nedávat doménovým engine eventům UI animace přímo do schema. Engine musí zůstat React/TileEngine/browser agnostic.

Ale zrušit nebo osekat prostřední `ActionVisualEvent` jazyk. Preferovaná cesta:

1. `GameEvent` zůstane canonical domain event stream.
2. Dopsat explicitní `GameVisualEffectPlanner`, který bere `{ previous, current, result }` a vrací přímo:
   - board motion requests
   - inventory motion requests
   - transient board tiles
   - debug summary
3. Planner bude exhaustive nad `GameEventSchema` přes `ts-pattern` nebo explicitní switch s `assertNever`.
4. No-op domain eventy budou explicitně testované jako no-op.
5. Merge/replace/spawn sequencing se bude řešit v planneru, ne v dalším public event schema.

Alternativní menší krok, pokud nechceme hned řezat:

- Přejmenovat `ActionVisualEventSchema` na něco poctivějšího, třeba `RuntimeVisualEffectEventSchema`.
- Srovnat reason enumy s engine enumy.
- Odstranit `as ActionVisualEventSchema.Type` casty z bridge.
- Přidat exhaustive mapping/no-op coverage test pro všechny `GameEventSchema` typy.

Za mě je čistší první varianta. `ActionVisualEvent` je aktuálně překládací mezistát, který nevypadá, že by si zasloužil vlastní občanství.

## Stabilizační tasky v doporučeném pořadí

### T1: Craft single-job invariant

Cíl: jeden target item může mít nejvýše jeden běžící craft job.

Soubory:

- `src/v0/game/engine/fx/checkCraftStartReadinessFx.ts`
- `src/v0/game/engine/fx/startCraftFx.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/game/engine/fx/applyGameActionFx.test.ts`
- `src/v0/game/engine/model/GameSaveSchema.test.ts`

Implementace:

- `checkCraftStartReadinessFx` odmítne `craft.start`, pokud `save.craftJobs` už obsahuje job se stejným `targetItemInstanceId`.
- `GameSaveConfigSchema` odmítne save s více craft joby pro stejný target.
- Error reason může být nový `craft_in_progress`, nebo použít existující obecný action rejected reason, ale ať je čitelný.

Acceptance:

- Druhý `craft.start` na stejný target failne.
- Save se dvěma craft jobs na jeden target failne schema validací.
- Craft jobs na různé targety mohou běžet paralelně, pokud to design dovoluje.

### T2: Craft completion = replace/swap target za result

Cíl: dokončený craft změní target item na právě jeden výsledný item. Žádný output spawn bokem.

Soubory:

- `src/v0/game/engine/fx/completeCraftJobFx.ts`
- `src/v0/game/engine/model/GameEventSchema.ts`
- `src/v0/play/game-engine-bridge/createActionVisualEventsFromGameEvents.ts` nebo budoucí planner
- `src/v0/game/engine/fx/applyGameActionFx.test.ts`

Implementace:

- Na completion najít live target board item.
- Ověřit, že target stále odpovídá recipe.
- Delete craft job.
- Vyčistit runtime state targetu podle nové item identity (`removeBoardItemRuntimeState` nebo přesnější helper).
- Nastavit target `itemId = recipe.resultItemId`.
- Emitnout `craft.completed` + `item.replaced(reason: "craft-result" | nový reason)` nebo rovnou nový explicitní `craft.target_replaced` event.
- T2 rozhodnutí: stored craft requirements se při úspěšném craftu spotřebují do výsledku. Job už nenese `returnItems`; craft completion emituje `item.replaced(reason: "craft-result")`.

Acceptance:

- Blueprint craft po dokončení nezanechá blueprint na boardu.
- Výsledek je v původní buňce.
- Nevznikne extra result item v inventáři ani vedle targetu.
- Visual feedback ukáže transformaci/replacement, ne spawn vedle.

### T3: Normalizovat craft/stash atomicitu podle produceru

Status: DONE in `v0-stash-atomic-output-2026-06-18.md` + follow-up `v0-stash-full-open-output-2026-06-18.md`. Craft was already normalized by T2; stash open now applies the full remaining output batch atomically, depletes in one click, keeps sequential placement/visual event order, and scheduled board remove/replace events were removed.

Cíl: žádná gameplay state změna nesmí viset na scheduled spawn eventu jen kvůli animaci.

Soubory:

- `src/v0/game/engine/fx/openStashFx.ts`
- `src/v0/game/engine/fx/stashBoardItemFx.ts`
- `src/v0/game/engine/fx/completeCraftJobFx.ts`
- `src/v0/game/engine/fx/completeProducerJobFx.ts` jako vzor
- `src/v0/game/engine/fx/processScheduledGameEventsFx.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`

Implementace:

- Craft completion po T2 už nepotřebuje spawnovat output.
- Stash open by mělo output aplikovat atomicky přes `placeGameSaveItemsFx` / inventory placement, nebo persistovat blocked delivery state podobně jako producer.
- Scheduled item spawn nechat jen pro opravdu časově odložené doménové události, ne pro “chci to animovat postupně”.
- Sekvenční animace outputu musí vznikat z event metadata/planneru, ne z odkladu save mutace.

Acceptance:

- Po úspěšném stash open je save okamžitě hotový.
- Pokud není placement, stash state se nezmění nebo se uloží explicitní blocked delivery podle policy.
- Žádné success eventy typu `stash.opened` / `craft.completed` před skutečnou state změnou.
- Producer stávající blocked/retry behavior zůstane zachovaný.

### T4: Effective upgrade/config validation

Status: DONE in `v0-effective-upgrade-validation-2026-06-18.md`.

Cíl: schema/validator zachytí invalidní effective config vzniklý postupnými upgrady.

Soubory:

- `src/v0/game/config/GameConfigSchema.ts`
- `src/v0/game/engine/fx/buildConfigLayerFx.ts`
- `src/v0/game/engine/fx/applyConfigLayerFx.ts`
- `src/v0/game/engine/fx/upgradeFx.test.ts`
- config schema testy

Implementace:

- Přidat helper, který simuluje completed tier prefixy a validuje effective hodnoty.
- Zakázat negative/zero výsledky pro quantity/duration/cost/capacity/queue podle kontraktu.
- Rozlišit “quantity add” a případné budoucí “input remove” explicitně.
- Nedělat `Math.max(0, ...)` jako tichou normalizaci, která schová špatný config.

Acceptance:

- Upgrade, který sníží input quantity na 0 nebo méně, failne validaci.
- Upgrade, který sníží duration pod 0, failne validaci.
- Upgrade, který posune queue/capacity do invalidního stavu, failne validaci.
- Validace běží v CLI `game:validate` nad source i compiled configem.

### T5: Product input overlay scope explicitně vyjádřit

Cíl: product-line scoped upgrades zůstanou product-line scoped i přes reusable `inputRefId` authoring.

Soubory:

- `src/v0/game/config/readProductInputs.ts`
- `src/v0/game/engine/fx/buildConfigLayerFx.ts`
- `src/v0/game/engine/fx/applyConfigLayerFx.ts`
- `src/v0/game/engine/model/GameConfigLayerProductSchema.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`

Implementace možnosti:

- Menší varianta: schema zakáže sdílení `inputRefId` mezi produkty, pokud existuje product-scoped input upgrade. Drsné, ale jednoduché.
- Lepší varianta: effective config umí product-resolved inputs bez mutace top-level `config.inputs`. `readProductInputs` vrací product-specific resolved inputs.

Acceptance:

- Test se dvěma produkty sdílejícími inputRef buď failne authoring validací, nebo prokáže, že upgrade productu A nemění product B.
- Žádné “find first matching product layer” v `applyConfigLayerFx`, protože to je věštění z políčka.

### T6: Inventory stateless stack policy

Cíl: inventory může držet cokoli, ale stack zůstane stateless a stateful/capability item nesmí být anonymně sloučen bez explicitního resetu.

Soubory:

- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/play/game-engine-bridge/readRuntimeInventoryViewFromGameSave.ts`
- `src/v0/game/engine/fx/placeGameSaveInventoryItemsFx.ts`
- `src/v0/game/engine/fx/stashBoardItemFx.ts`
- `src/v0/game/engine/fx/placeInventoryItemOnBoardFx.ts`
- inventory placement/stash tests

Implementace rozhodnutí:

- Buď zavedeme `inventory.slots[] = { kind: "stack", itemId, quantity } | { kind: "instance", itemInstanceId, itemId } | null`.
- Nebo zachováme `itemId + quantity`, ale `stashBoardItemFx` explicitně resetuje state a schema/logic brání stackování čehokoliv, co nesmí být stateless.

Acceptance:

- Stateless resources stackují jako dnes.
- Stateful/capability item v inventáři neztratí state omylem; pokud ho ztratit má, je to explicitní reset path a test.
- Placement z inventory zpět na board vytvoří správný board actor/instance.

### T7: GameSaveConfigSchema monotonic ID counters

Cíl: save validation odmítne ID countery, které mohou způsobit collision.

Soubory:

- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/game/engine/model/GameSaveSchema.test.ts`
- ID generator helpers: `createGameItemInstanceIdFx`, `createGameJobIdFx`, `createGameScheduledEventIdFx`

Implementace:

- Parsovat známé ID prefixy (`item-instance:*`, `job:*`, `scheduled-event:*`).
- Spočítat max numeric suffix pro board items, jobs a scheduled events.
- Ověřit, že `next*Index > maxExistingSuffix`.
- Neznámé ID tvary buď nechat projít kvůli dev importům, nebo je zvlášť validovat podle současných generator kontraktů. Rozhodnout explicitně.

Acceptance:

- Save s `job:7` a `nextJobIndex: 7` failne.
- Save s `job:7` a `nextJobIndex: 8` projde.
- Totéž pro item instances a scheduled events.

### T8: Event flow cleanup / visual planner

Cíl: odstranit dvojí event jazyk tam, kde je to jen překládací bordel, nebo ho aspoň zpevnit tak, aby nelhal typově.

Soubory:

- `src/v0/game/engine/model/GameEventSchema.ts`
- `src/v0/play/action/ActionVisualEventSchema.ts`
- `src/v0/play/game-engine-bridge/createActionVisualEventsFromGameEvents.ts`
- `src/v0/play/runtime/GameRuntimeVisualEffects.tsx`
- `src/v0/play/tile-engine-motion/*`
- `src/v0/tile-engine/*`

Doporučená implementace:

- Nový planner přímo z `{ previous, current, result }` na TileEngine motion/transient requests.
- Exhaustive switch nad engine events.
- Explicitní no-op pro domain events, které nemají animaci.
- Zrušit nebo zmenšit `ActionVisualEventSchema`.

Menší implementace:

- Srovnat reason enumy.
- Zrušit casty v bridge.
- Dopsat exhaustive/no-op test pro všechny GameEvent typy.
- Přejmenovat staré activation vizuální eventy nebo je nahradit stash/craft/progress pojmy.

Acceptance:

- Přidání nového `GameEventSchema` typu rozbije test/compile, dokud nemá explicitní planner/no-op rozhodnutí.
- Visual planner neumí potichu spolknout doménový event.
- Merge visual korelace není založená na křehkém hledání “další item.replaced v poli” bez explicitního group/correlation kontraktu.

### T9: Průběžná code guidance hygiena při editaci

Cíl: když se při implementaci sáhne na soubor a je tam zjevné hovno, utrít ho. Ne plošný refactor. Ne archeologická válka.

Kontrolní body:

- Engine nesmí importovat React/TileEngine/Dexie/UI.
- TileEngine nesmí importovat Arkini domény.
- Gameplay state změny jdou přes typed engine action, ne React Query/useMutation.
- Save/config invariants patří do schema/config layeru, ne do náhodných UI/runtime helperů.
- Používat existující knihovny a patterny; nepsat custom mini-framework, pokud Effect/Zod/ts-pattern už dělá práci.
- Schemata držet pojmenovaná/exportovaná podle současné guidance, pokud se jich dotýkáme.
- Type assertion v bridge/planneru je podezřelý zápach. Pokud není nutný, pryč.

## Doporučené řezání do commitů

1. `craft-single-job-invariant`
2. `craft-target-replacement`
3. `stash-craft-atomic-output`
4. `effective-config-validation`
5. `product-input-overlay-scope` (next)
6. `inventory-stateless-stack-policy`
7. `save-id-counter-validation`
8. `visual-event-planner-cleanup`

Nedělat to v jednom mega commitu. Mega commit je jen zip bomb s lepším marketingem.
