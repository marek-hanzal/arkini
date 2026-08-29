import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/game-tick/TickStepMs";
import { advanceRuntimeStepFx } from "~/game-tick/advanceRuntimeStepFx";

interface ReplayRuntimeStepsProps {
	readonly elapsedMs: number;
	readonly runtime: RuntimeSchema.Type;
}

interface ReplayRuntimeStepsResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly isStable: boolean;
	readonly processedSteps: number;
	readonly runtime: RuntimeSchema.Type;
	readonly skippedSteps: number;
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
}: ReplayRuntimeStepsProps) {
	if (elapsedMs % TickStepMs !== 0) {
		return yield* Effect.die(
			new Error(`Tick advancement ${elapsedMs}ms is not divisible by ${TickStepMs}ms.`),
		);
	}

	const totalSteps = elapsedMs / TickStepMs;
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	let processedSteps = 0;
	let isStable = false;

	for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
		const step = yield* advanceRuntimeStepFx(draft);
		processedSteps = stepIndex + 1;
		const isStableNoOp = step.runtime === draft && step.events.length === 0;
		if (isStableNoOp) {
			isStable = true;
			break;
		}
		draft = step.runtime;
		events.push(...step.events);
	}

	return {
		events,
		isStable,
		processedSteps,
		runtime: draft,
		skippedSteps: totalSteps - processedSteps,
	} satisfies ReplayRuntimeStepsResult;
});
