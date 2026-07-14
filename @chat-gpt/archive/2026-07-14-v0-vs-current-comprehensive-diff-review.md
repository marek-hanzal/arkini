# Arkini v0 vs v1: komplexní diff review

Baseline: `fc64bee2`

## Celkový verdikt

**V1 je jako engine dramaticky lepší než v0.**

Ne kosmeticky. Ne proto, že má hezčí názvy souborů. V1 má výrazně lepší:

* model jediné pravdy,
* atomicitu,
* determinismus času,
* ownership dat,
* config kontrakty,
* validační hranice,
* testovatelnost,
* oddělení enginu od UI,
* a hlavně mentální model pro člověka i LLM.

**V0 je však stále výrazně feature-completejší jako hotová hra.**

Má skutečně zapojené:

* celé React UI,
* drag-and-drop,
* merge interakce,
* craft lifecycle,
* stash,
* board memory,
* cheats,
* audio,
* animace,
* detail views,
* debug/explain nástroje,
* aktivní effects,
* kompletní player interaction pipeline.

V1 je dnes feature-completejší než při našich minulých srovnáních, takže už neplatí levná námitka „v1 je čistší, protože ještě nic neumí“. Producenti, inputy, reservations, queue, fixed-step Tick, completion, placement, save/session a compiler už jsou dost složité systémy, aby architekturu pořádně zatížily.

A v1 ten tlak ustála dobře.

Ale **v1 ještě není behaviorální náhrada celé v0**. Je to podstatně kvalitnější jádro, na které se zbytek hry teprve musí korektně přenést.

---

## Rychlé číselné srovnání

| Metrika                              |                     v0 |                      v1 |
| ------------------------------------ | ---------------------: | ----------------------: |
| Produkční TS/TSX soubory             |                    980 |                     474 |
| Produkční řádky                      |       přibližně 55 800 |        přibližně 17 600 |
| Průměrná velikost souboru            |               57 řádků |                37 řádků |
| Medián                               |               35 řádků |                30 řádků |
| Největší produkční soubor            |            1 070 řádků |               190 řádků |
| Největší non-CLI produkční soubor v0 |              393 řádků |               190 řádků |
| Testovací/support řádky              |       přibližně 33 000 |        přibližně 16 800 |
| Aktuální v1 test suite               |   mimo současný runner | 124 souborů / 330 testů |
| Statické importní cykly              |                  3 SCC |                       0 |
| Největší importní SCC                |             50 souborů |                       1 |
| Aktuální dependency violations       | v0 se již nekontroluje |                       0 |

Největší v0 cyklus je padesátisouborový `tile-engine` chumel. Další cykly mají 11 souborů v inventory a 10 souborů v boardu.

To neznamená, že každý soubor uvnitř je špatný. Znamená to, že změna jednoho vizuálního/interakčního detailu vyžaduje držet v hlavě síť vzájemně závislých hooků, actors, motion runtime, slots, drag lifecycle a rendering funkcí. Pro LLM je to prakticky mlha, ve které se dá orientovat, ale těžko garantovat, že jsme při opravě nešlápli na něco o šest hran dál.

Zajímavá protiváha: produkční v0 není copy-paste žumpa. Při stejném mírném jscpd prahu jsem v produkčním kódu v0 nenašel významné klony, zatímco v1 má přibližně 0,58 % záměrné duplicity zejména mezi write commandy. Problém v0 tedy není líné kopírování. Problém je **topologie stavu a množství propojených konceptů**.

---

# Feature completeness

Legenda:

* **Ano**: skutečný end-to-end runtime behavior.
* **Částečně**: některé vrstvy fungují, ale lifecycle není kompletní.
* **Kontrakt**: schema/config existuje, runtime behavior nikoliv.
* **Ne**: chybí.

