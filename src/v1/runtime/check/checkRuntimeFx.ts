import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { checkRuntimeInputLocationsFx } from "~/v1/input/check/checkRuntimeInputLocationsFx";
import { checkRuntimeJobsFx } from "~/v1/job/check/checkRuntimeJobsFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { RuntimeCheckResultSchema } from "~/v1/runtime/schema/check/RuntimeCheckResultSchema";
import { checkRuntimeItemIdsFx } from "./checkRuntimeItemIdsFx";
import { checkRuntimeItemChargesFx } from "./checkRuntimeItemChargesFx";
import { checkRuntimeItemQuantitiesFx } from "./checkRuntimeItemQuantitiesFx";
import { checkRuntimeLocationsFx } from "./checkRuntimeLocationsFx";

export namespace checkRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Runs every explicit invariant checker against one candidate runtime.
 */
export const checkRuntimeFx = Effect.fn("checkRuntimeFx")(function* ({
	runtime,
}: checkRuntimeFx.Props) {
	const config = yield* GameConfigFx;
	const itemChargeIssues = yield* checkRuntimeItemChargesFx({
		runtime,
	});
	const itemIdIssues = yield* checkRuntimeItemIdsFx({
		runtime,
	});
	const itemQuantityIssues = yield* checkRuntimeItemQuantitiesFx({
		runtime,
	});
	const inputLocationIssues = yield* checkRuntimeInputLocationsFx({
		runtime,
	});
	const jobIssues = yield* checkRuntimeJobsFx({
		runtime,
	});
	const locationIssues = yield* checkRuntimeLocationsFx({
		config,
		runtime,
	});

	return {
		issues: [
			...itemChargeIssues,
			...itemIdIssues,
			...itemQuantityIssues,
			...inputLocationIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
