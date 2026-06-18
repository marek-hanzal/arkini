# V0 stash full-open output follow-up

Datum: 2026-06-18
Commit: this task
Related: `v0-stash-atomic-output-2026-06-18.md`

## Korekce policy

Stash open není jeden roll per click. Jedno kliknutí otevře stash celý a vysype všechny remaining charges.

Před tímhle follow-upem `openStashFx` pořád snižoval `remainingCharges` o 1, i když T3 už udělal state změnu atomickou. To byla degradace původního UX: multi-charge stash se choval jako dávkovač na opakované klikání. To nechceme.

Po opravě:

1. `checkStashOpenReadinessFx` zjistí current `remainingCharges`.
2. `openStashFx` spotřebuje inputy jednou, jako cenu za otevření stash.
3. Loot table se rollne jednou za každou remaining charge.
4. Všechny rollnuté item requesty se předají do jednoho `placeGameSaveItemsFx` batchu.
5. Placement běží sekvenčně přes stejná board-then-inventory pravidla jako producer output.
6. Pokud se nevejde celý batch, akce failne přes `board:full` / `inventory:full` via `GamePlacementFailed` a původní save zůstane netknutý.
7. Pokud se batch vejde, stash má `remainingCharges = 0` a depletion se aplikuje hned (`remove` nebo `replaceWithItemId`).

Důležitý rozdíl: gameplay save je pořád atomic all-or-nothing, ale output eventy zůstávají v sekvenčním pořadí placementu. Visual bridge tak může dál dávkovat board spawny přes sequence metadata jako producer. Nevracet scheduled eventy jen kvůli animaci.

## Test coverage

- Multi-charge stash se na jedno `stash.open` celý vyčerpá.
- Output je umístěn sekvenčně: první charge může obsadit board + inventory remainder, další charge pokračuje nad už změněným batch save stavem.
- Částečná kapacita failne celý open bez mutace původního save.
- Visual bridge mapuje stash board output na sequenced spawn visuals (`cause: stash`, `mode: sequence`, rostoucí `sequenceIndex`).

## Next

Další stabilizační task zůstává T4: effective upgrade/config validation. Upgrade vrstvy nesmí vyrobit invalidní effective config s nulovou/zápornou quantity, duration, cost, capacity nebo queue hodnotou.
