# V0 GameConfig + tick engine brutal review

Datum: 2026-06-18
Base commit: `13f8b96 Place one item from seeded inventory stack`
Branch hygiene: aktuální `main` byl poslán do checkpoint branche `v0`, pak jsem se vrátil zpět na `main`.

Scope: hluboká statická revize GameConfigu, GameSave schema vrstvy, runtime tick/action engineu, config overlay/upgrades, placementu, craft/stash/producer flow, UI bridge komplexity a míst, kde se nám může logika začít větvit jak plevel po dešti. Tohle není patch, ale hygienická mapa pro stabilizační fázi.

## Stav tick engine pokrytí

Tick/action engine už umí hlavní herní osu:

- board move/swap/stash
- inventory exact placement a seeded nearest placement
- inventory slot swap
- source-owned merge pravidla, včetně directed/imprint pravidel
- producer input store/withdraw
- producer product line enable/disable
- producer product start s queue a maxQueueSize
- producer output completion s persisted blocked delivery a retry
- stash open/depletion
- craft start/completion
- stored requirement store/withdraw
- tile remove přes tool
- upgrade start/completion a effective config layer
- scheduled spawn/remove/replace eventy
- board-then-inventory placement se seedem přes `planEmptyBoardCellsFx`

Takže ne, engine už není hračka s jednou akcí. To je dobrá zpráva. Horší zpráva: několik mechanismů je modelově nedotažených a teď je přesně čas je seříznout, než nad tím postavíme další gameplay a budeme se tvářit překvapeně, že se to hýbe jak nábytek z papundeklu.

## Kritické / vysoká priorita

### 1. Craft job jde spustit víckrát na stejném targetu

Soubory:

- `src/v0/game/engine/fx/checkCraftStartReadinessFx.ts`
- `src/v0/game/engine/fx/startCraftFx.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`

`checkCraftStartReadinessFx` ověřuje recipe, target item, pasivní requirements, inputRefs a requirementRefs. Neověřuje ale, že pro `targetItemInstanceId` už neběží craft job.

UI bridge se tomu snaží bránit přes `readRuntimeCraftView`: jakmile běží job, phase už není `collecting_inputs`, takže běžné DnD inputy UI nepustí. Jenže engine sám je public kontrakt runtime akce. Engine nesmí spoléhat na to, že UI zrovna nebylo blbé, opožděné, debugované, nebo že někdo přes dev scenario nepošle druhý `craft.start`.

Doporučení:

- Přidat guard do `checkCraftStartReadinessFx`: žádný existující `save.craftJobs[*].targetItemInstanceId === action.targetItemInstanceId`.
- Přidat stejný invariant do `GameSaveConfigSchema`: max jeden running craft job per target.
- Dopsat test: druhý `craft.start` na stejný target failne.

Tohle je přesně bug typu “mám jednu rozestavěnou budovu a tři paralelní vesmíry, které ji dokončují”. Velmi fantasy, velmi špatně.

### 2. Craft completion target nemění ani nespotřebuje

Soubor:

- `src/v0/game/engine/fx/completeCraftJobFx.ts`

`completeCraftJobFx` po dokončení craftu udělá:

- preflight placement returnItems + result item
- smaže craft job
- naplánuje scheduled spawns
- emitne `craft.completed`

Ale target item na boardu zůstává beze změny. U současných building blueprintů to znamená, že blueprint zůstane na boardu a výsledná budova se spawnne vedle / do inventory. Pokud je to záměr, musíme to explicitně pojmenovat jako “craft station produces output and remains”. Pokud to záměr není, máme duplikátor blueprintů a budov.

Aktuální obsah configu vypadá spíš tak, že blueprint má být konstrukční target:

- `item:blueprint-lumber-camp` má `craftRecipeId: craft:lumber-camp`
- recipe `craft:lumber-camp` má `resultItemId: item:lumber-camp-1`

To čte přirozeně jako “blueprint + materiály => building”, ne “blueprint donekonečna plodí budovy”.

Doporučení:

- Rozhodnout model per recipe nebo per item: `completion: replace_target | spawn_output | remove_target_and_spawn`.
- Pro building blueprinty pravděpodobně použít `replace_target`: target itemInstance se změní na result item, runtime state se vyčistí přes `removeBoardItemRuntimeState`, emitne se `item.replaced`.
- Pro seed/sprout/sapling možná taky `replace_target`, protože zalévání věci by mělo růst, ne vedle sebe vyplivnout nový život jak levná tiskárna biomasy.
- Pokud opravdu chceme “craft station outputs item”, musí to být explicitní config mode, ne tichý default.

