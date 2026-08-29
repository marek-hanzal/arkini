import { Effect } from "effect";

import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { replayRuntimeStepsFx } from "~/game-tick/replayRuntimeStepsFx";

interface AdvanceRuntimeElapsedProps {
	readonly elapsedMs: number;
}

interface AdvanceRuntimeElapsedResult {
	/**
	 * Exact runtime reference proven to remain unchanged by another fixed step.
	 * A later authoritative command replaces the reference and invalidates the proof.
	 */
	readonly stableRuntime: RuntimeSchema.Type | null;
}

/** Replays one whole fixed-step elapsed budget inside one runtime transaction. */
export const advanceRuntimeElapsedFx = Effect.fn("advanceRuntimeElapsedFx")(function* ({
	elapsedMs,
}: AdvanceRuntimeElapsedProps) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const replay = yield* replayRuntimeStepsFx({
				elapsedMs,
				runtime,
			});
			return [
				{
					stableRuntime: replay.isStable ? replay.runtime : null,
				} satisfies AdvanceRuntimeElapsedResult,
				replay.runtime,
				replay.events,
			] as const;
		}),
	);
});
