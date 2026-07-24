import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

/** Atomically claims the current or provisional Game for native close. */
export const claimGameEngineResourceForCloseFx = Effect.fn("claimGameEngineResourceForCloseFx")(
	() => GameEngineResourceFx.pipe(Effect.flatMap((service) => service.claimForCloseFx)),
);
