import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { checkRuntimeInputLocationsFx } from "~/engine/input/check/checkRuntimeInputLocationsFx";
import { checkRuntimeDefaultLinesFx } from "~/engine/line/check/checkRuntimeDefaultLinesFx";
import { checkRuntimeJobsFx } from "~/engine/job/check/checkRuntimeJobsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { RuntimeCheckResultSchema } from "~/engine/runtime/schema/check/RuntimeCheckResultSchema";
import { checkRuntimeItemIdsFx } from "./checkRuntimeItemIdsFx";
import { checkRuntimeItemChargesFx } from "./checkRuntimeItemChargesFx";
import { checkRuntimeItemQuantitiesFx } from "./checkRuntimeItemQuantitiesFx";
import { checkRuntimeItemTemporaryDurationsFx } from "./checkRuntimeItemTemporaryDurationsFx";
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
	const itemTemporaryDurationIssues = yield* checkRuntimeItemTemporaryDurationsFx({
		runtime,
	});
	const defaultLineIssues = yield* checkRuntimeDefaultLinesFx({
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
			...itemTemporaryDurationIssues,
			...defaultLineIssues,
			...inputLocationIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