| Oblast                       | v0                    | v1                 | Poznámka                                              |
| ---------------------------- | --------------------- | ------------------ | ----------------------------------------------------- |
| Config authoring             | Ano                   | Ano                | v1 je explicitnější a bezpečnější                     |
| Compiler / pack              | Ano                   | Ano                | v1 má jednu kanonickou compile/validate cestu         |
| Semantic game validation     | Ano                   | Ano                | v1 má lepší strukturované diagnostics                 |
| Start board/inventory        | Ano                   | Ano                | v1 validuje start stejným runtime modelem             |
| Board/inventory runtime      | Ano                   | Ano                | v1 má mnohem čistší jednotný item model               |
| Move / swap / spawn / remove | Ano                   | Ano                | v1 atomic write commandy                              |
| Stack-first placement        | Ano                   | Ano                | v1 placement planner je čistší                        |
| Player drag/drop orchestrace | Ano                   | Ne                 | v1 zatím nemá skutečné UI interaction flow            |
| Producer lines               | Ano                   | Ano                | v1 core je výrazně lepší                              |
| Material input store         | Ano                   | Ano                | v1 drží skutečné item identity                        |
| Consume/reserve input        | Ano                   | Ano                | v1 reservation model je správnější                    |
| FIFO queue                   | Ano                   | Ano                | v1 má jasnější a lépe testovaný kontrakt              |
| Job pause/resume             | Ano                   | Ano                | v1 vychází z pravidel a fixed ticku                   |
| Job completion               | Ano                   | Ano pro producenty | speciální item lifecycle zatím chybí                  |
| Fixed-step Tick              | Ne                    | Ano                | zásadní výhra v1                                      |
| Offline/hidden-tab catch-up  | Ano                   | Ano                | jiné modely, v1 je determinističtější                 |
| Random outputs               | Ano                   | Ano                | v1 completion-local deterministic RNG                 |
| Distance/rule evaluation     | Ano                   | Ano                | v1 je užší, ale výrazně čitelnější                    |
| Active časované effects      | Ano                   | Ne / částečně      | v1 má rules a temporary schema, ne plný lifecycle     |
| Craft                        | Ano                   | Částečně           | job běží a line output funguje, owner se nespotřebuje |
| Blueprint                    | Ano                   | Částečně           | line běží, ale target replacement není implementovaný |
| Stash                        | Ano                   | Částečně           | line běží, ale stash lifecycle/output není dokončený  |
| Deposit input/capacity       | Ano                   | Ne                 | `InputRunUnsupportedError` pro `deposit`              |
| Merge gameplay               | Ano                   | Kontrakt           | schema a validace existují, execution ne              |
| Temporary item expiry        | Ano přes effects/jobs | Kontrakt           | schema tvrdí lifecycle, runtime ho zatím nemá         |
| Board memory                 | Ano                   | Kontrakt           | item schema bez command/lifecycle                     |
| Speed cheat                  | Ano                   | Kontrakt           | pouze item schema                                     |
| Cheat inventory              | Ano                   | Kontrakt           | pouze item schema                                     |
| Nuke                         | Ano                   | Kontrakt           | pouze item schema                                     |
| Full React UI                | Ano                   | Ne                 | v1 má pouze session/hooks bridge                      |
| Audio                        | Ano                   | Ne                 | event API připravené                                  |
| Animace / visual planning    | Ano                   | Ne                 | event API připravené                                  |
| Debug/explain UI             | Ano                   | Ne                 | v0 je zde výrazně dál                                 |
| Save persistence             | Ano                   | Ano                | v1 má kvalitnější engine/session boundary             |

## Důležitý závěr z feature matrix

V1 má velmi vysokou **contract completeness**, slušnou **engine primitive completeness**, ale pouze střední **feature lifecycle completeness**.

To je potřeba hlídat, protože schema přirozeně vytváří pocit, že feature existuje.

Aktuální `game/arkini` obsahuje přibližně:

* 92 simple itemů,
* 64 producerů,
* 70 blueprintů,
* 7 craft itemů,
* 4 stash itemy,
* 4 deposity,
* 2 temporary itemy,
* memory,
* nuke,
* oba cheaty.

