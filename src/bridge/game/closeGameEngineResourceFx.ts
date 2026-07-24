import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

export type CloseGameEngineResourceResult = GameEngineResourceFx.CloseResult;

/** Attempts final save/disposal for native close and never blocks application exit. */
export const closeGameEngineResourceFx = Effect.fn("closeGameEngineResourceFx")(
	(resource: GameEngineResource) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.closeFx(resource))),
);
