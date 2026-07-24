import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

export namespace acquireGameEngineLeaseFx {
	export type Props = GameEngineResourceFx.AcquireProps;
}

/** Acquires one scoped lease from the sole renderer Game resource authority. */
export const acquireGameEngineLeaseFx = Effect.fn("acquireGameEngineLeaseFx")(
	(props: acquireGameEngineLeaseFx.Props) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.acquireLeaseFx(props))),
);
