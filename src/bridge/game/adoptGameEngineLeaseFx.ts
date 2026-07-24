import { Effect } from "effect";

import { GameEngineResourceFx, type GameEngineLease } from "~/bridge/game/GameEngineResourceFx";

/** Transfers one exact scoped acquisition lease to the renderer resource authority. */
export const adoptGameEngineLeaseFx = Effect.fn("adoptGameEngineLeaseFx")(
	(lease: GameEngineLease) =>
		GameEngineResourceFx.pipe(Effect.flatMap((service) => service.adoptLeaseFx(lease))),
);
