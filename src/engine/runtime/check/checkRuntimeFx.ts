import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { checkRuntimeDeliveriesFn } from "~/production-delivery/check/checkRuntimeDeliveriesFn";
import { checkRuntimeInputLocationsFn } from "~/production-input/check/checkRuntimeInputLocationsFn";
import { checkRuntimeDefaultLinesFn } from "~/production-line/fn/checkRuntimeDefaultLinesFn";
import { checkRuntimeJobsFn } from "~/production-job/check/checkRuntimeJobsFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { RuntimeCheckResultSchema } from "~/engine/runtime/schema/check/RuntimeCheckResultSchema";
import { checkRuntimeItemChargesFn } from "./fn/checkRuntimeItemChargesFn";
import { checkRuntimeItemIdsFn } from "./fn/checkRuntimeItemIdsFn";
import { checkRuntimeItemQuantitiesFx } from "./checkRuntimeItemQuantitiesFx";
import { checkRuntimeItemTemporaryDurationsFn } from "./fn/checkRuntimeItemTemporaryDurationsFn";
import { checkRuntimeLocationsFn } from "./fn/checkRuntimeLocationsFn";

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
	const itemChargeIssues = checkRuntimeItemChargesFn({
		runtime,
	});
	const itemIdIssues = checkRuntimeItemIdsFn({
		runtime,
	});
	const itemQuantityIssues = yield* checkRuntimeItemQuantitiesFx({
		runtime,
	});
	const itemTemporaryDurationIssues = checkRuntimeItemTemporaryDurationsFn({
		runtime,
	});
	const defaultLineIssues = checkRuntimeDefaultLinesFn({
		runtime,
	});
	const inputLocationIssues = checkRuntimeInputLocationsFn({
		runtime,
	});
	const deliveryIssues = checkRuntimeDeliveriesFn({
		runtime,
	});
	const jobIssues = checkRuntimeJobsFn({
		runtime,
	});
	const locationIssues = checkRuntimeLocationsFn({
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
			...deliveryIssues,
			...jobIssues,
			...locationIssues,
		],
	} satisfies RuntimeCheckResultSchema.Type;
});
