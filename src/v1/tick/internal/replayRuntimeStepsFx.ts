import { Effect } from "effect";

import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/v1/tick/TickStepMs";
import { advanceRuntimeStepFx } from "~/v1/tick/internal/advanceRuntimeStepFx";

export namespace replayRuntimeStepsFx {
	export interface Props {
		elapsedMs: number;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly processedSteps: number;
		readonly runtime: RuntimeSchema.Type;
		readonly skippedSteps: number;
	}
}

/**
 * Replays a whole fixed-step budget over one locked runtime draft.
 *
 * An event-free same-reference step is stable while the runtime transaction is
 * still locked: the next fixed step would receive the exact same state and must
 * produce the same no-op result. The remaining backlog can therefore be
 * consumed without repeating identical domain work.
 */
export const replayRuntimeStepsFx = Effect.fn("replayRuntimeStepsFx")(function* ({
	elapsedMs,
	runtime,
}: replayRuntimeStepsFx.Props) {
	if (elapsedMs % TickStepMs !== 0) {
		return yield* Effect.dieMessage(
			`Tick advancement ${elapsedMs}ms is not divisible by ${TickStepMs}ms.`,
		);
	}

	const totalSteps = elapsedMs / TickStepMs;
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	let processedSteps = 0;

	for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
		const step = yield* advanceRuntimeStepFx(draft);
		processedSteps = stepIndex + 1;
		const isStableNoOp = step.runtime === draft && step.events.length === 0;
		if (isStableNoOp) break;
		draft = step.runtime;
		events.push(...step.events);
	}

	return {
		events,
		processedSteps,
		runtime: draft,
		skippedSteps: totalSteps - processedSteps,
	} satisfies replayRuntimeStepsFx.Result;
});
