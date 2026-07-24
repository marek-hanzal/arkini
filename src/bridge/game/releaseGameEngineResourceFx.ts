import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

export namespace releaseGameEngineResourceFx {
	export interface Props {
		/** Native close only: another terminal action may already have finalized this resource. */
		readonly allowAlreadyFinalized?: boolean;
		readonly resource: GameEngineResource;
	}
}

/** Final-saves one exact Game through the renderer Game resource authority. */
export const releaseGameEngineResourceFx = Effect.fn("releaseGameEngineResourceFx")(
	(props: releaseGameEngineResourceFx.Props) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.releaseFx(props))),
);