Celkem je tedy kolem 91 nakonfigurovaných itemů, jejichž speciální behavior není v současném runtime plně realizovaný.

To není problém, pokud je to vědomý WIP. Byla by ale chyba říct, že „item je implementovaný“, protože projde `game:validate`.

Například:

* `BlueprintItemSchema` slibuje nahrazení blueprintu `targetId`, ale `completeJobRuntimeFx` target vůbec nečte.
* `CraftItemSchema` říká, že se craft po dokončení spotřebuje, ale completion ownera ponechá.
* `StashItemSchema` říká, že stash zmizí a vyhodnotí vlastní output, ale completion používá pouze `line.output`.
* `TemporaryItemSchema` popisuje běžící lifetime od vytvoření, ale runtime tento lifetime nikde nezakládá.
* `InputDepositSchema` existuje, ale `resolveInputRunFx` explicitně vrací `InputRunUnsupportedError`.
* Merge rules procházejí validací, ale neexistuje veřejná merge execution cesta.

Tohle je podle mě aktuálně největší praktické riziko v1. Ne špatná architektura, nýbrž **rozdíl mezi tím, co kontrakty slibují, a tím, co už runtime skutečně umí**.

---

# 1. Model pravdy

## V0

V0 ukládá runtime do velkého `GameSave`, který má oddělené struktury pro:

* board items,
* inventory sloty,
* producer jobs,
* producer inputs,
* producer charges,
* craft jobs,
* craft inputs,
* active effects,
* item capacities,
* item spawn jobs,
* board memory layouts,
* line state,
* cheat state.

Samotný root save shape má přes 330 řádků a pak nad ním běží sada cross-config validatorů.

Doménově související věc je často roztržená přes více map.

Například producent může být současně reprezentovaný přes:

* board item instance,
* producer job,
* producer input state,
* line state,
* charge state,
* active effects,
* případné delivery retry.

K pochopení producenta proto nestačí najít producenta. Musím poskládat producenta z několika nezávislých tabulek a vědět, které se musí synchronizovat.

To je hlavní příčina mental loadu v0.

## V1

V1 má velmi malý root runtime:

```ts
{
  items,
  jobs,
  jobQueue
}
```

A každý live item vlastní přesně jednu location:

```text
board
inventory
input
job
```

Tohle je podle mě **nejdůležitější změna celého přepisu**.

Materiál není jednou board item, podruhé číslo v `producerInputs` a potřetí nějaký reservation záznam.

Je to pořád ten samý runtime item:

```text
board
→ input
→ job reservation
→ standardní placement zpět
```

Identita, quantity, revision i canonical item definition cestují spolu.

Výsledek:

* méně synchronizací,
* méně konverzí,
* méně orphan stavů,
* přímočařejší runtime checker,
* přirozenější save hydratace,
* lepší animovatelnost,
* snazší debug,
* výrazně menší šance split-brainu.

V0 ukládá stav podle subsystémů.

V1 ukládá stav podle skutečných živých entit.

V1 zde vyhrává rozdílem několika tříd.

---

# 2. Atomicita a command model

## V0

V0 má konceptuálně pěkné jádro:

```text
(config, save, action, now)
→ GameEngineResult
```

To není špatný nápad. `GameActionSchema` navíc poskytuje jednu serializovatelnou command vocabulary, což je užitečné pro:

* replay,
* debug log,
* telemetry,
* testovací scénáře,
* případnou síťovou vrstvu.

Jenže runtime cesta kolem něj se postupně nafoukla:

```text
GameRuntimeStore.dispatch
→ RuntimeGameEngineAdapter.dispatch
→ mutation Promise queue
→ catchUpDueRuntimeGameTicks
→ applyGameActionFx
→ parse action
→ centrální dispatch
→ feature readiness
→ feature mutation
→ processWorldSnapshotFx
→ GameEngineResult
→ adapter publish
→ GameRuntimeStore mirror
→ update listeners
→ view bridge
→ visual/audio stores
```

