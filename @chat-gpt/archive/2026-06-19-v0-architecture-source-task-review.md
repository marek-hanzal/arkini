# V0 architecture/source/task review

Datum: 2026-06-19  
Base commit: `1c58c9f Lighten tile engine visibility in dark mode`  
Scope: review tasků, zdrojáků a mentální zátěže mimo ekonomiku hry. Zaměřeno na obecnou architekturu, komplexitu cest, místa těžká na udržení v hlavě a brutální zjednodušení, která dávají smysl i za cenu většího řezu.

## Kontrolní běhy

Prošel jsem repo staticky i přes základní gate:

- `npm run format:check` prošel, ale Biome dál warninguje nad `game/arkini.assets.json`, protože generated assets JSON má cca 1.1 MiB a překračuje defaultní 1 MiB limit.
- `npm run game:validate -- game/arkini` prošel: 66 items, 39 resources.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` prošel: 66 items, 39 resources.
- `npm run dc` prošel bez dependency-cruiser violations.
- `npm run typecheck` prošel.
- `npm run test` prošel: 222 testů / 41 files.
- `npm run build` prošel, ale Vite dál hlásí large chunk warning.

Repo stav po review: zdrojáky byly upravené jen tímto reportem. Ignorované lokální artefakty zůstávají `node_modules/`, `dist/`, `package-lock.json`.

## Hrubá mapa runtime cesty

Aktuální aktivní cesta je zdravější než starý SQL/cache/runtime hybrid:

1. `src/app/main.tsx` bootuje Router.
2. `HomeScreen` renderuje `PlayShell`.
3. `PlayShell` připojí `GameRuntimeProvider`.
4. `GameRuntimeProvider` volá `createPersistentGameRuntimeStore`.
5. `createPersistentGameRuntimeStore` bere `defaultGameConfig` z compiled JSONu, spočítá hash, načte Dexie save a vytvoří `RuntimeGameEngineAdapter` + `GameRuntimeStore`.
6. `RuntimeGameEngineAdapter` drží `{ config, effectiveConfig, save, lastEvents, nextWakeAtMs }`.
7. React čte přes `useGameRuntimeSelector`, tedy přes `useSyncExternalStore` nad jedním runtime snapshotem.
8. Board/inventory UI si derivují view přes `play/runtime/readers` a `play/game-engine-bridge`.
9. TileEngine je generický interaction/motion povrch.
10. Drop se přeloží přes `resolveDrop` / `resolve*DropAction` / `useGameRuntimeDropActions` na engine action.
11. `applyGameActionFx` a `runGameTickFx` vrací nový `GameSave` + `GameEvent[]`.
12. `GameRuntimeVisualEffects` vezme `GameEvent[]`, vyrobí visual plan a pošle animace do TileEngine stores.
13. Persistence je tenký Dexie wrapper okolo runtime store, ne gameplay source of truth.

Verdikt: source-of-truth se konečně přestal tvářit jako pětihlavá hydra. Runtime truth je `GameSave + GameConfig`, React Query a SQLite gameplay vrstva jsou pryč. To je velký posun správným směrem.

## Co už máme

Máme jeden aktivní gameplay runtime přes `RuntimeGameEngineAdapter` a `GameRuntimeStore`. Storage do toho nemluví, jen načte a ukládá save. To je správně.

Máme compiled/validated JSON config jako aktivní statickou pravdu. `defaultGameConfig` importuje `game/arkini.game.json`, runtime jede proti `GameConfigSchema`, ne proti starému TS manifestu.

Máme centrální `GameSaveConfigSchema`, která hlídá velkou část invariants: board bounds, duplicate cells, inventory slot count, stack max size, producer queue size, single craft job per target, producer/craft/stored input capacities, upgrade joby, scheduled events a další.

Máme sjednocený placement základ přes `placeGameSaveItemsFx` a seedované hledání volných buněk. Producer/stash/inventory placement už nestojí na třech různých lokálních heuristikách.

Máme producer queue a blocked delivery model, který drží job živý, nerolluje výstup znovu a retryuje delivery. To je jeden z nejzdravějších kusů současného engine.

Máme craft completion jako replace target flow. Starší problém “blueprint vyplivne budovu a zůstane na boardu” je opravený.

Máme stash open atomic flow. Starší preflight/scheduled spawn schizofrenie je pryč, stash rovnou umisťuje output do save.

Máme TileEngine jako generickou vrstvu bez herních importů. To držet jak psa na vodítku, protože jakmile začne TileEngine znát Arkini itemy, máme znovu guláš.

Máme test coverage výrazně silnější než před pár průchody: 222 testů, hlavně engine, schema, drop a visual bridge. Zelené testy nejsou svatá voda, ale už to není prázdný rituál.

## Co ještě nemáme / co je rozdělané nebo nebezpečně neurčité

Nemáme uklizené staré TS manifest fosilie. Aktivní runtime jede z JSONu, ale `src/v0/manifest/config/*`, staré manifest validation helpers a část starých typů pořád leží v repu. Z produkční app cesty jsou dnes potřeba hlavně ID schema/type soubory typu `GameItemIdSchema`, `GameResourceIdSchema`, `manifestId`. Zbytek je historická vrstva, která zvyšuje mentální noise.

Nemáme jednotný interaction planner. Drop rozhodnutí se dnes dělá v několika vrstvách: UI intent, board drop action, inventory drop action, runtime drop actions a nakonec engine readiness/apply. To je největší zdroj “držet v hlavě moc věcí najednou”.

Nemáme jeden společný kontrakt pro readiness + apply. `readActionReadinessFx` a `applyGameActionFx` mají paralelní dispatch listy. Některé akce jsou v readiness prakticky “ready, věř mi bro” a skutečná validace proběhne až při apply. To může být OK jako fallback, ale není OK jako dlouhodobá UI pravda.

Nemáme rozdělené schema monolity. `GameConfigSchema.ts` má cca 1599 non-empty/non-comment řádků, `GameSaveSchema.ts` cca 1113. Jsou centrální a správně důležité, ale už jsou moc velké na běžnou práci bez bolesti.

Nemáme rozdělený board read-model bridge. `readRuntimeBoardViewFromGameSave.ts` má cca 532 řádků a skládá craft, stash, producer, requirements, queue, DnD accepted IDs a progress. UI má číst view, to je správně. Ale tenhle bridge už je doménový interpreter číslo 2.

Nemáme úplně čistou effective config layer semantiku. `product.input.quantity.add` dál modifikuje `config.inputs[inputRefId]` globálně podle product layeru. Pokud budou dva produkty sdílet inputRef, product-specific upgrade může změnit oba. Navíc effective quantity může spadnout na 0, protože build layer jen přičítá. To je tichý modelový bug čekající na obsahový pass.

Nemáme jasnou capability matrix itemů. Config dovoluje itemům kombinovat craft/producer/stash/remove/merge schopnosti poměrně volně. Něco chceme, něco je náhodná díra. Engine pak musí implicitně podporovat kombinace, které jsme nikdy vědomě neschválili.

Nemáme dořešené scheduled events jako aktivní koncept. Save schema, tests a tick je podporují, ale produkční cesta dnes skoro nic nového nescheduluje. Po opravách producer/stash/craft atomicity může být scheduled event vrstva buď budoucí nástroj, nebo mrtvá složitost. Teď visí mezi tím.

Nemáme dostatečně tvrdé persistence retry. `connectGameRuntimeSavePersistence` při failu `storage.save` zavolá `onError`, ale pending save už předtím zahodí. Transientní IndexedDB/Dexie fail může znamenat, že poslední save změna nebude durable, dokud nepřijde další runtime update. To je přesně ten typ bugů, kde hráč přijde o progress a my se budeme tvářit, že prohlížeč je zlý bůh.

Nemáme čisté docs. Root `README.md` na začátku správně říká, že aktivní runtime je `RuntimeGameEngineAdapter` a compiled JSON config, ale o pár řádků níž pořád tvrdí, že gameplay source of truth je `src/v0/manifest/GameConfig.ts`. To je dokumentační schizofrenie. Člověk pak otevře repo a má chuť zavolat exorcistu.

## Největší mentální zátěž: drop/interakce

Největší problém není engine. Největší problém je cesta od “táhnu item na item” k “co se má stát”.

Dnes se rozhodování tříští zhruba takhle:

- `resolveDropIntent` nad `BoardViewItem` rozhoduje merge / craft-input / producer-input / stored-requirement / swap / reject.
- `resolveBoardCellDropAction` z intentu skládá board drop action.
- `resolveInventoryCellDropAction` skládá podobnou, ale ne stejnou logiku pro inventory source.
- `useGameRuntimeDropActions.dispatchApplyItemToBoardItem` si znovu čte raw `GameSave` a `GameConfig` a znovu rozhoduje merge vs stored requirement vs craft input vs producer input vs stash input.
- Engine readiness/apply validuje znovu.

Část toho je zdravá: UI preview nemůže být jediná pravda, engine musí validovat. Ale současná podoba znamená, že máme minimálně tři podobné interpretery. Jakmile přidáme nový interaction typ, budeme upravovat víc míst a modlit se, že hover feedback, drop dispatch a engine výsledek zůstanou stejné. Lidstvo vymyslelo opakování chyb s obdivuhodnou vytrvalostí.

### Brutální zjednodušení

Zavést jeden doménový `planItemInteraction` / `resolveItemApplicationPlan` kontrakt mimo React:

- vstup: `config`, `save`, `sourceRef`, `targetRef`, případně `nowMs`
- výstup: discriminated union `InteractionPlan`
  - `ignore`
  - `reject(reason)`
  - `move`
  - `swap`
  - `merge`
  - `storeStoredRequirement`
  - `storeCraftInput`
  - `storeProducerInput`
  - `openStashWithInput`
  - `placeInventoryItem`
- plan obsahuje engine `GameAction`, pokud je vykonatelný
- UI feedback se odvodí z planu, ne z paralelního view-only intentu
- engine pořád validuje při apply, ale UI už nepíše vlastní mini-engine

`ts-pattern` sem sedí výborně: exhaustive match nad `{ source.kind, target.kind }`, pak exhaustive match nad plánem. Nevyhazovat knihovnu, naopak ji použít tam, kde nám hlídá větvení.

## Druhá největší zátěž: action dispatch/readiness drift

`applyGameActionFx` je dnes celkem rozumný exhaustive `ts-pattern` dispatch. `readActionReadinessFx` je paralelní dispatch. Problém je drift.

U některých akcí readiness skutečně něco ověřuje. U jiných vrací jen success, protože apply si to pak vyřeší. To je v engine bezpečné, ale pro UI polopravda. UI pak může tvrdit, že něco je ready, zatímco apply později odmítne. Fajn pro fail-safe, blbé pro mentální model.

### Brutální zjednodušení

U každé akce mít jeden action handler modul s párem:

- `readiness(props)`
- `apply(props)`

Nemusí to být framework. Stačí doménový handler kontrakt, který pořád používá `ts-pattern` na public dispatchi. Pointa je, že když přidáš akci, nejde zapomenout na readiness nebo ji nechat jako falešné `Effect.void`.

Alternativa: readiness pro většinu akcí běží přes stejný check efekt jako apply, jen bez mutace. To už částečně máme u producer/craft/stash. Chce to dotáhnout plošně.

## Třetí zátěž: schema monolity

Centrální schema vrstva je správně. Rozházet validace po runtime/storage/UI by byla architektonická krádež na vlastním baráku. Ale jeden soubor přes tisíc řádků začíná být moc.

`GameConfigSchema.ts` drží:

- raw Zod shapes
- komentovanou authoring dokumentaci
- reference validation
- starting state validation
- upgrade effect validation
- capability-ish pravidla

`GameSaveSchema.ts` drží:

- raw save shape
- config-aware board/inventory validaci
- producer queue validaci
- producer input validaci
- craft job/input validaci
- upgrade job validaci
- stored requirements
- stash state
- scheduled events

### Brutální zjednodušení

Nechat public exports stejné, ale rozdělit interní validátory podle domén:

- `config/schema/ItemDefinitionSchema.ts`
- `config/schema/ProducerDefinitionSchema.ts`
- `config/schema/ProductDefinitionSchema.ts`
- `config/schema/CraftRecipeDefinitionSchema.ts`
- `config/schema/UpgradeDefinitionSchema.ts`
- `config/schema/StartingStateSchema.ts`
- `config/validation/validateGameConfigReferences.ts`
- `config/validation/validateGameConfigAuthoringInvariants.ts`
- `engine/model/save/validateBoardSave.ts`
- `engine/model/save/validateInventorySave.ts`
- `engine/model/save/validateProducerSave.ts`
- `engine/model/save/validateCraftSave.ts`
- `engine/model/save/validateUpgradeSave.ts`
- `engine/model/save/validateScheduledEventsSave.ts`

Nejde o estetiku. Jde o to, aby změna producer inputu nenutila člověka scrollovat přes craft, upgrades a startovní state jak přes účetní knihu z pekla.

## Čtvrtá zátěž: board view bridge

`readRuntimeBoardViewFromGameSave.ts` je dnes most mezi engine save a staršími UI view typy. To je v pořádku. Jenže zároveň počítá moc doménových rozhodnutí:

- co je missing requirement
- co je stored requirement capacity
- které product lines jsou enabled
- kolik inputů je stored
- kdy je product in progress
- craft phase a accepted input ids
- stash/producers activation view
- delivery blocked stav

Tím se část pravidel dostává mimo engine/readiness. Přesně tady vznikají hover/drop parity bugy: UI řekne “můžeš”, engine řekne “ne”. Pak se všichni dívají na monitor, jako kdyby měl výčitky svědomí.

### Brutální zjednodušení

Vytáhnout engine read-model helpers mimo React a mimo legacy view:

- `readProducerRuntimeState`
- `readCraftRuntimeState`
- `readStashRuntimeState`
- `readStoredRequirementRuntimeState`
- `readAcceptedInteractionsForTarget`

Board bridge pak jen mapuje tyhle modely na `BoardViewItem`. DnD by mělo číst stejné accepted interaction info jako detail UI a readiness.

## Pátá zátěž: starý manifest a legacy úlomky

Aktivní runtime je JSON config. Přesto v `src/v0/manifest` zůstává hodně starého authoring/runtime kódu. Některé soubory jsou ještě užitečné jako ID typy/schemata. Ale stará config DSL/validation vrstva už je převážně mrtvá.

Zachovat krátkodobě:

- `src/v0/manifest/manifestId.ts`
- ID schema soubory, dokud se typy úplně nepřesunou k novému configu

Kandidáti na smazání/refactor po kontrole import graphu:

- `src/v0/manifest/config/*`
- `src/v0/manifest/validation/*`
- starý `GameConfig.ts` / manifest composition, pokud už není žádná runtime/CLI cesta
- historické tests kolem staré manifest validation, pokud netestují stále platný kontrakt

Tady je potřeba samostatný cleanup commit. Ne míchat s behavior změnou, jinak si vyrobíme archeologický výkop a bugfix najednou. To je oblíbený sport lidí, kteří nenávidí budoucí sebe.

## Konkrétní problémy, které bych řešil

### 1. Unifikovat interaction planner

Priorita: kritická architektura.

Největší mental load je drop flow. Udělat jeden planner, který vrací plan + engine action. UI ho použije pro feedback i dispatch. Engine apply zůstane poslední autorita.

Tohle brutálně zjednoduší:

- `resolveDropIntent`
- `resolveBoardCellDropAction`
- `resolveInventoryCellDropAction`
- `useGameRuntimeDropActions`
- část hover/drop feedback parity

### 2. Srovnat readiness/apply kontrakt

Priorita: vysoká.

Přestat mít action readiness jako paralelní ručně udržovaný seznam, kde část akcí lže tím, že jen vrátí success. Každá akce má mít check/readiness část sdílenou s apply.

### 3. Rozsekat schema monolity bez změny public kontraktu

Priorita: vysoká, ale po interaction planneru.

Nejde o změnu modelu, jen přesun interních schémat a validatorů do doménových souborů. Public `GameConfigSchema`, `GameSaveSchema`, `GameSaveConfigSchema` musí zůstat centrální vstupy.

### 4. Opravit effective config layer pro product input upgrady

Priorita: vysoká.

Dnes product-specific input quantity layer může fakticky mutovat shared inputRef. Čistší model:

- base `config.inputs` zůstane authoring template
- effective product má resolved input slots
- `readProductInputs` umí číst product-specific effective override
- quantity add nesmí vytvořit invalidní 0 slot; buď minimum 1, nebo explicitní removal effect

### 5. Capability matrix pro itemy

Priorita: vysoká před dalšími gameplay mechanikami.

Sepsat a vynutit pravidla:

- resource stack item
- board actor item
- craft target
- producer
- stash
- removable target
- merge source/target

Pokud item může být více věcí najednou, musí být explicitně schváleno, co se stane při stash/merge/remove/craft replace. Co nechceme podporovat, zakázat ve `GameConfigSchema`.

### 6. Persistence retry oprava

Priorita: střední, malý fix.

`connectGameRuntimeSavePersistence` by neměl zahodit pending save před úspěšným zápisem. Minimální oprava:

- držet `pendingSave` do úspěšného `storage.save`
- při erroru nechat poslední save znovu pending, nebo explicitně uložit `lastFailedSave`
- přidat jednoduchý test transient fail -> next flush retry

### 7. Scheduled event vrstva: rozhodnout “live feature” vs “future primitive”

Priorita: střední.

Po atomic producer/stash/craft flow už scheduled spawns vypadají méně aktivně. Buď:

- odstranit scheduled item spawn z runtime save a nechat timing čistě pro visual plan, nebo
- ponechat jako explicitní future primitive a zdokumentovat, kde se používá a proč

Teď to vypadá jako starý zub v puse. Nehnije úplně, ale člověk o něm ví.

### 8. Visual plan přepsat na `ts-pattern` a zmenšit ignored-event šum

Priorita: střední.

`createGameEngineVisualPlan` má exhaustive switch, což funguje. Ale `GameEvent` je discriminated union a `ts-pattern` by tady zlepšil čitelnost kombinací typu `item.consumed + item.replaced`. Zároveň bych oddělil explicitně:

- events with visual meaning
- events intentionally ignored
- events ignored only temporarily

Teď `ignoredEventTypes` sbírá i události, které jsou doménově důležité, jen nemají animaci. To je OK debug signál, ale časem to bude log noise.

### 9. Root docs refresh

Priorita: střední, ale levné.

`README.md` musí přestat tvrdit, že source of truth je starý `src/v0/manifest/GameConfig.ts`. Aktuální pravda:

- static config = compiled JSON z `game/arkini`
- runtime state = `GameSave`
- engine = `RuntimeGameEngineAdapter`
- storage = Dexie wrapper
- old manifest = legacy/ID compatibility only, pokud vůbec

### 10. Zpřísnit `npm run check`

Priorita: nízká/střední.

`check` dnes nespouští build a nevaliduje compiled outputs. Doporučení:

- přidat `game:validate:compiled`
- zvážit `build` v CI/checku
- vyloučit `game/arkini.assets.json` z Biome format/size limitu, nebo explicitně navýšit limit pro generated file

## Co bych naopak nepřepisoval

Nepřepisoval bych runtime store zpět na žádnou cache/query vrstvu. `useSyncExternalStore` + raw snapshot je teď správná cesta.

Nepřepisoval bych TileEngine do Phaseru nebo jiné těžké runtime knihovny. Aktuální generický TileEngine je komplexní, ale hranice je rozumná. Bolest je spíš v herním drop planneru než v samotném pointer/motion runtime.

Neházel bych pryč `ts-pattern`. Naopak bych ho použil víc na source/target/action/event matching. Je to přesně typ knihovny, která nám u discriminated unionů šetří budoucí facky.

Nerozbíjel bych centrální schema validation princip. Jen bych rozsekal soubory. Validace musí zůstat schema/config layer, ne roztahaná po UI a storage.

Nedělal bych velký ekonomický pass, dokud nejsou stabilizované interakce, capability matrix a effective config layer. Jinak budeme ladit čísla nad modelem, který ještě neví, co chce být, což je software ekvivalent vztahu po třech týdnech.

## Doporučené pořadí dalších tasků

1. Interaction planner unification: jeden source/target planner pro hover/drop/dispatch.
2. Readiness/apply coupling: sdílené checky, žádné falešné ready větve.
3. Effective config input layer fix: product-specific resolved inputs, žádná globální mutace shared inputRef.
4. Capability matrix + schema enforcement: jasně říct, co item může kombinovat.
5. Schema file split: `GameConfigSchema` a `GameSaveSchema` rozdělit interně podle domén.
6. Board read-model split: producer/craft/stash/requirement read helpery mimo velký bridge.
7. Persistence retry fix.
8. Scheduled event decision: odstranit, nebo zdokumentovat a udržet.
9. Legacy manifest cleanup.
10. Docs/check hygiene: README, compiled validate, build/check, Biome generated asset ignore.

## Krátký tvrdý verdikt

Arkini už nemá hlavní problém v tom, že by nemělo source of truth. To je po runtime rewrite konečně docela čisté. Hlavní problém je, že některé doménové rozhodování se opakuje ve víc interpretrech: drop intent, drop action, runtime drop dispatch, readiness a apply. Tohle je přesně místo, kde se bugy rodí v tichosti a pak se tváří jako “animace je rozbitá”, i když je rozbitý kontrakt.

Druhá velká věc je velikost centrálních souborů. `GameConfigSchema`, `GameSaveSchema` a `readRuntimeBoardViewFromGameSave` jsou správná místa pro pravdu, ale už jsou moc velká na pohodlné změny. Nerozbít princip, rozsekat provedení.

Třetí věc je starý manifest. Jakmile stabilizujeme interaction planner a config/save kontrakty, starou TS manifest vrstvu bych poslal pryč. Ne nostalgicky “nechat pro jistotu”. Jistota je přesně to, co z mrtvého kódu nikdy nevyleze.
