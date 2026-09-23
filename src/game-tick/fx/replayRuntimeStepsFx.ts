import { Effect } from "effect";

import type { EngineFact } from "~/game-event/type/EngineFact";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";

interface ReplayRuntimeStepsProps {
	readonly elapsedMs: number;
	readonly runtime: RuntimeSchema.Type;
}

interface ReplayRuntimeStepsResult {
	readonly facts: readonly EngineFact[];
	readonly isStable: boolean;
	readonly processedSteps: number;
	readonly runtime: RuntimeSchema.Type;
	readonly skippedSteps: number;
}

/**
 * Replays a whole fixed-step budget over one locked runtime draft.
 *
 * A fact-free same-reference step is stable while the runtime transaction is
 * still locked: the next fixed step would receive the exact same state and must
 * produce the same no-op result. The remaining backlog can therefore be
 * consumed without repeating identical domain work.
 */
export const replayRuntimeStepsFx = Effect.fn("replayRuntimeStepsFx")(function* ({
	elapsedMs,
	runtime,
}: ReplayRuntimeStepsProps) {
	if (elapsedMs % SimulationStepMs !== 0) {
		return yield* Effect.die(
			new Error(`Tick advancement ${elapsedMs}ms is not divisible by ${SimulationStepMs}ms.`),
		);
	}

	const totalSteps = elapsedMs / SimulationStepMs;
	let draft = runtime;
	const facts: EngineFact[] = [];
	let processedSteps = 0;
	let isStable = false;

	for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
		const step = yield* advanceRuntimeStepFx(draft);
		processedSteps = stepIndex + 1;
		const isStableNoOp = step.runtime === draft && step.facts.length === 0;
		if (isStableNoOp) {
			isStable = true;
			break;
		}
		draft = step.runtime;
		facts.push(...step.facts);
	}

	return {
		facts,
		isStable,
		processedSteps,
		runtime: draft,
		skippedSteps: totalSteps - processedSteps,
	} satisfies ReplayRuntimeStepsResult;
});