Navíc `readiness()` není čistý read.

Před čtením readiness provede:

```text
catchUpDueRuntimeGameTicks
```

Takže dotaz „mohu toto udělat?“ může nejdřív změnit svět.

To by mi u seniorního review vadilo hodně. Read, který podle času provádí mutace, je přesně ten druh překvapení, kvůli kterému se následně všude přidávají synchronizace a „refresh“ volání.

Každá action také po vlastní změně automaticky spustí `processWorldSnapshotFx`, takže command může dokončit nesouvisející joby nebo effects jen proto, že přišel s novějším `nowMs`.

Čas a command semantics jsou smíchané.

## V1

V1 má jasné rozdělení:

```text
read resolver
→ jen čte jeden snapshot

write command
→ uvnitř modifyRuntimeFx vše znovu přepočítá
→ vytvoří candidate runtime
→ candidate projde invariant checkerem
→ runtime + events se atomicky commitnou
```

Čas běží přes Tick, ne jako skrytý vedlejší efekt libovolného commandu.

`startLineFx` tedy dělá pouze:

```text
čerstvě resolve start
→ start nebo enqueue
→ validate candidate
→ commit
```

A Tick dělá:

```text
elapsed budget
→ fixed steps
→ queue dispatch
→ progress
→ completion
→ další queue dispatch
```

Tohle je mnohem lepší oddělení odpovědností.

V1 navíc po dlouhé review sérii drží skutečně jednu atomickou committed transition přes STM:

```text
runtime + transient events + command result
```

Není zde:

* adapter truth,
* store mirror,
* ručně inkrementovaná React revision,
* druhý event bus,
* readiness refresh,
* lokální UI runtime state.

V0 serializuje mutace.

V1 serializuje plánování a má explicitní atomický point of no return.

To není slovíčkaření. Je to rozdíl mezi „dva commandy se nám snad nepotkají“ a „dokážeme ukázat přesné místo, kde se svět změní“.

---

# 3. Čas a joby

## V0

V0 modeluje čas přes wall-clock timestampy:

* `startAtMs`,
* `readyAtMs`,
* `pausedAtMs`,
* `remainingMs`,
* effect `startAtMs/endAtMs`,
* delivery retry timestamps,
* `nextWakeAtMs`.

Runtime musí:

* dopočítávat wake plán,
* synchronizovat realtime jobs,
* pause/resume přepisem timestampů,
* catch-upovat due ticks,
* opakovat world processing do stabilního stavu,
* hlídat limit 100 catch-up ticků.

V `processWorldSnapshotFx` je například ručně zakódované pořadí:

```text
item spawn jobs
→ producer jobs
→ craft jobs
→ producer jobs znovu
→ expired effects
```

Druhý producer pass existuje proto, že craft mohl změnit podmínky producentů.

Funguje to, ale je to procedurálně zakódovaná znalost závislostí. Jakmile přibude další systém, musí člověk vědět, kam ho vložit a co po něm zopakovat.

## V1

V1 má jeden zdroj impulsu a diskrétní fixed-step model.

Wall clock pouze dodá elapsed čas. Engine ho naseká na 200ms kroky a přehraje.

Výhody:

* stejný stav + stejný elapsed = stejný výsledek,
* sleeping tab není speciální případ,
* paused job prostě v kroku nepostoupí,
* nový job nedostane retroaktivní čas,
* cross-owner změny mají jasnou step boundary,
* testy mohou používat virtuální clock nebo explicitní `runTickRuntimeByFx`,
* žádné skryté `Date.now()` uvnitř domény,
* job drží jednoduché `remainingMs`.

Mentálně je to výrazně snazší.

Jediný reálný tradeoff je výkon dlouhého backlogu.

V0 dokáže přes timestampy skákat přímo na due events.

V1 musí aktivní změny přehrávat po krocích. Stabilní no-op backlog už umí fast-forwardnout, ale například několik hodin skutečně běžící produkce může znamenat hodně iterací.

