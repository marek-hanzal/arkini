import { Effect } from "effect";

import { GameEngineResourceFx } from "~/bridge/game/GameEngineResourceFx";

/** Clears the exact verified failed save through the sole resource authority. */
export const recoverFailedGameSaveFx = Effect.fn("recoverFailedGameSaveFx")((packageId: string) =>
	GameEngineResourceFx.pipe(
		Effect.flatMap((service) =>
			service.recoverFailedSaveFx({
				packageId,
			}),
		),
	),
);
