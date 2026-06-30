# V0 stash atomic output / depletion

Datum: 2026-06-18
Commit: this task
Epic: `v0-stabilization-epic-2026-06-18.md` T3

## Co se opravilo

Stash open už nepoužívá scheduled spawn events jako mezivrstvu pro běžnou gameplay state změnu.

Před opravou `openStashFx`:

1. zvalidoval stash open,
2. spotřeboval vstupy,
3. rollnul loot,
4. udělal placement preflight,
5. zapsal output do `save.scheduledEvents`,
6. případné depletion remove/replace zapsal také jako scheduled board event závislý na output eventech.

To znamenalo, že action success neznamenal hotový save. Stav hry byl pravdivý až po dalším scheduled ticku. Krásná malá temporalní díra, protože proč by output existoval hned, když může existovat až potom, co se systém ještě jednou zamyslí.

Po opravě `openStashFx`:

1. zvaliduje stash open,
2. spotřebuje vstupy na cloned save,
3. rollne loot,
4. aplikuje output přes `placeGameSaveItemsFx` přímo do save,
5. pokud placement nejde, celá akce failne přes `board:full` / `inventory:full` via `GamePlacementFailed` a původní save zůstane beze změny,
6. pokud stash došel, aplikuje depletion okamžitě přes `applyStashDepletionFx`:
   - `remove` smaže board item a jeho runtime state,
   - `replaceWithItemId` přepíše stejný board item instance na replacement item a smaže runtime state.

Výsledkem je, že po úspěšném `stash.open` je save kompletní a `scheduledEvents` zůstávají prázdné. Sekvenční animace výstupu dál vzniká z `item.created` visual metadata, ne z odkládání save mutace.

## Scheduled event cleanup

Smazané scheduled board eventy:

- `scheduleBoardItemRemoveFx`
- `scheduleBoardItemReplaceFx`
- `scheduleStashDepletionFx`
- `processScheduledBoardItemRemoveFx`
- `processScheduledBoardItemReplaceFx`

`GameSaveScheduledEventSchema` teď dovoluje jen `item.spawn`.

Důvod: board remove/replace scheduled events byly jen stash animation plumbing. Jakmile stash depletion běží atomicky, tyhle event typy nemají runtime občanství. Nechali jsme scheduled `item.spawn`, protože to je obecná budoucí doménová událost a má vlastní blocked/retry testy.

## Test coverage

Doplněno/změněno:

- stash open aplikuje output + depletion atomicky a nezapisuje scheduled events,
- původní T3 multi-charge policy byla následně zpřesněna v `v0-stash-full-open-output-2026-06-18.md`: stash se na jedno otevření celý vyčerpá, neukládá další remaining charge pro další click,
- placement blocked failne akci a nepohne původním save,
- depleted stash umí atomicky replace-nout target item,
- scheduled event testy už netestují board remove; dependency/exclusive behavior se testuje přes dependent scheduled spawn.

## Poznámky pro další práci

- Producer blocked delivery zůstává zachovaný. To je timed job, takže blocked output může viset na jobu jako explicitní delivery state.
- Stash open je user action, takže policy je jednodušší: když nejde placement celého remaining output batchu, action failne a stash se neotevře.
- Craft completion je už po T2 target replacement bez scheduled outputu.
- Další task v epicu: T4 effective upgrade/config validation. Tady už budeme muset validovat, že aplikované upgrade prefixy nikdy nevyrábí nulové/záporné effective quantity/duration/cost/capacity hodnoty.