Teď bych to nepřepisoval. Board bude malý a správná semantika má větší cenu než předčasný scheduler.

Je ale dobré vědět, že v1 koupila determinismus za potenciálně vyšší catch-up CPU cost.

---

# 4. Config, compiler a validace

## V0

V0 config systém je schopný, ale hodně implicitní.

`cli/game/package.ts` má přes tisíc řádků a mimo jiné:

* načítá soubory,
* merguje fragmenty,
* generuje resources,
* normalizuje assety,
* odvozuje asset IDs,
* odvozuje blueprint overlay,
* odvozuje craft result z názvu itemu,
* normalizuje selectors,
* doplňuje defaultní line outputy,
* validuje,
* packuje,
* gzipuje.

To znamená, že výsledný game config není jen to, co autor napsal. Je to to, co autor napsal plus sada skrytých naming conventions a transformací.

Pro člověka se znalostí projektu se s tím dá pracovat.

Pro LLM je to svině, protože konfigurace v souboru není celý kontrakt. Musím vědět, co compiler potají vymyslí.

## V1

V1 dělá mnohem zdravější věc:

```text
read source files
→ parse source fragments
→ assemble bez silent overwrite
→ schema parse completed configu
→ semantic diagnostics
→ assert valid
→ pack
```

Compiler nehraje na věštce.

Blueprint asset je explicitní tuple.

Item ID je explicitní.

Output je explicitní.

Duplicate provider je diagnostic.

Chybějící resource je diagnostic.

Start state se ověřuje stejným runtime modelem.

Input acceptance cycles jsou offline validation.

Packer, validator a testy sdílejí jednu compile cestu.

Tohle je přesně správné pro LLM-maintained repo: více psaní v configu, výrazně méně implicitního významu.

V0 config pipeline je mocná.

V1 config pipeline je důvěryhodná.

---

# 5. Doménové hranice a UI

## V0

V0 engine je teoreticky standalone, ale velká část doménových projekcí skončila v:

```text
src/v0/play/game-engine-bridge
```

Například `readRuntimeLineViewFromDefinition` počítá:

* blocked,
* visible,
* effect locked,
* output limits,
* duration,
* effect benefits,
* requirements,
* start readiness,
* progress,
* default selection,
* queue state,
* input state,
* outputs.

Tohle není React rendering. To je doménový read model.

Je to umístěné mezi enginem a UI, takže se z bridge postupně stala druhá interpretační vrstva enginu.

`GameRuntimeVisualEffects` navíc bere:

* previous board view,
* current board view,
* events,

a znovu z nich skládá visual plan.

Audio dělá podobnou věc nad previous/current save.

V0 tím má bohatou prezentaci, ale také několik míst, která interpretují význam stejného přechodu.

## V1

V1 zatím nemá hotové skutečné UI, takže nelze tvrdit, že tato hranice je definitivně vyhraná.

Směr je ale správný:

* engine poskytuje live runtime read,
* engine poskytuje events,
* engine má doménové resolution/read modely,
* UI hook je jen tenký bridge,
* commandy se posílají do enginu,
* React nevlastní runtime pravdu.

`readLineStartFx` například vrací kompletní doménové rozhodnutí:

```text
run
queue
ready
```

UI nemusí samo počítat, zda lze line spustit.

Až se bude portovat skutečné UI, největší disciplína bude:

> Nepřepisovat v0 game-engine-bridge logiku do React hooků.

Správný postup je přenést potřebné read modely do veřejné engine vrstvy a UI nechat pouze renderovat.

V0 nám zde poskytuje velmi hodnotný seznam toho, co UI potřebuje vědět. Nemá nám ale diktovat, kde se ta logika má nacházet.

---

# 6. Chybový model

## V0

V0 převádí hodně situací na generický `GameEngineError` s kategoriemi typu:

```text
invalid_actor
input_mismatch
```

Pro action protocol je to praktické, ale konkrétní chyba často vzniká až hluboko v orchestru a caller musí interpretovat obecnější code/message.

