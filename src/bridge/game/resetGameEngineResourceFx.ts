import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

export namespace resetGameEngineResourceFx {
	export interface Props {
		readonly resource: GameEngineResource;
	}
}

/** Discards one exact Game and clears its save through the sole resource authority. */
export const resetGameEngineResourceFx = Effect.fn("resetGameEngineResourceFx")(
	(props: resetGameEngineResourceFx.Props) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.resetFx(props))),
);
