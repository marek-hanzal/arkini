import { Effect } from "effect";
import type { createGameOwnerFx } from "~/bridge/game/createGameOwnerFx";

/** Releases the current game and fails when its final save/disposal did not succeed. */
export const shutdownGameOwnerFx = Effect.fn("shutdownGameOwnerFx")(
	(owner: createGameOwnerFx.Owner) =>
		Effect.gen(function* () {
			yield* owner.replaceFx(null);
			const state = owner.getSnapshot();
			if (state.type === "failed") yield* Effect.fail(state.error);
		}),
);