Readiness a execution také často mají dvě paralelní cesty:

```text
checkSomethingReadinessFx
applySomethingFx
```

To snadno vede k rozdílu mezi preview a skutečným commandem.

## V1

V1 používá typed errors a explicitní resolution schemas:

* `JobOwnerBusyError`,
* `JobQueueFullError`,
* `ItemNotOnBoardError`,
* `ItemJobScopedError`,
* `LocationOccupiedError`,
* `RuntimeInvalidError`,
* tagged start/queue/completion výsledky.

Důležitější je, že preview není autorizace.

Read resolver může UI něco ukázat, ale write command vždy znovu resolveuje stav uvnitř atomické mutace.

To je správný model pro concurrent engine.

---

# 7. Testy

## V0

V0 má hodně behaviorálních testů a obrovskou znalost hry.

To je cenné.

Některé testy mají 1 000 až 1 500 řádků. Například producer inputs nebo config schema.

Výhoda:

* velké množství edge casů,
* reálné behaviorální pokrytí,
* dobrý zdroj požadavků pro migraci.

Nevýhoda:

* failure často pošle člověka do obrovského souboru,
* setup mutuje `GameSave` přímo,
* testy znají interní save topologii,
* změna datového modelu rozbije spoustu setupu,
* jeden test soubor často ověřuje několik vrstev současně.

`GameScenario` je ovšem dobrý nápad. Je čitelný, immutable navenek a přirozeně řetězí akce. Tuto ergonomii má smysl zachovat jako inspiraci.

## V1

V1 má přibližně stejný počet testovacích suite jako v0, ale méně než polovinu testovacích řádků.

Testy jsou rozdělené na:

* schema tests,
* resolver tests,
* plan/apply tests,
* runtime invariant tests,
* atomic write tests,
* session boundary tests,
* flow tests.

Nejcennější jsou flow testy typu:

```text
prepare input
→ start
→ enqueue
→ block placement
→ tick
→ release capacity
→ retry
→ verify jobs, queue, reservations, outputs
```

Ty ověřují systémovou semantiku, aniž by znaly React nebo storage implementation.

V1 testy jsou lépe lokalizované a jejich failure mi jako LLM přesněji říká, která hranice se rozbila.

---

# 8. Mentální zátěž pro LLM

## V0

Lokální funkce ve v0 často nejsou špatné.

Problém nastane, když se zeptám:

> Co všechno se může stát, když hráč spustí tuto line?

Musím držet:

* action schema,
* adapter catch-up,
* producer readiness,
* visible line IDs,
* effective effects,
* input refs,
* stored quantities,
* auto-fill,
* capacity,
* queue timestamps,
* active jobs,
* save maps,
* world processing,
* delivery retries,
* next wake,
* event result,
* bridge view,
* visual/audio planning.

A co je horší, část této logiky není na přímé call path. Je přidána před commandem, po commandu nebo při render projekci.

V0 proto umím číst, ale hůř garantuju, že změna zůstane lokální.

## V1

Ve v1 je stabilní gramatika:

```text
schema
→ resolve
→ plan
→ apply
→ write command
→ runtime assert
→ atomic commit
→ event/read model
```

Ne každá feature potřebuje všechny kroky, ale jejich význam je konzistentní.

Při čtení `startLineFx` vím:

* kde se čte aktuální pravda,
* kde se rozhodne start versus queue,
* kde se aplikují inputs,
* kde vzniká job,
* kde se validuje candidate,
* kde proběhne commit.

Při čtení Ticku vím:

* kde se získává elapsed,
* kde se kvantizuje,
* kde se přehrává step,
* kde se vyhodnocuje runnable,
* kde se dokončuje job.

Musím otevřít více malých souborů než u monolitické funkce. To je navigační cena.

Ale počet souborů není totéž jako mental load.

V1 má vyšší navigační náklad, ale výrazně nižší náklad na držení simultánních modelů v hlavě.

A pro LLM je druhá hodnota mnohem důležitější.