Tohle je designově největší otazník celé craft vrstvy.

### 3. Craft a stash pořád používají křehký “preflight teď, spawn později” model

Soubory:

- `src/v0/game/engine/fx/openStashFx.ts`
- `src/v0/game/engine/fx/completeCraftJobFx.ts`
- `src/v0/game/engine/fx/processScheduledGameEventsFx.ts`
- `src/v0/game/engine/fx/completeProducerJobFx.ts`

Producer completion je dnes nejzdravější z trojice: výstup se rollne jednou, při blokaci se uloží do `producerJobs[jobId].delivery`, job zůstane živý a drží queue slot. To je správně.

Craft a stash jsou slabší:

- udělají placement preflight na aktuálním save
- emitnou success-like eventy (`craft.completed`, `stash.opened`, u poslední charge i `stash.depleted`)
- skutečné itemy se vytvoří až přes scheduled spawn eventy

Auto-ticker to většinou zpracuje hned, protože `nextWakeAtMs` je `nowMs`. Jenže “většinou hned” není atomicita, to je jen naděje s lepším PR. Mezi action resultem a tickem může přijít jiná akce, jiný runtime update, dev replace save, nebo prostě blbý timing. Pak se preflight validace může stát lží.

Doporučení:

- Craft a stash completion/open by měly buď:
  - rovnou aplikovat placement stejně jako producer completion, nebo
  - mít persisted delivery state se stejnou blocked/retry semantikou jako producer.
- Neemitovat `craft.completed` / `stash.depleted` předtím, než je skutečný state hotový.
- Pokud chceme scheduled spawns kvůli sekvenční animaci, oddělit gameplay state od visual sequencing. Save má být pravda hned; animace si může itemy načasovat nad event streamem.

Tady se nám míchá gameplay atomicita s animačním timingem. To je klasická past: člověk chce hezké rozpadnutí itemů, a najednou má v save Schrödingerovu bednu.

### 4. Effective config layer mutuje globální `inputs`, takže product-specific upgrade není product-specific

Soubory:

- `src/v0/game/engine/fx/buildConfigLayerFx.ts`
- `src/v0/game/engine/fx/applyConfigLayerFx.ts`
- `src/v0/game/config/readProductInputs.ts`

Config model říká: produkty referencují named input definition přes `inputRefId`. Upgrade effect `product.input.quantity.add` je ale product-scoped.

Implementace layeru pak při aplikaci udělá globální modifikaci `config.inputs[inputRefId].inputs[*].quantity`. `applyConfigLayerFx` hledá první product layer, který má daný `inputRefId`, a přepíše quantity v shared input definition.

Dnes config používá jediný input ref pro jediný product:

- `input:coal-mine-1-rations` používá jen `product:coal-mine-1`

Takže se to aktuálně neprojeví. Ale schema reuse inputRefů povoluje a README to dokonce popisuje jako named reusable definitions. Jakmile dva produkty sdílí inputRef a jeden dostane upgrade quantity, přepíše to oba. Krásný malý sabotér, co čeká na obsahový pass.

Doporučení:

- Buď zakázat sdílení `inputRefId` mezi produkty, pokud chceme product-scoped input upgrades nad současným modelem.
- Nebo změnit effective config model tak, aby product měl resolved inputs po aplikaci layeru, místo aby layer mutoval globální input definition.
- Dopsat test: dva produkty sdílí inputRef, upgrade jednoho nesmí změnit druhý.

Za mě čistší varianta: `GameConfig.inputs` může zůstat authoring template, ale effective runtime by měl umět číst product-specific resolved inputs. Globální shared template není místo pro lokální upgrade.

### 5. Upgrade může snížit input quantity na nulu

Soubor:

- `src/v0/game/engine/fx/buildConfigLayerFx.ts`

`product.input.quantity.add` se aplikuje jako:

`Math.max(0, inputLayer.quantity + effect.quantity)`

Base schema pro input quantity chce positive integer. Effective config tím může vytvořit input s `quantity: 0`, což už není stejný kontrakt. Pak začne být divné všechno kolem readiness:

- `checkActivationInputsFx` čeká přesné selected quantity podle inputu
- pro quantity 0 by měl hráč dodat nic
- storage/input capacity může pořád existovat
- UI může ukázat řádek, který chce 0 ks

