import { Effect } from "effect";

import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { replayRuntimeStepsFx } from "~/engine/tick/internal/replayRuntimeStepsFx";

export namespace advanceRuntimeElapsedFx {
	export interface Props {
		elapsedMs: number;
	}
}

/** Replays one whole fixed-step elapsed budget inside one runtime transaction. */
export const advanceRuntimeElapsedFx = Effect.fn("advanceRuntimeElapsedFx")(function* ({
	elapsedMs,
}: advanceRuntimeElapsedFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const replay = yield* replayRuntimeStepsFx({
				elapsedMs,
				runtime,
			});
			return [
				undefined,
				replay.runtime,
				replay.events,
			] as const;
		}),
	);
});
