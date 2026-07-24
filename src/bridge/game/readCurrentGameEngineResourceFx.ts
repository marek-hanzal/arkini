import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

/** Reads the adopted renderer-wide Game resource from its sole authority. */
export const readCurrentGameEngineResourceFx = Effect.fn("readCurrentGameEngineResourceFx")(() =>
	GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
);
