import { Effect } from "effect";

import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { TickStepMs } from "~/game-tick/constant/TickStepMs";

/** Maximum fixed simulation steps settled after one Instant gameplay mutation. */
const InstantGameplayStepBudget = 64;

/** Settles a bounded canonical fixed-step budget while Instant gameplay is effective. */
export const settleInstantGameplayFx = Effect.fn("settleInstantGameplayFx")(function* () {
	const runtime = yield* readRuntimeFx();
	if (
		!(yield* isInstantGameplayEnabledFx({
			runtime,
		}))
	)
		return;
	yield* advanceRuntimeElapsedFx({
		elapsedMs: TickStepMs * InstantGameplayStepBudget,
	});
});
