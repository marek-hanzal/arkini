import { Effect } from "effect";

import { InstantGameplayStepBudget } from "~/engine/cheat/InstantGameplayStepBudget";
import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/advanceRuntimeElapsedFx";
import { TickStepMs } from "~/game-tick/TickStepMs";

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
