# V0 action readiness/apply contract cut

Datum: 2026-06-19

## Kontext

Po sjednocení `item -> board item` interaction planneru zůstával další drift: `readActionReadinessFx` a `applyGameActionFx` měly každý vlastní exhaustive seznam action typů. Navíc několik runtime interakčních akcí v readiness vracelo falešné `ready`, zatímco apply je uměl odmítnout až později.

Konkrétně šlo o:

- `board.item.move`
- `board.item.stash`
- `board.items.swap`
- `inventory.item.place`
- `inventory.slots.swap`

To znamenalo, že UI mohlo ukázat akci jako povolenou, i když apply by ji odmítl kvůli occupied targetu, prázdnému inventory slotu, plnému inventáři nebo bounds chybě. Takové "ready, věř mi bro" kontroly jsou přesně místo, kde se rozjede feedback a runtime realita.

## Co se změnilo

- Přidaný společný `matchGameAction` v `src/v0/game/engine/logic/matchGameAction.ts`.
- `readActionReadinessFx` i `applyGameActionFx` používají stejný action matcher, takže seznam action typů už není ručně udržovaný ve dvou nezávislých `ts-pattern` stromcích.
- Přidané readiness checkery pro akce, které dřív měly jen falešný success:
  - `checkBoardItemMoveReadinessFx`
  - `checkBoardItemStashReadinessFx`
  - `checkBoardItemsSwapReadinessFx`
  - `checkInventoryItemPlaceReadinessFx`
  - `checkInventorySlotsSwapReadinessFx`
- Apply efekty pro move/stash/swap/place teď volají odpovídající readiness checker jako první krok a pak provádějí mutaci.
- Doplněné testy, že readiness odmítá reálně neproveditelné jednoduché akce.

## Důležité rozhodnutí

`matchGameAction` není náhrada `ts-pattern`, ale drobná centralizace jeho použití. `ts-pattern` pořád zůstává hlavní exhaustive tool, jen nechceme držet stejný seznam action typů v každé vrstvě zvlášť jak účetnictví v papírovém pekle.

Readiness pořád nesmí být jediná autorita. Engine apply zůstává poslední runtime pravda. Rozdíl je, že readiness už nemá vědomě lhát u běžných interaction akcí.

## Co zůstává dál

- Některé doménové checkery pořád vrací bohatý checked payload a apply ho pak znovu čte přes svůj checker. To je v pořádku, protože apply ten payload používá pro mutaci.
- Další řez dává smysl v effective config layeru: product-specific input upgrade dnes může mutovat shared `inputRef` a quantity může spadnout na 0.
- Capability matrix itemů pořád není formálně zapsaná ani vynucená.

## Kontroly

- `npm run typecheck`
- `npm run test -- src/v0/game/engine/fx/readActionReadinessFx.test.ts src/v0/game/engine/fx/applyGameActionFx.test.ts`
- `npm run check`
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json`
- `npm run build`

Vše prošlo. Zůstává jen známý Biome warning na velký generated `game/arkini.assets.json` a Vite chunk warning.
