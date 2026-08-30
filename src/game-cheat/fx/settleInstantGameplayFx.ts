import { Effect } from "effect";

import { isInstantGameplayEnabledFn } from "~/game-runtime/read/fn/isInstantGameplayEnabledFn";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

/** Maximum fixed simulation steps settled after one Instant gameplay mutation. */
const InstantGameplayStepBudget = 64;

/** Settles a bounded canonical fixed-step budget while Instant gameplay is effective. */
export const settleInstantGameplayFx = Effect.fn("settleInstantGameplayFx")(function* () {
	const runtime = yield* readRuntimeFx();
	if (
		!isInstantGameplayEnabledFn({
			runtime,
		})
	)
		return;
	yield* advanceRuntimeElapsedFx({
		elapsedMs: SimulationStepMs * InstantGameplayStepBudget,
	});
});
