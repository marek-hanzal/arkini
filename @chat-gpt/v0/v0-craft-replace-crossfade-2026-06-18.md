# V0 craft replace crossfade

Datum: 2026-06-18
Task: follow-up k T2 craft target replacement

## Výsledek

Craft replacement už není jen domain event + obyčejný enter na nové podobě tile. `craft-result` replacement teď používá explicitní visual animation effect `replace`, který TileEngine mapuje na `replace-in` / `replace-out` presence motion.

Prakticky: po dokončení craftu se původní target item drží jako transient board tile a fade-outuje, zatímco nový item na stejném `itemInstanceId` fade-inuje. Žádný spawn, žádný pop-in, žádné “mrklo to a asi se něco stalo”, což je sice autentický software zážitek, ale mizerná herní odezva.

## Upravená místa

- `src/v0/play/action/ActionVisualAnimationSchema.ts`
  - přidán animation effect `replace`
- `src/v0/play/action/ActionVisualAnimation.ts`
  - přidán `ActionVisualAnimation.replace`
- `src/v0/play/game-engine-bridge/createActionVisualEventsFromGameEvents.ts`
  - `item.replaced(reason: "craft-result")` se mapuje na `replace` effect, ne `state`
- `src/v0/play/tile-engine-motion/toTileEngineEnterMotion.ts`
  - `replace` effect -> `replace-in`
- `src/v0/play/tile-engine-motion/toTileEngineExitMotion.ts`
  - `replace` effect -> `replace-out`
- `src/v0/tile-engine/TileEnterMotionSchema.ts`
  - přidán generic enter kind `replace-in`
- `src/v0/tile-engine/TileExitMotionSchema.ts`
  - přidán generic exit kind `replace-out`
- `src/v0/tile-engine/useTileActorEnterMotion.ts`
  - `replace-in` je čistý fade-in bez posunu/scale
- `src/v0/tile-engine/useTileActorExitMotion.ts`
  - `replace-out` je čistý fade-out bez merge scale
- `src/v0/play/tile-engine-motion/registerBoardReplaceExitTiles.ts`
  - pro board replacementy s `replace` efektem vytvoří transient starého itemu a registruje jeho exit motion
- `src/v0/play/runtime/GameRuntimeVisualEffects.tsx`
  - visual runtime registruje merge exit transients, replace exit transients a pak enter motions

## Kontrakt

- Engine event zůstává canonical `item.replaced`.
- Visual bridge rozhoduje, jestli replacement má být state refresh nebo skutečná replace animation.
- TileEngine pořád nezná craft, item IDs ani Arkini doménu. Zná jen generic `replace-in` / `replace-out` motion kind.
- Starý render při replacementu řeší board transient tile, protože live board tile má stejný `itemInstanceId` a po save update už přirozeně renderuje nový item.

## Test coverage

- `createActionVisualEventsFromGameEvents.test.ts`: craft replacement dostává `effect: "replace"`.
- `registerTileEngineEnterRequests.test.ts`: replaced tile dostává `replace-in`.
- `registerBoardReplaceExitTiles.test.ts`: starý item vznikne jako transient tile, dostane `replace-out` a po settlementu se uklidí.

## Poznámka pro další hygienu

Tohle je zatím cílený follow-up k T2, ne kompletní event-flow rewrite. Pořád platí stabilizační T8: domain events -> visual events -> TileEngine motion bridge je potřeba později zjednodušit nebo udělat exhaustive planner. Tohle ale dorovnává craft UX bez porušení TileEngine boundary.
