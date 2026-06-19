# V0 interaction planner unification

Datum: 2026-06-19

## Kontext

Po architektonickém review byla největší mentální zátěž drop cesta: UI intent, board/inventory drop action resolver a runtime dispatch si každý držel kus vlastního rozhodování. To vedlo k duplicitní logice a reálné díře: stash input drop uměl runtime zpracovat, ale UI planner ho nepoznal, takže board source skončil jako swap a inventory source jako reject.

## Co se změnilo

- Přidaný společný `ItemToBoardItemInteractionPlan` pro aplikaci itemu na board item.
- Přidaný `resolveItemToBoardItemInteractionPlan`, který rozhoduje merge, stored requirement, craft input, producer input, stash input, swap a reject.
- Přidaný `createGameActionFromItemToBoardItemInteractionPlan`, který mapuje vykonatelné plány na engine `GameAction`.
- `resolveDropIntent` je teď kompatibilní wrapper nad společným interaction plannerem.
- Board/inventory drop action resolvery používají společný planner místo vlastní paralelní logiky.
- Runtime `useGameRuntimeDropActions` zahodil vlastní duplicitní helpery a znovu používá stejný planner nad čerstvým runtime board view.
- Board non-merge apply akce už není interně označená jako `merge-board-items`, ale jako `apply-board-item-to-board-item`.
- Doplněné testy na stash input drop z boardu i inventáře a na mapování plánu do engine actions.

## Důležité rozhodnutí

Engine zůstává poslední autorita. Interaction planner sjednocuje UI feedback a runtime dispatch, ale `applyGameActionFx` pořád validuje skutečnou akci proti aktuálnímu savu. To je záměrně dvojitá obrana, ne návrat ke cache cirkusu.

## Co zůstává dál

- Planner zatím řeší primárně `item -> board item`. Empty cell move/place a inventory slot swap zůstaly jednoduché samostatné cesty.
- Readiness/apply coupling je pořád další samostatný task.
- Capability matrix itemů pořád není formálně zapsaná ani vynucená.