---

# 9. Co v0 dělá překvapivě dobře

V0 bych rozhodně neoznačil za odpad, který se má zahodit a zapomenout.

Je v něm několik velmi kvalitních věcí.

## V0 je behaviorální specifikace

Obsahuje roky konkrétních rozhodnutí:

* jak se co animuje,
* co se stane při blokované placement,
* jak funguje board memory,
* jak se zobrazují line effects,
* co UI potřebuje vědět,
* jak se chovají stacky,
* co se děje při merge,
* jak se řeší chests,
* jak se formují audio plans.

Tohle by bylo drahé znovu vymýšlet.

## Central action schema má hodnotu

Jedna serializovatelná action union je dobrá pro:

* replay,
* audit,
* debugging,
* makra,
* event sourcing,
* případný multiplayer/network transport.

V1 to nyní nepotřebuje a nebyl by důvod zavádět action bus jen kvůli architektonické symetrii.

Ale kdyby někdy vznikla reálná potřeba replay nebo command logu, v0 ukazuje užitečný směr.

## V0 view models jsou bohaté

`LineView`, board view, inventory view a visual plans zachycují mnoho produktové znalosti.

Jejich umístění a závislosti jsou problém. Jejich obsah problém není.

## Timestamp scheduler je efektivní pro velké skoky

V0 přirozeně skáče po due events, zatímco v1 přehrává fixed steps.

Semanticky preferuju v1. Výkonnostní inspiraci pro budoucí bezpečný fast-forward lze ale hledat ve v0 wake planningu.

## V0 nemá problém s copy-paste

Je důležité nekazit historii pohádkou, že v0 byla banda nakopírovaných funkcí.

Nebyla.

V0 se zkomplikovala proto, že feature vrstvy postupně přidávaly vlastní reprezentace stavu a vlastní projekce, ne proto, že by někdo bezmyšlenkovitě kopíroval bloky kódu.

---

# 10. Co by mi ve v0 u seniorního review neprošlo

Bez ohledu na historický kontext bych dnes odmítl:

1. **Readiness, která může mutovat svět přes time catch-up.**

2. **Adapter state plus GameRuntimeStore mirror plus další transient visual stores.**

3. **Doménové read modely schované v `play/game-engine-bridge`.**

4. **Padesátisouborový importní SCC v TileEngine.**

5. **`GameSave` jako směs několika normalizovaných subsystémových tabulek vyžadujících ruční synchronizaci.**

6. **Skryté compiler konvence v tisíciřádkovém packeru.**

7. **Ruční pořadí producer → craft → producer pro dosažení stability.**

8. **Action, která automaticky zpracuje i nesouvisející wall-clock svět.**

9. **Velký počet funkcí, které si předávají `config`, `save`, `nowMs`, vrací další `save`, a další vrstva ho znovu zabalí.**

10. **UI/visual vrstvy, které znovu interpretují previous state + current state + events.**

Každý jednotlivý bod lze obhájit.

Dohromady vytvářejí systém, ve kterém se pravda přehazuje jako horký brambor a všichni doufají, že ji nikdo cestou neupustí.

---

# 11. Co bych hlídal ve v1

V1 nyní nepotřebuje další obecný refaktor. Architektonicky drží.

Hlídal bych jen několik konkrétních rizik.

## 11.1 Schema není implementace

Dokud není hotový lifecycle, neměly by source komentáře ani dokumentace tvrdit, že runtime chování existuje.

Buď:

* označit capability jako WIP,
* nebo ji nepustit do běžného runtime flow,
* nebo doplnit explicitní capability support validation.

Nechceme, aby příští LLM vidělo `CraftItemSchema` a automaticky usoudilo, že craft je hotový.

## 11.2 UI musí dostávat engine-owned read modely

Až se začne portovat UI, nesmí vzniknout:

```ts
const canStart = ...
const isBlocked = ...
const outputLimitReached = ...
```

uvnitř Reactu.

