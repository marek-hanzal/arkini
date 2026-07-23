import { Effect } from "effect";

import { InstantGameplayStepBudget } from "~/engine/cheat/InstantGameplayStepBudget";
import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/engine/tick/internal/advanceRuntimeElapsedFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

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