Tohle je runtime config, který se tváří validně jen proto, že už neprošel stejnou validací jako base config.

Doporučení:

- Nedovolit `quantity < 1`, pokud input slot dál existuje.
- Nebo pokud quantity spadne na 0, slot z effective product inputs odstranit.
- Dopsat test na upgrade, který quantity sníží na 0.
- Dlouhodobě validovat effective config po aplikaci layeru alespoň v dev/test režimu.

Nula jako požadavek je cute, ale cute tady znamená “další větev v UI a runtime bez skutečné herní hodnoty”. Pryč s tím.

### 6. Inventory je stateless stack, ale config dovoluje craft-capable stackable itemy

Soubory:

- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/game/engine/fx/stashBoardItemFx.ts`
- `game/arkini.game.json`

Inventory slot je pouze:

- `itemId`
- `quantity`

Žádné `itemInstanceId`, žádný per-item state, žádné running joby, žádné stored requirements. To je v pohodě pro twig/plank/stone. Není to v pohodě pro věci, které umí producer/stash/craft runtime.

Config dnes má hodně `craftRecipeId` itemů s `maxStackSize > 1`:

- blueprinty `maxStackSize` 4/5
- `item:seed` maxStackSize 50 a zároveň `craftRecipeId`
- `item:sprout` maxStackSize 50 a zároveň `craftRecipeId`
- `item:sapling` maxStackSize 15 a zároveň `craftRecipeId`

`stashBoardItemFx` navíc při přesunu board itemu do inventory smaže runtime state přes `removeBoardItemRuntimeState`, a pak uloží jen `itemId + quantity`. Tím se z board instance stane anonymní stacková jednotka.

Možná je to záměr: stashing resetuje běžící práci. Ale pokud ano, musí to být tvrdě deklarované. Jinak budeme mít itemy, které na boardu jsou stateful aktéři a v inventáři jen beztvará hmota. To je UX a modelový rozpor.

Doporučení:

- Rozdělit itemy na `stackableResource` vs `boardActor` / `capabilityItem`.
- Capability itemy (`producerId`, `stashId`, `craftRecipeId`, možná `removeBy`) buď vynutit `maxStackSize: 1`, nebo zavést inventory discriminated union: `stack` vs `instance`.
- Pokud stashing resetuje state, napsat to explicitně do action/event semantiky a UI textů.
- Jestli seed/sprout/sapling mají růst přes craft, zvážit, jestli vůbec mají být inventory stacky s craft state až po placementu. Tohle může být správně, ale musí být vědomé.

Teď je schema příliš tolerantní. Tolerantní schema je v rané hře fajn, dokud nezačne tolerovat kraviny.

### 7. GameSave validace nehlídá monotonicitu ID counterů

Soubory:

- `src/v0/game/engine/model/GameSaveSchema.ts`
- `src/v0/game/engine/fx/createGameItemInstanceIdFx.ts`
- `src/v0/game/engine/fx/createGameJobIdFx.ts`
- `src/v0/game/engine/fx/createGameScheduledEventIdFx.ts`

ID generátory používají countery:

- `item-instance:${save.nextItemInstanceIndex}`
- `job:${save.nextJobIndex}`
- `scheduled-event:${save.nextScheduledEventIndex}`

`GameSaveConfigSchema` validuje spoustu dobrých věcí, ale nevaliduje, že counter je větší než všechny existující IDs v příslušných mapách. Pokud se do save dostane `nextItemInstanceIndex` nižší než existující instance, další create přepíše existující item key. Stejná story pro jobs a scheduled events.

Doporučení:

- V `GameSaveConfigSchema.superRefine` dopočítat max suffix pro každou kategorii a vyžadovat `next*Index > maxExisting`.
- Dopsat test na collision save.

Tohle není sexy bug. Je to účetní chyba. A účetní chyby jsou ty, co pak zničí impérium, protože nikdo nečekal drama v tabulce.

### 8. Runtime adapter nevaliduje save po dispatch/tick/replace

Soubor:

- `src/v0/game/engine/runtime/RuntimeGameEngineAdapter.ts`

Dexie storage validuje `GameSaveConfigSchema` při load/save, což je správně. Engine adapter ale po `dispatch`, `tick` a `replaceSave` commitne result bez config-aware validace.

Nechci tím říct, že produkční runtime má po každé akci pálit drahý Zod parse. Ale v dev/test režimu je to extrémně užitečná pojistka. Teď může engine bug vytvořit invalidní save, UI s ním chvíli žije a storage ho při persist/load později odstřelí. To je debugging chuťovka pro lidi, co se nemají rádi.

Doporučení:

- Přidat dev-only invariant assert po engine resultu: `GameSaveConfigSchema.parse({ save: result.save, config: effectiveConfig/base config podle kontraktu })`.
- Nebo minimálně přidat test helper, který každou engine akci/tick v testech validuje.
- `replaceSave` by měl validovat vždy, protože je to externí vstup do runtime.

Storage wipe je recovery mechanika, ne runtime validator.

## Střední priorita / architektonický dluh

### 9. `GameConfigSchema.ts` je už moc velký monolit

Soubor:

- `src/v0/game/config/GameConfigSchema.ts`

Má přes tisíc řádků a drží:

- strukturální Zod schemata
- doménové authoring komentáře
- semantic `superRefine`
- helpery pro duplicity, inputy, requirements, references
- starting state validace
- upgrade effect validace

Je dobře, že máme jednu centrální schema bránu. Není dobře, že všechno bydlí v jednom božím objektu s vlastním počasím.

Doporučení:

- Nerozbíjet kontrakt, ale rozdělit soubory podle domén:
  - `GameMetaSchema`
  - `ItemDefinitionSchema`
  - `MergeDefinitionSchema`
  - `InputDefinitionSchema`
  - `ProducerDefinitionSchema`
  - `StashDefinitionSchema`
  - `CraftRecipeDefinitionSchema`
  - `ProductDefinitionSchema`
  - `UpgradeDefinitionSchema`
  - `StartingStateSchema`
  - `validateGameConfigReferences`
  - `validateGameConfigAuthoringInvariants`
- `parseGameConfig` zůstane jeden public vstup.

Cíl není udělat dvacet malých pekel. Cíl je, aby se další člověk nemusel nořit do tisícřádkové jeskyně pokaždé, když chce přidat jeden enum.

### 10. `GameSaveSchema.ts` validace je dobrá, ale začíná být stejný monolit

Soubor:

- `src/v0/game/engine/model/GameSaveSchema.ts`

Pozitivum: `GameSaveConfigSchema` je přesně správné místo pro save invariants. Negativum: soubor začíná kombinovat raw schema, config-aware helpery, effective queue calculations, stored requirement capacity logic a scheduled event validaci.

Doporučení:

- Nechat public exporty stejné.
- Vytáhnout validator helpery do doménových interních souborů:
  - board/inventory invariants
  - producer invariants
  - craft invariants
  - upgrade invariants
  - stash/stored requirements invariants
  - scheduled event invariants
- Přidat explicitní testy pro každý blok.

Tohle není hořící bug. Je to moment, kdy se z “přehledně centrální” začíná stávat “centrálně nepřehledné”.

### 11. Action dispatch/readiness má duplikované branch listy

Soubory:

- `src/v0/game/engine/fx/applyGameActionFx.ts`
- `src/v0/game/engine/fx/readActionReadinessFx.ts`
- `src/v0/game/engine/model/GameActionSchema.ts`

Každá nová akce dnes znamená upravit:

- action schema union
- apply dispatch
- readiness dispatch
- často visual event bridge
- často DnD/drop routing

`ts-pattern` exhaustive match je dobré. Ale branch seznamy se budou větvit a readiness/apply můžou začít driftovat.

Doporučení:

- Zatím nepanikařit, je to čitelné.
- Jakmile přibudou další akce, zvážit action handler registry s jedním místem pro `schema/apply/readiness` metadata.
- Neudělat z toho framework. Stačí mapa, ne nový chrám.

### 12. `readRuntimeBoardViewFromGameSave.ts` je moc chytrý bridge

Soubor:

- `src/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave.ts`

Soubor má přes 500 řádků a počítá dost doménových věcí:

- stored requirement progress
- producer input rows/readiness
- queue/running/block state
- craft phases
- stash activation
- accepted item IDs pro DnD hints
- upgrade/craft/producer view mapping

Je správně, že UI čte view a nehrabe se přímo v engine internals. Ale část helperů je doménová read-model logika, ne čistý React bridge. Tohle může driftovat od readiness a action rules.

Doporučení:

- Vytáhnout čisté read-model helpery do engine/play shared pure layeru bez Reactu.
- UI bridge by měl hlavně mapovat engine read model na staré view typy, ne znovu interpretovat pravidla.
- DnD accepted item IDs musí být odvozené ze stejného rozhodovacího kontraktu jako action readiness, jinak budeme zas lovit hover/drop parity bugy.

### 13. Stored requirement capacity kombinuje producer + product requirements přes max, ne součet

Soubory:

- `src/v0/game/engine/fx/readStoredRequirementSlotsFx.ts`
- `src/v0/game/engine/model/GameSaveSchema.ts`

Stored requirement slots pro producer target se skládají z:

- producer-level requirements
- requirements všech product lines

Validace capacity pro uložený item používá `Math.max(...matchingSlots.map(capacity))`. Pokud producer-level requirement a product-level requirement budou chtít stejný item, kapacita nebude součet, ale maximum.

`GameConfigSchema` zakazuje duplicate requirements v rámci jednoho requirement listu, ale ne napříč producer + product lines při agregaci na jeden target.

Možná je to záměr: uložený requirement stejného itemu na targetu reprezentuje sdílený durable gate. Pak max dává smysl. Pokud ale dvě produktové linky potřebují separátní storage bucket stejného itemu, max je špatně.

Doporučení:

- Rozhodnout semantiku:
  - shared durable requirement per target+item => max je OK, ale zdokumentovat
  - per-product stored requirement => storage key musí obsahovat productId/requirementId
- Přidat test na producer-level + product-level same item.

Tady nejde o aktuální config. Jde o to, že schema dovoluje nejasnost a engine si potichu vybral interpretaci.

### 14. Scheduled event exclusiveKey blocked behavior potřebuje test

Soubor:

- `src/v0/game/engine/fx/processScheduledGameEventsFx.ts`

Když due scheduled event s `exclusiveKey` zablokuje, key se označí jako processed a další due eventy se stejným key v tom ticku přeskočí. To může být správně, protože nechceme stejný výstup rvát do plného prostoru víckrát.

Ale je to behavior, který by měl mít test a komentář. Aktuálně je to implicitní.

Doporučení:

- Test: blocked event s exclusiveKey zabrání druhému eventu stejného key v daném ticku.
- Test: po retry delayi se retry zkusí znovu bez event spamu.

### 15. Product `started` event je u queued jobu sémanticky divný

Soubor:

- `src/v0/game/engine/fx/startProducerProductFx.ts`

Queue model je dobrý: další job startuje až po posledním jobu stejného produceru. Event `product.started` se ale emitne hned při zařazení, i když `startedAtMs` může být v budoucnosti.

To není nutně bug, ale pojmenování je ošidné. UI musí chápat, že event znamená “job created/queued”, ne “aktivní práce právě začala”.

Doporučení:

- Buď event přejmenovat na `product.queued`, nebo přidat explicitní `queuedAtMs` a u UI být velmi opatrný.
- Board progress už správně ukazuje jen active-work, ne future queued jobs. Držet tuhle semantiku všude.

### 16. Low-level consume/store utility spoléhají až moc na readiness

Příklady:

- `src/v0/game/engine/fx/consumeProducerStoredInputsFx.ts`
- `src/v0/game/engine/fx/storeProducerInputFx.ts`
- `src/v0/game/engine/fx/storeStoredRequirementFx.ts`

Většina flows má readiness check před mutací. To je správně. Ale nízkoúrovňové mutátory by měly aspoň assertovat, že nedělají záporné quantity/capacity overfill. Jinak se při budoucím calleru dostaneme do stavu “caller měl vědět”, což je oblíbený epitaf runtime bugů.

Doporučení:

- Přidat v mutátorech defensive guards pro overspend/overfill.
- Readiness zůstane UX/action gate; mutátor zůstane integritní poslední záchrana.

### 17. Config schema dovoluje schopnostní kombinace bez jasné politiky

Soubor:

- `src/v0/game/config/GameConfigSchema.ts`

Item může mít současně různé capability refs:

- `producerId`
- `stashId`
- `craftRecipeId`
- `removeBy`
- `mergeIds`

Možná to chceme, protože emergentní itemy jsou fajn. Ale stabilizační fáze potřebuje explicitní pravidla:

- Může být item producer i craft target?
- Může být stash craft target?
- Může mít producer mergeIds, které ho nahradí, zatímco má running jobs?
- Co se stane s stored requirements při merge/replace/remove/stash? Dnes `removeBoardItemRuntimeState` smaže runtime state.

Doporučení:

- Sepsat capability matrix.
- Co není schválené, zakázat v `GameConfigSchema`.
- Co je schválené, otestovat přes engine akce.

Tolerovat všechny kombinace znamená, že engine musí umět všechny kombinace. A to je přesně ten typ dluhu, který se tváří jako flexibilita.

## Co je naopak dobře

### Producer delivery je dobrý vzor

`completeProducerJobFx` je momentálně nejlepší reference pro completion flow:

- output se rollne jednou
- při blokaci se uloží do save
- job zůstane živý a drží queue capacity
- retry má delay
- event spam je omezený
- placement mutuje cloned save a rezervuje buňky all-or-nothing

Craft/stash by se tomu měly přiblížit.

### `GameSaveConfigSchema` je správný směr

Centrální config-aware save validace je přesně správně. To, že ještě nechybí pár invariantů, neznamená, že směr je špatně. Naopak: konečně máme jedno místo, kam tyhle pojistky cpát, místo aby se válely v UI/storage/fx jako ponožky po bytě.

### Merge pravidla jsou teď správně source-owned

`resolveExecutableItemMergeRule` bere jen source-owned rule. Reverse-directed imprint pravidla se používají jen k blokaci swap fallbacku, ne jako executable merge. To odpovídá poslednímu designu:

- `water -> twig` funguje, pokud je napsané na water
- `twig -> water` nefunguje, pokud není napsané na twig

Tohle držet. Engine si nesmí vymýšlet obousměrnost, protože “to hráč asi myslel”. Engine není terapeut.

### Placement planner je dobrý centrální kus

`planEmptyBoardCellsFx` + `placeGameSaveItemsFx` jsou rozumný základ:

- scan order bez seedu
- Manhattan nearest se seedem
- all-or-nothing clone placement
- producer/stash/craft/inventory seeded placement používají stejný koncept

Tady jen hlídat, aby se kvůli UI animacím nezačaly dělat vedlejší placement algoritmy.

### Runtime store + useSyncExternalStore je zdravější než React Query gameplay cache

`RuntimeGameEngineAdapter` + `GameRuntimeStore` je čistší než starý SQL/query/mutation bordel. Stav je jeden save, actions jsou typed, view se derivuje. To je dobrý směr. Teď je potřeba dotáhnout invarianty, ne couvat zpět.

## Doporučené pořadí stabilizačního passu

1. Přidat craft target single-job invariant do readiness + `GameSaveConfigSchema` + testy.
2. Rozhodnout craft completion semantiku: target replace/remove/spawn. U building blueprintů pravděpodobně `replace_target`.
3. Srovnat craft/stash completion atomicitu podle producer delivery vzoru nebo explicitně oddělit gameplay save od visual scheduled sequencing.
4. Opravit config layer pro product input quantity: žádná globální mutace shared `inputs`, žádná effective quantity 0 bez explicitního odstranění slotu.
5. Přidat counter monotonicity validaci do `GameSaveConfigSchema`.
6. Vyjasnit capability item policy: stackable stateless resources vs stateful board actors. Zakázat nechtěné kombinace v `GameConfigSchema`.
7. Přidat dev/test post-action save validation do engine runtime/test helperu.
8. Rozdělit `GameConfigSchema.ts` a později `GameSaveSchema.ts` na doménové části, bez změny public parse/save kontraktu.
9. Vytáhnout část read model logiky z `readRuntimeBoardViewFromGameSave.ts`, aby UI bridge neduploval doménová pravidla.
10. Dopsat testy na scheduled exclusiveKey blocked behavior a stored requirement capacity semantics.

## Krátký verdikt

Engine už umí dost na to, aby mohl být skutečný runtime základ. Není to zahození a přepis od nuly. Ale stabilizační pass musí být tvrdý: nejdřív craft semantics, atomic completion, effective config layer a save invariants. Dokud tohle nesedí, další gameplay mechaniky budou jen nové patro na baráku, kde ještě nikdo nedotáhl nosné zdi.

Největší riziko není, že tick engine něco vůbec neumí. Největší riziko je, že některé věci umí “skoro správně” a schema je pouští moc široce. A “skoro správně” je ve hře často horší než fail, protože hráč dostane bug až po třech akcích a my pak budeme věštit z event streamu jak banda šamanů s TypeScriptem.
