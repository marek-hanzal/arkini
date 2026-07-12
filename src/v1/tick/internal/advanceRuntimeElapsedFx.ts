import { Effect } from "effect";

import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { TickStepMs } from "~/v1/tick/TickStepMs";
import { advanceRuntimeStepFx } from "~/v1/tick/internal/advanceRuntimeStepFx";

export namespace advanceRuntimeElapsedFx {
	export interface Props {
		elapsedMs: number;
	}
}

/** Replays one whole fixed-step elapsed budget inside one runtime transaction. */
export const advanceRuntimeElapsedFx = Effect.fn("advanceRuntimeElapsedFx")(function* ({
	elapsedMs,
}: advanceRuntimeElapsedFx.Props) {
	if (elapsedMs % TickStepMs !== 0) {
		return yield* Effect.dieMessage(
			`Tick advancement ${elapsedMs}ms is not divisible by ${TickStepMs}ms.`,
		);
	}
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			let draft = runtime;
			const events: GameEventSchema.Type[] = [];
			for (let processedMs = 0; processedMs < elapsedMs; processedMs += TickStepMs) {
				const step = yield* advanceRuntimeStepFx(draft);
				draft = step.runtime;
				events.push(...step.events);
			}
			return [
				undefined,
				draft,
				events,
			] as const;
		}),
	);
});
