import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

/** Discards one exact non-save bootstrap failure without deleting its save. */
export const discardFailedGameEngineFx = Effect.fn("discardFailedGameEngineFx")(
	(packageId: string) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.discardFailedFx(packageId))),
);