V0 bridge přesně ukazuje, jak rychle se může „jen prezentační helper“ změnit v druhý engine.

## 11.3 Fixed-step performance je watch item

Neřešit nyní abstraktním schedulerem.

Až bude konkrétní benchmark skutečné dlouhé aktivní hry, lze přidat optimalizovaný fast-forward s ekvivalenčními testy.

## 11.4 Dokumentace musí odpovídat v1

Aktivní `@chat-gpt` dokumentace a root docs pořád obsahují části v0 modelu. Pro LLM-maintained repo je to skutečná technická závada, ne kosmetika.

## 11.5 Nezačít konsolidovat explicitní patterny

Write commandy mají kolem 0,58 % drobné duplicity.

To je přijatelná cena za to, že každá mutace drží stejný tvar:

```text
resolve entity
→ revision guard
→ invariant
→ candidate
→ result
```

Generický `mutateEntityBuilderFactory` by sice zmenšil počet řádků, ale zvýšil počet mentálních skoků. Přesně ten druh „senior elegance“, po které za půl roku nikdo neví, co se vlastně děje.

---

# Přímá odpověď: pracuje se mi s v1 mentálně lépe?

**Ano. Výrazně.**

Ne o deset procent. Spíš kvalitativně jinak.

Ve v0 při změně často nejdřív hledám:

> Které všechny reprezentace této věci existují a kdo je synchronizuje?

Ve v1 hledám:

> Který resolver vlastní rozhodnutí, který planner připraví změnu a který command ji commitne?

To je mnohem zdravější otázka.

Ve v0 často rozumím jednotlivým funkcím, ale musím být paranoidní vůči celku.

Ve v1 rozumím nejen funkcím, ale většinou i tomu, **proč změna zůstane uvnitř své hranice**.

To je pro LLM zásadní rozdíl.

---

# Finální hodnocení

## V0

V0 je funkční, feature-rich implementace, která vyrostla organicky kolem skutečné hry.

Je hodnotná jako:

* behaviorální specifikace,
* UX reference,
* zdroj edge casů,
* testovací oracle,
* katalog potřebných read modelů,
* zdroj animation/audio behavioru.

Není vhodná jako architektonický základ dalšího vývoje.

Její největší problém není špatný kód v jednotlivých souborech. Je to počet míst, která současně interpretují nebo vlastní část pravdy.

## V1

V1 je podstatně kvalitnější engine architecture.

Má:

* jeden normalizovaný runtime,
* jasná locations,
* explicitní reservations,
* atomické transitions,
* deterministický Tick,
* čitelné orchestrátory,
* oddělené reads a writes,
* kanonický compiler,
* strukturovanou validaci,
* standalone engine boundary,
* dobrý testovací tvar,
* nulové importní cykly.

Ještě nemá celou hru.

Ale to, co již má, je postavené tak, že další feature mohou přibývat bez nutnosti znovu rozštípnout pravdu.

## Můj definitivní verdikt

**Přepis do v1 byl správné rozhodnutí.**

V1 není jen hezčí v0.

Je to oprava původního mentálního modelu hry.

V0 bych od této chvíle používal výhradně jako:

```text
behaviorální oracle
```

Nikdy jako:

```text
architektonického dárce
```

Přenášet bych doporučil vždy celý vertikální slice:

```text
schema
→ game validator
→ runtime lifecycle
→ invariant checker
→ read model
→ command
→ events
→ flow test
→ UI adapter
```

Neportovat „craft files“, „memory subsystem“ nebo „merge adresář“.

Portovat konkrétní chování přes v1 gramatiku.

Jakmile se dotáhnou speciální lifecycle pro blueprint/craft/stash/deposit, merge a pak UI projekce, bude v1 nejen architektonicky lepší, ale také výrazně levnější na další rozšiřování než v0.

A hlavně: v1 už není ve fázi, kdy bych si říkal „možná se ta čistota rozpadne, až přijdou těžké systémy“.

Joby, queue, Tick, atomicita a save už přišly.

A nerozpadla se.
